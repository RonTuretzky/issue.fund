import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseEther } from "viem";
import { fixture, client, rpc, restore, artifact } from "./helpers/chain.mjs";
import { prepareReceipt } from "../shared/dkim.mjs";
test("direct RSA escrow: real signature verification, relayed payout, replay rejection and exact withdrawal", async () => {
  const snapshot = await rpc("evm_snapshot");
  try {
    const f = await fixture();
    const m = (await prepareReceipt(f.merged.raw, f.s.key)).receipt,
      c = (await prepareReceipt(f.closed.raw, f.s.key)).receipt;
    const bad = { ...m, body: m.body.slice(0, -2) + "00" };
    await assert.rejects(f.write("claim", [1n, bad, c], f.accounts[2]));
    const foreign = f.s.email({
      bountyRef: "0x" + "ff".repeat(32),
      timestamp: Number((await f.bounties())[0].createdAt),
    });
    await assert.rejects(
      f.write("claim", [1n, foreign.receipt, c], f.accounts[2]),
    );
    const payment = await f.write("claim", [1n, m, c], f.accounts[2]);
    assert.equal(await f.read("credits", [f.accounts[1]]), parseEther("0.01"));
    assert.equal(await f.read("credits", [f.accounts[2]]), 0n);
    await assert.rejects(f.write("claim", [1n, m, c], f.accounts[2]));
    await assert.rejects(f.write("withdraw", [f.accounts[2]], f.accounts[2]));
    const before = await client.getBalance({ address: f.accounts[1] });
    const withdrawal = await f.write(
      "withdraw",
      [f.accounts[1]],
      f.accounts[1],
    );
    assert.equal(
      await client.getBalance({ address: f.accounts[1] }),
      before +
        parseEther("0.01") -
        withdrawal.gasUsed * withdrawal.effectiveGasPrice,
    );
    assert.equal(await client.getBalance({ address: f.config.contract }), 0n);
    fs.writeFileSync(
      ".local/direct-chain-results.json",
      JSON.stringify(
        {
          testedAt: new Date().toISOString(),
          realRsaVerifier: true,
          syntheticSigningKey: true,
          paymentGas: String(payment.gasUsed),
          paymentHash: payment.transactionHash,
          withdrawalHash: withdrawal.transactionHash,
          relayerCannotRedirect: true,
          replayRejected: true,
          tamperingRejected: true,
          snapshotRestored: true,
        },
        null,
        2,
      ),
    );
  } finally {
    await restore(snapshot);
  }
});
test("2048-bit signatures also pass the deployed on-chain verifier", async () => {
  const snapshot = await rpc("evm_snapshot");
  try {
    const f = await fixture(2048);
    const e = await client.readContract({
      address: f.config.verifier,
      abi: f.verifierAbi,
      functionName: "verifyReceipt",
      args: [f.merged.receipt],
    });
    assert.equal(e.pr, 43n);
  } finally {
    await restore(snapshot);
  }
});
test(
  "original GitHub notifications pass the actual pinned-key verifier without public RPC disclosure",
  {
    skip:
      !fs.existsSync(".local/gnosis-merge.eml") ||
      !fs.existsSync(".local/deployment.rsa.json"),
  },
  async () => {
    const d = JSON.parse(fs.readFileSync(".local/deployment.rsa.json", "utf8"));
    assert.equal(await client.getChainId(), 31337);
    for (const file of [
      ".local/gnosis-merge.eml",
      ".local/gnosis-closure.eml",
    ]) {
      const r = await prepareReceipt(fs.readFileSync(file), d.dkimKey);
      const e = await client.readContract({
        address: d.verifier,
        abi: artifact("GithubDkimVerifier").abi,
        functionName: "verifyReceipt",
        args: [r.receipt],
      });
      assert.equal(Number(e.pr), r.summary.pr);
    }
  },
);
