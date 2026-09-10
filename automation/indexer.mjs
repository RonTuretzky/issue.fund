import { encodeAbiParameters, keccak256 } from "viem";
import { json } from "./store.mjs";
import { fail, safeCode } from "./errors.mjs";

export const bountyKey = (chainId, escrow, id) =>
  `${chainId}:${escrow.toLowerCase()}:${id}`;
export const referenceFor = (chainId, escrow, id) =>
  keccak256(
    encodeAbiParameters(
      [{ type: "uint256" }, { type: "address" }, { type: "uint256" }],
      [BigInt(chainId), escrow, BigInt(id)],
    ),
  );

export class ChainIndexer {
  constructor({
    store,
    client,
    deployments,
    collector,
    registry,
    confirmations = 12,
    now = Date.now,
    chunkSize = 500,
    batchSize = 25,
  }) {
    Object.assign(this, {
      store,
      client,
      deployments,
      collector,
      registry,
      confirmations,
      now,
      chunkSize,
      batchSize,
    });
    if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 100)
      fail("indexer_batch_invalid");
  }
  async poll() {
    try {
      // Discovery must not exhaust GitHub's quota or delay mailbox polling.
      this.registryBudget = 1;
      const chainId = await this.client.getChainId();
      const head = await this.client.getBlockNumber();
      if (head < BigInt(this.confirmations)) return;
      const tip = head - BigInt(this.confirmations);
      let failure;
      for (const deployment of this.deployments) {
        if (deployment.chainId !== chainId) fail("chain_mismatch");
        try {
          await this.sync(deployment, tip);
        } catch (error) {
          failure ??= error;
        }
      }
      if (failure) throw failure;
      this.store.health("chain", true, null, this.now());
    } catch (error) {
      this.store.health("chain", false, safeCode(error), this.now());
    }
  }
  async sync(d, tip) {
    const cursorKey = `chain:${d.chainId}:${d.contract.toLowerCase()}`;
    let cursor = this.store.getMeta(cursorKey);
    if (cursor) {
      const block = await this.client.getBlock({
        blockNumber: BigInt(cursor.number),
      });
      if (block.hash !== cursor.hash) {
        const restart = Math.max(d.fromBlock, cursor.number - 5000);
        this.store.transaction(() => {
          this.store.run(
            "UPDATE bounties SET canonical=0 WHERE chain_id=? AND escrow=? AND funded_block>=?",
            d.chainId,
            d.contract.toLowerCase(),
            restart,
          );
          this.store.run(
            "UPDATE jobs SET state='attention',code='chain_reorganization' WHERE bounty_key IN (SELECT key FROM bounties WHERE canonical=0) AND tx_hash IS NULL",
          );
          this.store.run(
            "DELETE FROM chain_events WHERE chain_id=? AND escrow=? AND block_number>=?",
            d.chainId,
            d.contract.toLowerCase(),
            restart,
          );
          this.store.run(
            "DELETE FROM index_pending WHERE chain_id=? AND escrow=? AND funded_block>=?",
            d.chainId,
            d.contract.toLowerCase(),
            restart,
          );
          // Settlement can be orphaned even when its older funding is intact.
          // Include withdrawn/refunded jobs, which the active sweep excludes.
          this.store.run(
            `INSERT OR REPLACE INTO index_pending
            SELECT key,chain_id,escrow,bounty_id,funded_block,funded_hash,0
            FROM bounties WHERE chain_id=? AND escrow=? AND canonical=1`,
            d.chainId,
            d.contract.toLowerCase(),
          );
          this.store.setMeta(cursorKey, null);
          this.store.setMeta(`${cursorKey}:restart`, restart);
        });
        cursor = null;
      }
    }
    const start = cursor
      ? cursor.number + 1
      : (this.store.getMeta(`${cursorKey}:restart`) ?? d.fromBlock);
    // Bound work per tick; preserve a checkpoint before yielding to mailbox/API.
    const to = Math.min(Number(tip), start + this.chunkSize - 1);
    if (start <= to) {
      const anchor = await this.client.getBlock({ blockNumber: BigInt(to) });
      const logs = await this.client.getContractEvents({
        address: d.contract,
        abi: d.abi,
        fromBlock: BigInt(start),
        toBlock: BigInt(to),
        strict: true,
      });
      const last = await this.client.getBlock({ blockNumber: BigInt(to) });
      if (anchor.hash !== last.hash) fail("chain_reorganization");
      // Stage events and their work queue atomically with the scan checkpoint.
      // A crash or failed bounty read cannot lose a funding event.
      this.store.transaction(() => {
        for (const log of logs) {
          if (log.removed) continue;
          this.store.run(
            "INSERT OR REPLACE INTO chain_events VALUES (?,?,?,?,?,?,?,?)",
            d.chainId,
            d.contract.toLowerCase(),
            Number(log.blockNumber),
            log.blockHash,
            log.transactionHash,
            log.logIndex,
            log.eventName,
            json(log.args),
          );
          if (log.eventName !== "Funded") continue;
          const id = log.args.id;
          if (log.args.bountyRef !== referenceFor(d.chainId, d.contract, id))
            fail("funding_reference_invalid");
          this.store.run(
            "INSERT OR REPLACE INTO index_pending VALUES (?,?,?,?,?,?,0)",
            bountyKey(d.chainId, d.contract, id),
            d.chainId,
            d.contract.toLowerCase(),
            id.toString(),
            Number(log.blockNumber),
            log.blockHash,
          );
        }
        this.store.setMeta(cursorKey, { number: to, hash: last.hash });
      });
    }
    let failure;
    const refresh = async (row) => {
      const key = row.bounty_key ?? row.key;
      try {
        // Also detects a funding reorg older than the scan rollback window.
        const block = await this.client.getBlock({
          blockNumber: BigInt(row.funded_block),
        });
        if (block.hash !== row.funded_hash) {
          this.store.run("UPDATE bounties SET canonical=0 WHERE key=?", key);
          this.store.run(
            "UPDATE jobs SET state='attention',code='chain_reorganization' WHERE bounty_key=? AND tx_hash IS NULL",
            key,
          );
        } else {
          await this.observe(
            d,
            BigInt(row.bounty_id),
            row.funded_block,
            row.funded_hash,
            tip,
          );
        }
        this.store.run("DELETE FROM index_pending WHERE bounty_key=?", key);
      } catch (error) {
        failure ??= error;
        this.store.run(
          "UPDATE index_pending SET next_attempt=? WHERE bounty_key=?",
          this.now() + 30_000,
          key,
        );
      }
    };
    const pending = this.store.all(
      `SELECT * FROM index_pending WHERE chain_id=? AND escrow=? AND next_attempt<=?
      ORDER BY next_attempt,bounty_key LIMIT ?`,
      d.chainId,
      d.contract.toLowerCase(),
      this.now(),
      this.batchSize,
    );
    for (const row of pending) await refresh(row);

    const sweepKey = `${cursorKey}:sweep`;
    const after = this.store.getMeta(sweepKey) ?? "";
    const active = this.store.all(
      `SELECT * FROM bounties WHERE chain_id=? AND escrow=? AND canonical=1 AND key>? AND
      key NOT IN (SELECT bounty_key FROM index_pending) AND
      (json_extract(data,'$.status')=0 OR key IN (SELECT bounty_key FROM jobs WHERE state IN ('submitted','credited')))
      ORDER BY key LIMIT ?`,
      d.chainId,
      d.contract.toLowerCase(),
      after,
      this.batchSize,
    );
    for (const row of active) {
      if (!pending.some((p) => p.bounty_key === row.key)) await refresh(row);
      // Advance on failure as well, so one unavailable bounty cannot starve others.
      this.store.setMeta(sweepKey, row.key);
    }
    if (active.length < this.batchSize) this.store.setMeta(sweepKey, "");
    if (failure) throw failure;
  }
  async observe(d, id, blockNumber, blockHash, tip) {
    const bounty = await this.client.readContract({
      address: d.contract,
      abi: d.abi,
      functionName: "getBounty",
      args: [id],
      blockNumber: tip,
    });
    let repo = this.store.get(
      "SELECT * FROM repositories WHERE full_name=?",
      bounty.repo,
    );
    if (
      this.registry &&
      this.registryBudget > 0 &&
      bounty.status === 0 &&
      (this.store.getMeta(`registry-retry:${bounty.repo}:${bounty.issue}`) ??
        0) <= this.now() &&
      (!repo ||
        !this.store.get(
          "SELECT id FROM issues WHERE repo_id=? AND number=?",
          repo.id,
          Number(bounty.issue),
        ))
    ) {
      this.registryBudget--;
      this.store.setMeta(
        `registry-retry:${bounty.repo}:${bounty.issue}`,
        this.now() + 15 * 60_000,
      );
      try {
        await this.registry.prepare(
          `https://github.com/${bounty.repo}/issues/${bounty.issue}`,
          { allowClosed: true },
        );
      } catch {
        /* Historical or unenrolled funding keeps an explicit manual fallback. */
      }
      repo = this.store.get(
        "SELECT * FROM repositories WHERE full_name=?",
        bounty.repo,
      );
    }
    const key = bountyKey(d.chainId, d.contract, id);
    const data = {
      ...bounty,
      id: Number(id),
      chainId: d.chainId,
      contract: d.contract,
      issue: Number(bounty.issue),
      pr: Number(bounty.pr),
      amount: bounty.amount.toString(),
      createdAt: Number(bounty.createdAt),
      deadline: Number(bounty.deadline),
      bountyRef: referenceFor(d.chainId, d.contract, id),
      keyHash: d.keyHash,
    };
    this.store.run(
      `INSERT INTO bounties VALUES (?,?,?,?,?,?,?,?,?,?,1,?) ON CONFLICT(key) DO UPDATE SET
      repo_id=excluded.repo_id,issue_number=excluded.issue_number,data=excluded.data,funded_block=excluded.funded_block,funded_hash=excluded.funded_hash,canonical=1,updated_at=excluded.updated_at`,
      key,
      d.chainId,
      d.contract.toLowerCase(),
      id.toString(),
      repo?.id ?? null,
      data.issue,
      data.bountyRef,
      json(data),
      blockNumber,
      blockHash,
      this.now(),
    );
    const missed = !repo?.watched_at || repo.watched_at > data.createdAt * 1000;
    this.store.run(
      `INSERT INTO jobs(bounty_key,state,code,updated_at) VALUES (?,?,?,?) ON CONFLICT(bounty_key) DO NOTHING`,
      key,
      missed ? "attention" : "waiting",
      missed ? "notifications_started_late" : "waiting_for_receipts",
      this.now(),
    );
    if (data.status === 1) {
      this.store.run(
        "UPDATE jobs SET state='credited',code=NULL,updated_at=? WHERE bounty_key=?",
        this.now(),
        key,
      );
      const paid = this.store.get(
        "SELECT * FROM chain_events WHERE chain_id=? AND escrow=? AND event_name='Paid' AND json_extract(args,'$.id')=? ORDER BY block_number DESC,log_index DESC LIMIT 1",
        d.chainId,
        d.contract.toLowerCase(),
        id.toString(),
      );
      const withdrawal =
        paid &&
        this.store.get(
          "SELECT * FROM chain_events WHERE chain_id=? AND escrow=? AND event_name='Withdrawn' AND lower(json_extract(args,'$.owner'))=? AND (block_number>? OR (block_number=? AND log_index>?)) ORDER BY block_number LIMIT 1",
          d.chainId,
          d.contract.toLowerCase(),
          data.recipient.toLowerCase(),
          paid.block_number,
          paid.block_number,
          paid.log_index,
        );
      if (withdrawal)
        this.store.run(
          "UPDATE jobs SET state='withdrawn',updated_at=? WHERE bounty_key=?",
          this.now(),
          key,
        );
    } else if (data.status === 2)
      this.store.run(
        "UPDATE jobs SET state='refunded',code=NULL,updated_at=? WHERE bounty_key=?",
        this.now(),
        key,
      );
    else {
      this.store.run(
        "UPDATE jobs SET state='waiting',code='chain_reorganization',tx_hash=NULL WHERE bounty_key=? AND state IN ('credited','withdrawn','refunded','waiting_confirmation')",
        key,
      );
      if (repo) {
        const prs = this.store.all(
          "SELECT DISTINCT pr FROM receipts WHERE repo_id=? AND (bounty_ref=? OR issue_number=?)",
          repo.id,
          data.bountyRef,
          data.issue,
        );
        for (const { pr } of prs) this.collector.pair(repo.id, pr);
      }
    }
  }
}
