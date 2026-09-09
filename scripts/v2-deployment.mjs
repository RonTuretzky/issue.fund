import { createHash } from "node:crypto";
import {
  encodeDeployData,
  getContractAddress,
  isAddress,
  keccak256,
  parseEther,
  zeroAddress,
  parseTransaction,
  recoverTransactionAddress,
} from "viem";
import { artifact, normalize } from "./gnosis-manifest.mjs";

const same = (a, b) => a?.toLowerCase() === b?.toLowerCase();
export async function verifyRuntime(client, address, name) {
  const a = artifact(name),
    code = await client.getCode({ address });
  if (
    !code ||
    normalize(code, a.deployedBytecode.immutableReferences) !==
      normalize(
        a.deployedBytecode.object,
        a.deployedBytecode.immutableReferences,
      )
  )
    throw Error(`${name} runtime differs from the compiled source`);
  return keccak256(code);
}
export function assertTerms({ feeRecipient, feeBps, deployer, legacy }) {
  if (
    !isAddress(feeRecipient) ||
    same(feeRecipient, zeroAddress) ||
    !isAddress(deployer) ||
    same(deployer, zeroAddress)
  )
    throw Error(
      "Explicit nonzero fee recipient and deployer addresses are required",
    );
  if (!Number.isInteger(feeBps) || feeBps < 1 || feeBps > 500)
    throw Error("Fee must be between 1 and 500 basis points");
  if (
    !["rsa-dkim-v1", "rsa-dkim-v2"].includes(legacy.protocol) ||
    ![100, 31337].includes(legacy.chainId)
  )
    throw Error("Unsupported legacy deployment");
  if ((legacy.legacyDeployments?.length ?? 0) >= 9)
    throw Error(
      "The new deployment would exceed the supported ten-escrow limit",
    );
}
export async function verifyLegacy(client, legacy) {
  if ((await client.getChainId()) !== legacy.chainId)
    throw Error("Chain mismatch");
  const list = [legacy, ...(legacy.legacyDeployments ?? [])];
  if (new Set(list.map((x) => x.contract.toLowerCase())).size !== list.length)
    throw Error("Duplicate legacy escrow");
  for (const d of list) {
    if (d.chainId !== legacy.chainId) throw Error("Mixed legacy chains");
    if (!["rsa-dkim-v1", "rsa-dkim-v2"].includes(d.protocol))
      throw Error("Unknown legacy protocol");
    const name = d.protocol === "rsa-dkim-v2" ? "MergeBountyV2" : "MergeBounty";
    const runtimeHash = await verifyRuntime(client, d.contract, name);
    if (d.runtimeHash && d.runtimeHash !== runtimeHash)
      throw Error("Legacy runtime hash mismatch");
    await verifyRuntime(client, d.verifier, "GithubDkimVerifier");
    const read = (functionName) =>
      client.readContract({
        address: d.contract,
        abi: artifact(name).abi,
        functionName,
      });
    const modulus = await client.readContract({
      address: d.verifier,
      abi: artifact("GithubDkimVerifier").abi,
      functionName: "modulus",
    });
    if (
      !same(await read("verifier"), d.verifier) ||
      (await read("githubKeyHash")) !== d.keyHash ||
      modulus !== d.dkimKey.modulus ||
      keccak256(modulus) !== d.keyHash
    )
      throw Error("Legacy verifier or key mismatch");
    if (
      d.protocol === "rsa-dkim-v2" &&
      (Number(await read("feeBps")) !== d.feeBps ||
        !same(await read("feeRecipient"), d.feeRecipient))
    )
      throw Error("Legacy fee mismatch");
  }
  return list;
}
export function deploymentIdentity(terms) {
  assertTerms(terms);
  const data = encodeDeployData({
    abi: artifact("MergeBountyV2").abi,
    bytecode: artifact("MergeBountyV2").bytecode.object,
    args: [terms.legacy.verifier, terms.feeRecipient, BigInt(terms.feeBps)],
  });
  const identity = {
    chainId: terms.legacy.chainId,
    deployer: terms.deployer.toLowerCase(),
    legacy: terms.legacy.contract.toLowerCase(),
    verifier: terms.legacy.verifier.toLowerCase(),
    keyHash: terms.legacy.keyHash,
    feeRecipient: terms.feeRecipient.toLowerCase(),
    feeBps: terms.feeBps,
    creationHash: keccak256(data),
  };
  return {
    data,
    identity,
    fingerprint: createHash("sha256")
      .update(JSON.stringify(identity))
      .digest("hex"),
  };
}
export async function planDeployment(client, terms) {
  assertTerms(terms);
  await verifyLegacy(client, terms.legacy);
  const { data, identity, fingerprint } = deploymentIdentity(terms);
  const [latest, pending, price, estimate, balance] = await Promise.all([
    client.getTransactionCount({ address: terms.deployer, blockTag: "latest" }),
    client.getTransactionCount({
      address: terms.deployer,
      blockTag: "pending",
    }),
    client.getGasPrice(),
    client.estimateGas({ account: terms.deployer, data }),
    client.getBalance({ address: terms.deployer }),
  ]);
  if (latest !== pending)
    throw Error(
      "Deployer has a pending transaction; resolve it before planning a new deployment",
    );
  const gas = (estimate * 120n + 99n) / 100n;
  const gasPrice = (price * 125n + 99n) / 100n;
  if (
    gas > 10_000_000n ||
    gasPrice > 10_000_000_000n ||
    gas * gasPrice > parseEther("0.05")
  )
    throw Error("Deployment exceeds the 0.05 native coin or gas limits");
  if (balance < gas * gasPrice + parseEther("0.001"))
    throw Error(
      "Deployer needs deployment gas plus a 0.001 native coin reserve",
    );
  const contract = getContractAddress({
    from: terms.deployer,
    nonce: BigInt(latest),
  });
  if (same(contract, terms.feeRecipient))
    throw Error("Fee recipient cannot be the new escrow");
  return {
    identity,
    fingerprint,
    contract,
    nonce: latest,
    gas: gas.toString(),
    gasPrice: gasPrice.toString(),
    maximumGasCost: (gas * gasPrice).toString(),
    transaction: {
      chainId: terms.legacy.chainId,
      data,
      nonce: latest,
      gas,
      gasPrice,
      value: 0n,
      type: "legacy",
    },
  };
}

export async function resumeDeployment({
  client,
  account,
  terms,
  load,
  save,
  confirmations = 12,
}) {
  const { fingerprint, identity, data } = deploymentIdentity(terms);
  if (!same(account.address, terms.deployer))
    throw Error("Signing key does not match the expected deployer");
  await verifyLegacy(client, terms.legacy);
  let checkpoint = load();
  if (checkpoint) {
    if (
      checkpoint.fingerprint !== fingerprint ||
      keccak256(checkpoint.signed) !== checkpoint.hash
    )
      throw Error(
        "Deployment checkpoint does not match the current source, fee, verifier or deployer",
      );
    const tx = parseTransaction(checkpoint.signed);
    if (
      tx.data !== data ||
      tx.chainId !== terms.legacy.chainId ||
      tx.to ||
      (tx.value ?? 0n) !== 0n ||
      tx.nonce !== checkpoint.nonce ||
      !same(
        await recoverTransactionAddress({
          serializedTransaction: checkpoint.signed,
        }),
        terms.deployer,
      ) ||
      !same(
        getContractAddress({ from: terms.deployer, nonce: BigInt(tx.nonce) }),
        checkpoint.contract,
      ) ||
      !tx.gas ||
      !tx.gasPrice ||
      tx.gas > 10_000_000n ||
      tx.gasPrice > 10_000_000_000n ||
      tx.gas * tx.gasPrice > parseEther("0.05")
    )
      throw Error(
        "Saved deployment transaction does not match its approved plan",
      );
  } else {
    const plan = await planDeployment(client, terms);
    const signed = await account.signTransaction(plan.transaction);
    checkpoint = {
      version: 1,
      identity,
      fingerprint,
      contract: plan.contract,
      nonce: plan.nonce,
      gas: plan.gas,
      gasPrice: plan.gasPrice,
      hash: keccak256(signed),
      signed,
    };
    // The signed transaction is durable before any broadcast; uncertain RPC errors
    // can only cause the same transaction to be resubmitted, never another deploy.
    save(checkpoint);
  }
  let receipt;
  try {
    receipt = await client.getTransactionReceipt({ hash: checkpoint.hash });
  } catch (error) {
    if (error.name !== "TransactionReceiptNotFoundError") throw error;
  }
  if (!receipt) {
    const latest = await client.getTransactionCount({
      address: terms.deployer,
      blockTag: "latest",
    });
    if (latest > checkpoint.nonce)
      throw Error(
        "Deployment nonce was used but its receipt is unavailable; reconcile the checkpoint before proceeding",
      );
    const actual = await client.sendRawTransaction({
      serializedTransaction: checkpoint.signed,
    });
    if (actual !== checkpoint.hash)
      throw Error("RPC returned a different deployment hash");
  }
  receipt = await client.waitForTransactionReceipt({
    hash: checkpoint.hash,
    confirmations,
    pollingInterval: 1000,
    timeout: 120000,
  });
  if (
    receipt.status !== "success" ||
    !same(receipt.contractAddress, checkpoint.contract)
  )
    throw Error("The expected escrow was not deployed successfully");
  const block = await client.getBlock({ blockNumber: receipt.blockNumber });
  if (block.hash !== receipt.blockHash)
    throw Error("Deployment receipt was reorganized");
  const runtimeHash = await verifyRuntime(
    client,
    checkpoint.contract,
    "MergeBountyV2",
  );
  const a = artifact("MergeBountyV2");
  const read = (functionName) =>
    client.readContract({
      address: checkpoint.contract,
      abi: a.abi,
      functionName,
    });
  if (
    Number(await read("feeBps")) !== terms.feeBps ||
    !same(await read("feeRecipient"), terms.feeRecipient) ||
    !same(await read("verifier"), terms.legacy.verifier) ||
    (await read("githubKeyHash")) !== terms.legacy.keyHash
  )
    throw Error("Deployed immutable terms mismatch");
  checkpoint.blockNumber = Number(receipt.blockNumber);
  checkpoint.blockHash = receipt.blockHash;
  checkpoint.runtimeHash = runtimeHash;
  save(checkpoint);
  const strip = (d) => {
    const { legacyDeployments, legacyLinkContract, ...rest } = d;
    return rest;
  };
  const legacyDeployments = [
    strip(terms.legacy),
    ...(terms.legacy.legacyDeployments ?? []).map(strip),
  ];
  const manifest = {
    ...strip(terms.legacy),
    protocol: "rsa-dkim-v2",
    contract: checkpoint.contract,
    abi: a.abi,
    feeBps: terms.feeBps,
    feeRecipient: terms.feeRecipient,
    fromBlock: checkpoint.blockNumber,
    runtimeHash,
    deployedAt: new Date().toISOString(),
    deploymentTransactions: [checkpoint.hash],
    legacyDeployments,
    legacyLinkContract:
      terms.legacy.legacyLinkContract ?? terms.legacy.contract,
  };
  return { manifest, checkpoint };
}
