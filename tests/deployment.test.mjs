import test from "node:test";
import assert from "node:assert/strict";
import { parseEther, keccak256 } from "viem";
import { isolatedAnvil } from "./helpers/anvil.mjs";
import { signer } from "./helpers/receipts.mjs";
import { artifact } from "../scripts/gnosis-manifest.mjs";
import { verifyDeployments } from "../automation/config.mjs";
import {
  planDeployment,
  resumeDeployment,
  verifyLegacy,
  assertTerms,
} from "../scripts/v2-deployment.mjs";

test("V2 deployment recovers a lost response once, verifies fees, and preserves legacy funding and links", async () => {
  const chain = await isolatedAnvil();
  const { client, wallet, accounts } = chain;
  try {
    const s = signer();
    const deploy = async (name, args) => {
      const a = artifact(name);
      const hash = await wallet.deployContract({
        abi: a.abi,
        bytecode: a.bytecode.object,
        args,
      });
      return client.waitForTransactionReceipt({ hash });
    };
    const v = await deploy("GithubDkimVerifier", [s.key.modulus]);
    const old = await deploy("MergeBounty", [v.contractAddress]);
    const legacy = {
      chainId: 31337,
      protocol: "rsa-dkim-v1",
      contract: old.contractAddress,
      verifier: v.contractAddress,
      keyHash: s.key.keyHash,
      dkimKey: s.key,
      abi: artifact("MergeBounty").abi,
      fromBlock: Number(old.blockNumber),
      deploymentTransactions: [old.transactionHash],
    };
    const deadline = (await client.getBlock()).timestamp + 3600n;
    await wallet.writeContract({
      address: legacy.contract,
      abi: legacy.abi,
      functionName: "create",
      args: ["example/parser", 42n, "main", deadline],
      value: parseEther("1"),
    });
    const terms = {
      legacy,
      deployer: accounts[0].address,
      feeRecipient: accounts[2].address,
      feeBps: 100,
    };
    const before = await client.getTransactionCount({
      address: accounts[0].address,
    });
    const plan = await planDeployment(client, terms);
    assert.equal(
      await client.getTransactionCount({ address: accounts[0].address }),
      before,
      "planning sends no transaction",
    );
    assert.equal(plan.identity.feeBps, 100);
    let checkpoint;
    let sent = 0;
    const unreliable = new Proxy(client, {
      get(target, name) {
        if (name === "sendRawTransaction")
          return async (args) => {
            assert.ok(checkpoint.signed, "checkpoint precedes broadcast");
            sent++;
            await target.sendRawTransaction(args);
            throw Error("lost deployment response");
          };
        return target[name];
      },
    });
    const options = {
      account: accounts[0],
      terms,
      load: () => checkpoint,
      save: (x) => (checkpoint = structuredClone(x)),
      confirmations: 1,
    };
    await assert.rejects(
      resumeDeployment({ ...options, client: unreliable }),
      /lost deployment response/,
    );
    const result = await resumeDeployment({ ...options, client });
    assert.equal(sent, 1);
    assert.equal(
      await client.getTransactionCount({ address: accounts[0].address }),
      before + 1,
    );
    assert.equal(result.manifest.contract, plan.contract);
    assert.equal(result.manifest.feeBps, 100);
    assert.equal(result.manifest.legacyLinkContract, legacy.contract);
    assert.equal(
      result.manifest.legacyDeployments[0].contract,
      legacy.contract,
    );
    assert.equal(
      await client.getBalance({ address: legacy.contract }),
      parseEther("1"),
    );
    assert.equal(
      (
        await client.readContract({
          address: result.manifest.contract,
          abi: result.manifest.abi,
          functionName: "feeRecipient",
        })
      ).toLowerCase(),
      accounts[2].address.toLowerCase(),
    );
    await verifyLegacy(client, result.manifest);
    assert.equal(
      (
        await client.readContract({
          address: result.manifest.contract,
          abi: result.manifest.abi,
          functionName: "owner",
        })
      ).toLowerCase(),
      accounts[2].address.toLowerCase(),
    );
    await assert.rejects(
      resumeDeployment({
        ...options,
        client,
        terms: { ...terms, feeBps: 200 },
      }),
      /checkpoint does not match/,
    );
    const saved = structuredClone(checkpoint);
    checkpoint.signed = await accounts[0].signTransaction({
      chainId: 31337,
      nonce: checkpoint.nonce,
      data: "0x",
      gas: 21000n,
      gasPrice: 1n,
      type: "legacy",
    });
    checkpoint.hash = keccak256(checkpoint.signed);
    await assert.rejects(
      resumeDeployment({ ...options, client }),
      /Saved deployment transaction/,
    );
    checkpoint = saved;
    await assert.rejects(
      resumeDeployment({ ...options, client, account: accounts[1] }),
      /Signing key does not match/,
    );
    await assert.rejects(
      verifyLegacy(client, { ...result.manifest, feeBps: 200 }),
      /Legacy fee mismatch/,
    );
    const change = await wallet.writeContract({
      account: accounts[2],
      address: result.manifest.contract,
      abi: result.manifest.abi,
      functionName: "setFeeRecipient",
      args: [accounts[1].address],
    });
    await client.waitForTransactionReceipt({ hash: change });
    await verifyLegacy(client, result.manifest);
    await verifyDeployments(client, [result.manifest]);
    assert.equal(
      await client.readContract({
        address: result.manifest.contract,
        abi: result.manifest.abi,
        functionName: "initialFeeRecipient",
      }),
      accounts[2].address,
    );
  } finally {
    await chain.close();
  }
});

test("invalid or missing fee terms cannot reach deployment planning", () => {
  const base = {
    feeRecipient: "0x1111111111111111111111111111111111111111",
    deployer: "0x2222222222222222222222222222222222222222",
    feeBps: 100,
    legacy: { protocol: "rsa-dkim-v1", chainId: 100 },
  };
  assert.doesNotThrow(() => assertTerms(base));
  for (const overrides of [
    { feeRecipient: undefined },
    { deployer: undefined },
    { feeBps: 0 },
    { feeBps: 501 },
    { feeBps: 1.5 },
  ])
    assert.throws(() => assertTerms({ ...base, ...overrides }));
  assert.throws(
    () =>
      assertTerms({
        ...base,
        legacy: { ...base.legacy, legacyDeployments: Array(9).fill({}) },
      }),
    /ten-escrow limit/,
  );
});
