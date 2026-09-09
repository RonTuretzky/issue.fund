import { encodeFunctionData, keccak256, recoverTransactionAddress } from "viem";
import { checkPair } from "../shared/dkim.mjs";
import { randomUUID } from "node:crypto";
import { ServiceError, safeCode, fail } from "./errors.mjs";

export class RelayWorker {
  constructor({
    store,
    client,
    signer,
    account,
    deployments,
    gate,
    confirmations = 12,
    maxGas = 15_000_000n,
    maxGasPrice = 10_000_000_000n,
    maxClaimCost = 200_000_000_000_000_000n,
    now = Date.now,
  }) {
    Object.assign(this, {
      store,
      client,
      signer,
      account,
      deployments,
      gate,
      confirmations,
      maxGas,
      maxGasPrice,
      maxClaimCost,
      now,
    });
    this.owner = randomUUID();
  }
  async tick() {
    if (!this.store.lease("relay", this.owner, 120_000, this.now())) return;
    let job;
    try {
      // One in-flight nonce for this dedicated account. Persist before broadcast,
      // and always resume it before signing another transaction after a restart.
      await this.checkReorganizations();
      const pending = this.store.get(
        "SELECT * FROM transactions WHERE state IN ('signed','submitted') ORDER BY nonce,created_at DESC LIMIT 1",
      );
      if (pending) {
        await this.resume(pending);
        return;
      }
      job = this.store.get(
        "SELECT * FROM jobs WHERE state IN ('queued','attention') AND merge_id IS NOT NULL AND tx_hash IS NULL AND next_attempt<=? ORDER BY updated_at LIMIT 1",
        this.now(),
      );
      if (!job) return;
      const { bounty, d, merged, closed, pair } = await this.preflight(job);
      // gate.check must precede ALL RPC calls containing signed email bytes.
      await this.gate.check(bounty, pair);
      const input = {
        address: d.contract,
        abi: d.abi,
        functionName: "claim",
        args: [BigInt(bounty.id), merged.receipt, closed.receipt],
        account: this.account,
      };
      await this.client.simulateContract(input);
      const estimated = await this.client.estimateContractGas(input);
      const gas = estimated + estimated / 5n;
      const gasPrice = await this.client.getGasPrice();
      if (
        gas > this.maxGas ||
        gasPrice > this.maxGasPrice ||
        gas * gasPrice > this.maxClaimCost
      )
        fail("relay_gas_limit", 409);
      if (
        (await this.client.getBalance({ address: this.account })) <
        gas * gasPrice
      )
        fail("relay_needs_gas", 409);
      const latest = await this.client.getTransactionCount({
        address: this.account,
        blockTag: "latest",
      });
      const pendingNonce = await this.client.getTransactionCount({
        address: this.account,
        blockTag: "pending",
      });
      if (latest !== pendingNonce)
        fail("relay_unknown_pending_transaction", 409);
      const data = encodeFunctionData({
        abi: d.abi,
        functionName: "claim",
        args: input.args,
      });
      // Recheck mutable GitHub state immediately before signing/broadcast.
      await this.gate.check(bounty, pair);
      if (!this.store.lease("relay", this.owner, 120_000, this.now()))
        fail("relay_lease_lost");
      const signed = await this.signer.sign({
        chainId: d.chainId,
        to: d.contract,
        value: "0",
        nonce: latest,
        data,
        gas: gas.toString(),
        gasPrice: gasPrice.toString(),
      });
      if (
        (
          await recoverTransactionAddress({ serializedTransaction: signed })
        ).toLowerCase() !== this.account.toLowerCase()
      )
        fail("relay_signer_mismatch");
      const hash = keccak256(signed);
      this.store.transaction(() => {
        const lease = this.store.get(
          "SELECT * FROM leases WHERE name=?",
          "relay",
        );
        if (lease.owner !== this.owner || lease.until_at <= this.now())
          fail("relay_lease_lost");
        this.store.run(
          "INSERT INTO transactions(hash,bounty_key,nonce,signed_ciphertext,gas_budget,created_at) VALUES (?,?,?,?,?,?)",
          hash,
          job.bounty_key,
          latest,
          this.store.seal(
            {
              signed,
              gas: gas.toString(),
              gasPrice: gasPrice.toString(),
              data,
              purpose: "claim",
            },
            `transaction:${hash}`,
          ),
          (gas * gasPrice).toString(),
          this.now(),
        );
        this.store.run(
          "UPDATE jobs SET state='submitted',tx_hash=?,code=NULL,updated_at=? WHERE bounty_key=?",
          hash,
          this.now(),
          job.bounty_key,
        );
      });
      if (await this.broadcast(hash, signed))
        this.store.health("relay", true, null, this.now());
    } catch (error) {
      const code = safeCode(error);
      this.store.health("relay", false, code, this.now());
      if (job)
        this.store.run(
          "UPDATE jobs SET state=CASE WHEN tx_hash IS NULL AND state IN ('queued','attention') THEN 'attention' ELSE state END,code=?,attempts=attempts+1,next_attempt=?,updated_at=? WHERE bounty_key=?",
          code,
          this.now() +
            Math.min(3600_000, 30_000 * 2 ** Math.min(job.attempts, 7)),
          this.now(),
          job.bounty_key,
        );
    } finally {
      this.store.release("relay", this.owner);
    }
  }
  async checkReorganizations() {
    const settled = this.store.all(
      "SELECT * FROM transactions WHERE state IN ('confirmed','reverted') ORDER BY block_number DESC LIMIT 200",
    );
    for (const tx of settled) {
      const head = await this.client.getBlockNumber();
      if (head < BigInt(tx.block_number))
        fail("chain_head_behind_confirmation");
      const block = await this.client.getBlock({
        blockNumber: BigInt(tx.block_number),
      });
      if (block.hash !== tx.block_hash) {
        this.store.run(
          "UPDATE transactions SET state='signed',block_number=NULL,block_hash=NULL WHERE hash=?",
          tx.hash,
        );
        this.store.run(
          "UPDATE jobs SET state='submitted',code='chain_reorganization',tx_hash=? WHERE bounty_key=?",
          tx.hash,
          tx.bounty_key,
        );
      }
    }
  }
  async preflight(job) {
    const row = this.store.get(
      "SELECT * FROM bounties WHERE key=?",
      job.bounty_key,
    );
    if (!row?.canonical) fail("chain_reorganization", 409);
    const d = this.deployments.find(
      (d) =>
        d.chainId === row.chain_id && d.contract.toLowerCase() === row.escrow,
    );
    if (!d || (await this.client.getChainId()) !== d.chainId)
      fail("chain_mismatch");
    const fresh = await this.client.readContract({
      address: d.contract,
      abi: d.abi,
      functionName: "getBounty",
      args: [BigInt(row.bounty_id)],
    });
    if (Number(fresh.status) !== 0) {
      this.store.run(
        "UPDATE jobs SET state=?,code=NULL,updated_at=? WHERE bounty_key=?",
        "waiting_confirmation",
        this.now(),
        row.key,
      );
      fail("bounty_already_settled", 409);
    }
    const bounty = {
      ...JSON.parse(row.data),
      ...fresh,
      id: row.bounty_id,
      issue: Number(fresh.issue),
      createdAt: Number(fresh.createdAt),
      deadline: Number(fresh.deadline),
      keyHash: d.keyHash,
    };
    const block = await this.client.getBlock();
    if (block.timestamp > BigInt(bounty.deadline) + 7n * 86400n)
      fail("claim_window_ended", 409);
    const merged = this.store.receipt(job.merge_id).prepared,
      closed = this.store.receipt(job.closure_id).prepared;
    let pair;
    try {
      pair = checkPair(merged, closed, bounty);
    } catch {
      fail("receipt_pair_invalid", 422);
    }
    return { bounty, d, merged, closed, pair };
  }
  async broadcast(hash, signed) {
    // An uncertain network response must not allocate a new nonce. The signed
    // bytes and hash already exist durably and are safe to retry identically.
    try {
      const actual = await this.client.sendRawTransaction({
        serializedTransaction: signed,
      });
      if (actual !== hash) fail("relay_hash_mismatch");
      this.store.run(
        "UPDATE transactions SET state='submitted' WHERE hash=?",
        hash,
      );
      return true;
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      this.store.health("relay", false, "broadcast_unconfirmed", this.now());
      return false;
    }
  }
  async resume(tx) {
    // Any replacement may have won on another node; check the whole nonce family.
    const family = this.store.all(
      "SELECT * FROM transactions WHERE nonce=? AND state IN ('signed','submitted','replaced')",
      tx.nonce,
    );
    for (const candidate of family) {
      let receipt;
      try {
        receipt = await this.client.getTransactionReceipt({
          hash: candidate.hash,
        });
      } catch (error) {
        if (error?.name !== "TransactionReceiptNotFoundError") throw error;
      }
      if (!receipt) continue;
      const tip = await this.client.getBlockNumber();
      if (tip < receipt.blockNumber + BigInt(this.confirmations)) return;
      const block = await this.client.getBlock({
        blockNumber: receipt.blockNumber,
      });
      if (block.hash !== receipt.blockHash) return;
      const { purpose } = this.store.open(
        candidate.signed_ciphertext,
        `transaction:${candidate.hash}`,
      );
      this.store.transaction(() => {
        this.store.run(
          "UPDATE transactions SET state='superseded' WHERE nonce=? AND hash!=?",
          tx.nonce,
          candidate.hash,
        );
        this.store.run(
          "UPDATE transactions SET state=?,block_number=?,block_hash=? WHERE hash=?",
          receipt.status === "success" ? "confirmed" : "reverted",
          Number(receipt.blockNumber),
          receipt.blockHash,
          candidate.hash,
        );
        if (purpose === "cancel" || receipt.status !== "success") {
          this.store.run(
            "UPDATE jobs SET state=CASE WHEN state IN ('credited','withdrawn','refunded') THEN state ELSE 'attention' END,code=?,tx_hash=NULL,next_attempt=?,updated_at=? WHERE bounty_key=?",
            purpose === "cancel"
              ? "relay_transaction_cancelled"
              : "claim_transaction_reverted",
            this.now() + 60_000,
            this.now(),
            tx.bounty_key,
          );
        } else
          this.store.run(
            "UPDATE jobs SET state='credited',code=NULL,tx_hash=?,updated_at=? WHERE bounty_key=?",
            candidate.hash,
            this.now(),
            tx.bounty_key,
          );
      });
      this.store.health("relay", true, null, this.now());
      return;
    }
    const job = this.store.get(
      "SELECT * FROM jobs WHERE bounty_key=?",
      tx.bounty_key,
    );
    let checked,
      cancel = false;
    try {
      checked = await this.preflight(job);
    } catch (error) {
      if (
        [
          "bounty_already_settled",
          "claim_window_ended",
          "chain_reorganization",
          "receipt_pair_invalid",
        ].includes(error.code)
      )
        cancel = true;
      else throw error;
    }
    const original = this.store.open(
      tx.signed_ciphertext,
      `transaction:${tx.hash}`,
    );
    cancel ||= original.purpose === "cancel";
    const current = await this.client.getTransactionCount({
      address: this.account,
      blockTag: "latest",
    });
    if (current > tx.nonce) fail("relay_nonce_consumed_unknown", 409);
    if (!cancel) await this.gate.check(checked.bounty, checked.pair);
    if (cancel || this.now() - tx.created_at > 120_000) {
      await this.replace(tx, original, checked, cancel);
    } else await this.broadcast(tx.hash, original.signed);
  }
  async replace(tx, original, checked, cancel) {
    const market = await this.client.getGasPrice();
    const increased = (BigInt(original.gasPrice) * 9n) / 8n + 1n;
    const gasPrice = market > increased ? market : increased;
    const gas = cancel ? 21_000n : BigInt(original.gas);
    if (gasPrice > this.maxGasPrice || gas * gasPrice > this.maxClaimCost)
      fail("relay_replacement_gas_limit", 409);
    if (
      (await this.client.getBalance({ address: this.account })) <
      gas * gasPrice
    )
      fail("relay_needs_gas", 409);
    if (!this.store.lease("relay", this.owner, 120_000, this.now()))
      fail("relay_lease_lost");
    const d =
      checked?.d ??
      this.deployments.find(
        (d) => d.chainId === Number(tx.bounty_key.split(":")[0]),
      );
    const data = cancel ? "0x" : original.data;
    const signed = await this.signer.sign({
      chainId: d.chainId,
      to: cancel ? this.account : checked.d.contract,
      value: "0",
      nonce: tx.nonce,
      data,
      gas: gas.toString(),
      gasPrice: gasPrice.toString(),
    });
    if (
      (
        await recoverTransactionAddress({ serializedTransaction: signed })
      ).toLowerCase() !== this.account.toLowerCase()
    )
      fail("relay_signer_mismatch");
    const hash = keccak256(signed);
    this.store.transaction(() => {
      const lease = this.store.get(
        "SELECT * FROM leases WHERE name=?",
        "relay",
      );
      if (lease.owner !== this.owner || lease.until_at <= this.now())
        fail("relay_lease_lost");
      this.store.run(
        "UPDATE transactions SET state='replaced' WHERE hash=?",
        tx.hash,
      );
      this.store.run(
        "INSERT INTO transactions(hash,bounty_key,nonce,signed_ciphertext,gas_budget,created_at) VALUES (?,?,?,?,?,?)",
        hash,
        tx.bounty_key,
        tx.nonce,
        this.store.seal(
          {
            signed,
            gas: gas.toString(),
            gasPrice: gasPrice.toString(),
            data,
            purpose: cancel ? "cancel" : "claim",
          },
          `transaction:${hash}`,
        ),
        (gas * gasPrice).toString(),
        this.now(),
      );
      this.store.run(
        "UPDATE jobs SET tx_hash=?,updated_at=? WHERE bounty_key=?",
        hash,
        this.now(),
        tx.bounty_key,
      );
    });
    await this.broadcast(hash, signed);
  }
}
