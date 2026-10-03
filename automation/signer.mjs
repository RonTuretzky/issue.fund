import { decodeFunctionData, keccak256, toHex } from "viem";
import { fail } from "./errors.mjs";
import { json } from "./store.mjs";

// Runs in its own process/user. It never receives mailbox or GitHub credentials.
// The socket only permits zero-value claims to explicitly approved escrows.
export class RestrictedSigner {
  constructor({
    account,
    store,
    deployments,
    chainId,
    maxGas = 15_000_000n,
    maxGasPrice = 10_000_000_000n,
    dailyBudget = 1_000_000_000_000_000_000n,
    now = Date.now,
  }) {
    Object.assign(this, {
      account,
      store,
      deployments,
      chainId,
      maxGas,
      maxGasPrice,
      dailyBudget,
      now,
    });
  }
  async sign(input) {
    const cancellation =
      input.to?.toLowerCase() === this.account.address.toLowerCase() &&
      input.data === "0x";
    const deployment = this.deployments.find(
      (d) =>
        d.chainId === this.chainId &&
        d.contract.toLowerCase() === input.to?.toLowerCase(),
    );
    if (
      (!deployment && !cancellation) ||
      input.chainId !== this.chainId ||
      input.value !== "0" ||
      !Number.isSafeInteger(input.nonce) ||
      input.nonce < 0
    )
      fail("signer_policy_rejected", 422);
    let decoded, gas, gasPrice;
    try {
      if (!cancellation)
        decoded = decodeFunctionData({ abi: deployment.abi, data: input.data });
      gas = BigInt(input.gas);
      gasPrice = BigInt(input.gasPrice);
    } catch {
      fail("signer_policy_rejected", 422);
    }
    if (
      (!cancellation &&
        (decoded.functionName !== "claim" || decoded.args[0] === 0n)) ||
      (cancellation && gas !== 21_000n) ||
      gas < 21_000n ||
      gas > this.maxGas ||
      gasPrice <= 0n ||
      gasPrice > this.maxGasPrice ||
      input.data.length > 400_000
    )
      fail("signer_policy_rejected", 422);
    const cost = gas * gasPrice;
    const fingerprint = keccak256(
      toHex(
        json({
          to: input.to.toLowerCase(),
          chainId: input.chainId,
          nonce: input.nonce,
          data: input.data,
        }),
      ),
    );
    const day = new Date(this.now()).toISOString().slice(0, 10);
    const reservationKey = `signer-reservation:${input.nonce}`;
    this.store.transaction(() => {
      const prior = this.store.getMeta(reservationKey);
      if (cancellation && !prior) fail("signer_unknown_cancellation", 409);
      if (prior && prior.fingerprint !== fingerprint && !cancellation)
        fail("signer_nonce_conflict", 409);
      if (prior && gasPrice < BigInt(prior.gasPrice))
        fail("signer_replacement_underpriced", 409);
      const previousCost = prior && prior.day === day ? BigInt(prior.cost) : 0n;
      const reservedCost = cost > previousCost ? cost : previousCost;
      const additional = reservedCost - previousCost;
      const budgetKey = `signer-budget:${day}`;
      const spent = BigInt(this.store.getMeta(budgetKey) ?? "0");
      if (spent + additional > this.dailyBudget)
        fail("relay_daily_budget_exhausted", 429);
      this.store.setMeta(budgetKey, (spent + additional).toString());
      this.store.setMeta(reservationKey, {
        fingerprint,
        cost: reservedCost.toString(),
        gasPrice: gasPrice.toString(),
        day,
      });
    });
    return this.account.signTransaction({
      chainId: this.chainId,
      to: input.to,
      data: input.data,
      value: 0n,
      nonce: input.nonce,
      gas,
      gasPrice,
      type: "legacy",
    });
  }
}
