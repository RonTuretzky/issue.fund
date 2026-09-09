import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { randomBytes } from "node:crypto";
import {
  encodeFunctionData,
  parseTransaction,
  recoverTransactionAddress,
} from "viem";
import { mnemonicToAccount } from "viem/accounts";
import { Store } from "../../automation/store.mjs";
import { RestrictedSigner } from "../../automation/signer.mjs";

const account = mnemonicToAccount(
  "test test test test test test test test test test test junk",
);
const deployment = {
  chainId: 31337,
  contract: "0x1111111111111111111111111111111111111111",
  abi: JSON.parse(fs.readFileSync("out/MergeBountyV2.sol/MergeBountyV2.json"))
    .abi,
};
const receipt = { headers: "0x00", body: "0x00", signature: "0x00" };
const claim = encodeFunctionData({
  abi: deployment.abi,
  functionName: "claim",
  args: [1n, receipt, receipt],
});
const input = {
  chainId: 31337,
  to: deployment.contract,
  value: "0",
  data: claim,
  gas: "10000000",
  gasPrice: "1000000000",
  nonce: 0,
};
function fixture() {
  const store = new Store(":memory:", randomBytes(32));
  return {
    store,
    signer: new RestrictedSigner({
      account,
      store,
      deployments: [deployment],
      chainId: 31337,
      dailyBudget: 30_000_000_000_000_000n,
    }),
  };
}

test("signer accepts only claims to approved escrows on the configured chain", async () => {
  const { store, signer } = fixture();
  const signed = await signer.sign(input);
  assert.equal(
    (
      await recoverTransactionAddress({ serializedTransaction: signed })
    ).toLowerCase(),
    account.address.toLowerCase(),
  );
  assert.equal(parseTransaction(signed).value ?? 0n, 0n);
  for (const change of [
    { chainId: 100 },
    { to: account.address },
    { value: "1" },
    { gas: "15000001" },
    { gasPrice: "10000000001" },
    { nonce: -1 },
    {
      data: encodeFunctionData({
        abi: deployment.abi,
        functionName: "withdraw",
        args: [account.address],
      }),
    },
  ])
    await assert.rejects(signer.sign({ ...input, ...change }), {
      code: "signer_policy_rejected",
    });
  store.close();
});

test("replacements reserve only increased gas cost and cancellation cannot send funds", async () => {
  const { store, signer } = fixture();
  const original = await signer.sign(input);
  assert.equal(await signer.sign(input), original);
  await signer.sign({ ...input, gasPrice: "1125000001" });
  await assert.rejects(
    signer.sign({
      ...input,
      data: encodeFunctionData({
        abi: deployment.abi,
        functionName: "claim",
        args: [2n, receipt, receipt],
      }),
    }),
    { code: "signer_nonce_conflict" },
  );
  const cancellation = {
    ...input,
    to: account.address,
    data: "0x",
    gas: "21000",
    gasPrice: "1300000000",
  };
  await signer.sign(cancellation);
  await assert.rejects(signer.sign({ ...cancellation, nonce: 10 }), {
    code: "signer_unknown_cancellation",
  });
  await assert.rejects(signer.sign({ ...cancellation, value: "1" }), {
    code: "signer_policy_rejected",
  });
  await assert.rejects(signer.sign(input), { code: "signer_nonce_conflict" });
  await signer.sign({ ...input, nonce: 1 });
  await assert.rejects(signer.sign({ ...input, nonce: 2 }), {
    code: "relay_daily_budget_exhausted",
  });
  store.close();
});
