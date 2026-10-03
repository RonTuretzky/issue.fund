import fs from "node:fs";
import { createHash } from "node:crypto";
import {
  encodeDeployData,
  getContractAddress,
  isAddress,
  keccak256,
  parseEther,
  parseTransaction,
  recoverTransactionAddress,
  zeroAddress,
} from "viem";
import { artifact, dkimKey, exportManifest } from "./gnosis-manifest.mjs";

const same = (a, b) => a?.toLowerCase() === b?.toLowerCase();
const asJson = (value) =>
  JSON.stringify(value, (_, item) =>
    typeof item === "bigint" ? `${item}` : item,
  );

export function assertRsaDeploymentTerms({ deployer, feeRecipient, feeBps }) {
  if (
    !isAddress(deployer) ||
    same(deployer, zeroAddress) ||
    !isAddress(feeRecipient) ||
    same(feeRecipient, zeroAddress)
  )
    throw Error("Explicit nonzero deployer and fee recipient are required");
  if (!Number.isInteger(feeBps) || feeBps < 1 || feeBps > 500)
    throw Error("Fee must be between 1 and 500 basis points");
}

function deployData(name, args) {
  const a = artifact(name);
  return encodeDeployData({ abi: a.abi, bytecode: a.bytecode.object, args });
}

function transactionShape({ chainId, data, nonce, gas, gasPrice }) {
  return { chainId, data, nonce, gas, gasPrice, value: 0n, type: "legacy" };
}

export async function planRsaDeployment(client, terms) {
  assertRsaDeploymentTerms(terms);
  if ((await client.getChainId()) !== 100) throw Error("Gnosis chain 100 required");
  if (keccak256(dkimKey.modulus) !== dkimKey.keyHash)
    throw Error("Pinned GitHub DKIM key hash is inconsistent");
  const [latest, pending, price, balance] = await Promise.all([
    client.getTransactionCount({ address: terms.deployer, blockTag: "latest" }),
    client.getTransactionCount({ address: terms.deployer, blockTag: "pending" }),
    client.getGasPrice(),
    client.getBalance({ address: terms.deployer }),
  ]);
  if (latest !== pending) throw Error("Deployer has a pending transaction");
  const verifierData = deployData("GithubDkimVerifier", [dkimKey.modulus]);
  const verifier = getContractAddress({ from: terms.deployer, nonce: BigInt(latest) });
  const escrowData = deployData("MergeBounty", [verifier, terms.feeRecipient, BigInt(terms.feeBps)]);
  const escrow = getContractAddress({ from: terms.deployer, nonce: BigInt(latest + 1) });
  // MergeBounty's constructor calls verifier.keyHash(), so the escrow cannot be
  // gas-estimated until the verifier transaction has created code at its address.
  // The execute path signs and persists the verifier first, then estimates the
  // escrow against the live verifier before signing that second transaction.
  const verifierEstimate = await client.estimateGas({ account: terms.deployer, data: verifierData });
  const gasPrice = (price * 125n + 99n) / 100n;
  const verifierGas = (verifierEstimate * 120n + 99n) / 100n;
  const maximumGasCost = verifierGas * gasPrice;
  if (verifierGas > 10_000_000n || gasPrice > 10_000_000_000n || maximumGasCost > parseEther("0.05"))
    throw Error("Deployment exceeds the 0.05 native coin or gas limits");
  if (balance < maximumGasCost + parseEther("0.001"))
    throw Error("Deployer needs deployment gas plus a 0.001 native coin reserve");
  const verifierTransaction = transactionShape({ chainId: 100, data: verifierData, nonce: latest, gas: verifierGas, gasPrice });
  const identity = {
    chainId: 100,
    deployer: terms.deployer.toLowerCase(),
    verifier,
    contract: escrow,
    keyHash: dkimKey.keyHash,
    feeRecipient: terms.feeRecipient.toLowerCase(),
    feeBps: terms.feeBps,
    creationHash: keccak256(escrowData),
  };
  return {
    identity,
    fingerprint: createHash("sha256").update(asJson(identity)).digest("hex"),
    verifier,
    contract: escrow,
    verifierTransaction,
    escrowData,
    verifierGas,
    gasPrice,
    maximumGasCost,
  };
}

async function validateSigned(signed, expected, from) {
  const tx = parseTransaction(signed);
  return (
    tx.to === undefined &&
    tx.data === expected.data &&
    tx.chainId === expected.chainId &&
    tx.nonce === BigInt(expected.nonce) &&
    tx.gas === expected.gas &&
    tx.gasPrice === expected.gasPrice &&
    (tx.value ?? 0n) === 0n &&
    same(await recoverTransactionAddress({ serializedTransaction: signed }), from)
  );
}

async function sendAndConfirm(client, signed, hash, nonce, confirmations) {
  let receipt;
  try {
    receipt = await client.getTransactionReceipt({ hash });
  } catch (error) {
    if (error.name !== "TransactionReceiptNotFoundError") throw error;
  }
  if (!receipt) {
    const latest = await client.getTransactionCount({ address: await recoverTransactionAddress({ serializedTransaction: signed }), blockTag: "latest" });
    if (latest > nonce) throw Error("Deployment nonce was used without the saved receipt");
    const actual = await client.sendRawTransaction({ serializedTransaction: signed });
    if (actual !== hash) throw Error("RPC returned a different deployment hash");
  }
  receipt = await client.waitForTransactionReceipt({ hash, confirmations, pollingInterval: 1000, timeout: 180000 });
  if (receipt.status !== "success") throw Error("Deployment transaction failed");
  return receipt;
}

export async function resumeRsaDeployment({ client, account, terms, load, save, confirmations = 12 }) {
  assertRsaDeploymentTerms(terms);
  let checkpoint = load();
  let plan;
  if (checkpoint) {
    if (!same(account.address, terms.deployer)) throw Error("Signing key does not match the expected deployer");
    const verifierData = deployData("GithubDkimVerifier", [dkimKey.modulus]);
    const escrowData = deployData("MergeBounty", [checkpoint.verifier, terms.feeRecipient, BigInt(terms.feeBps)]);
    const signedVerifier = `0x${checkpoint.signedVerifier}`.replace(/^0x0x/, "0x");
    const verifierTx = parseTransaction(signedVerifier);
    const identity = {
      chainId: 100,
      deployer: terms.deployer.toLowerCase(),
      verifier: checkpoint.verifier,
      contract: checkpoint.contract,
      keyHash: dkimKey.keyHash,
      feeRecipient: terms.feeRecipient.toLowerCase(),
      feeBps: terms.feeBps,
      creationHash: keccak256(escrowData),
    };
    const fingerprint = createHash("sha256").update(asJson(identity)).digest("hex");
    plan = {
      identity,
      fingerprint,
      verifier: checkpoint.verifier,
      contract: checkpoint.contract,
      transactions: [
        transactionShape({ chainId: 100, data: verifierData, nonce: Number(verifierTx.nonce), gas: verifierTx.gas, gasPrice: verifierTx.gasPrice }),
      ],
    };
    if (checkpoint.fingerprint !== plan.fingerprint || !(await validateSigned(signedVerifier, plan.transactions[0], terms.deployer)))
      throw Error("Saved RSA deployment transactions do not match the approved plan");
    checkpoint.signedVerifier = signedVerifier;
  } else {
    plan = await planRsaDeployment(client, terms);
    if (!same(account.address, terms.deployer)) throw Error("Signing key does not match the expected deployer");
    const signedVerifier = await account.signTransaction(plan.verifierTransaction);
    checkpoint = {
      version: 1,
      fingerprint: plan.fingerprint,
      verifier: plan.verifier,
      contract: plan.contract,
      verifierHash: keccak256(signedVerifier),
      signedVerifier,
    };
    save(checkpoint);
  }
  const verifierTx = parseTransaction(checkpoint.signedVerifier);
  const verifierReceipt = await sendAndConfirm(client, checkpoint.signedVerifier, checkpoint.verifierHash, Number(verifierTx.nonce), confirmations);
  if (!checkpoint.signedEscrow) {
    const escrowData = deployData("MergeBounty", [checkpoint.verifier, terms.feeRecipient, BigInt(terms.feeBps)]);
    const [price, balance] = await Promise.all([
      client.getGasPrice(),
      client.getBalance({ address: terms.deployer }),
    ]);
    const gasPrice = (price * 125n + 99n) / 100n;
    const estimate = await client.estimateGas({ account: terms.deployer, data: escrowData });
    const gas = (estimate * 120n + 99n) / 100n;
    if (gas > 10_000_000n || gasPrice > 10_000_000_000n || gas * gasPrice > parseEther("0.05") || balance < gas * gasPrice + parseEther("0.001"))
      throw Error("Escrow deployment exceeds the native coin or gas limits");
    const escrowTransaction = transactionShape({ chainId: 100, data: escrowData, nonce: Number(verifierTx.nonce) + 1, gas, gasPrice });
    const signedEscrow = await account.signTransaction(escrowTransaction);
    checkpoint.escrowHash = keccak256(signedEscrow);
    checkpoint.signedEscrow = signedEscrow;
    save(checkpoint);
  }
  const escrowTx = parseTransaction(checkpoint.signedEscrow);
  const escrowReceipt = await sendAndConfirm(client, checkpoint.signedEscrow, checkpoint.escrowHash, Number(escrowTx.nonce), confirmations);
  if (!same(verifierReceipt.contractAddress, plan.verifier) || !same(escrowReceipt.contractAddress, plan.contract))
    throw Error("Deployment addresses do not match the approved plan");
  const v = artifact("GithubDkimVerifier"), e = artifact("MergeBounty");
  const verifierCode = await client.getCode({ address: plan.verifier });
  const escrowCode = await client.getCode({ address: plan.contract });
  if (verifierCode !== undefined && !verifierCode) throw Error("Verifier has no runtime code");
  if (escrowCode !== undefined && !escrowCode) throw Error("Escrow has no runtime code");
  const read = (functionName) => client.readContract({ address: plan.contract, abi: e.abi, functionName });
  if (!(await client.readContract({ address: plan.verifier, abi: v.abi, functionName: "modulus" }) === dkimKey.modulus)) throw Error("Verifier modulus mismatch");
  if (Number(await read("feeBps")) !== terms.feeBps || !same(await read("feeRecipient"), terms.feeRecipient) || !same(await read("initialFeeRecipient"), terms.feeRecipient) || !same(await read("owner"), terms.feeRecipient) || !same(await read("verifier"), plan.verifier)) throw Error("Escrow deployment terms mismatch");
  checkpoint.blockNumber = Number(escrowReceipt.blockNumber);
  checkpoint.blockHash = escrowReceipt.blockHash;
  save(checkpoint);
  const manifest = await exportManifest(client, plan.contract, plan.verifier, [checkpoint.verifierHash, checkpoint.escrowHash]);
  return { manifest, checkpoint };
}
