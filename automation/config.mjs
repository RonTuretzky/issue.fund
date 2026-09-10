import { readFileSync, statSync } from "node:fs";
import { isAddress, keccak256 } from "viem";
import { fail } from "./errors.mjs";

export function readSecret(path) {
  if (!path) fail("secret_file_missing");
  const stat = statSync(path);
  if (!stat.isFile() || (stat.mode & 0o077) !== 0)
    fail("secret_file_permissions");
  return readFileSync(path, "utf8").trim();
}
export function keyFile(path) {
  const value = readSecret(path);
  if (!/^[0-9a-f]{64}$/i.test(value)) fail("encryption_key_invalid");
  return Buffer.from(value, "hex");
}
export function loadDeployments(path) {
  const data = JSON.parse(readFileSync(path, "utf8"));
  const deployments = Array.isArray(data) ? data : [data];
  if (!deployments.length || deployments.length > 10)
    fail("deployment_configuration_invalid");
  for (const d of deployments) {
    if (
      ![100, 31337].includes(d.chainId) ||
      !isAddress(d.contract) ||
      !isAddress(d.verifier) ||
      !Number.isSafeInteger(d.fromBlock) ||
      d.fromBlock < 0 ||
      !Array.isArray(d.abi) ||
      d.keyHash !== keccak256(d.dkimKey.modulus)
    )
      fail("deployment_configuration_invalid");
  }
  if (new Set(deployments.map((d) => d.chainId)).size !== 1)
    fail("one_chain_per_service_required");
  return deployments;
}
export async function verifyDeployments(client, deployments) {
  for (const d of deployments) {
    if ((await client.getChainId()) !== d.chainId) fail("chain_mismatch");
    const read = (functionName) =>
      client.readContract({ address: d.contract, abi: d.abi, functionName });
    if (
      (await read("githubKeyHash")) !== d.keyHash ||
      (await read("verifier")).toLowerCase() !== d.verifier.toLowerCase()
    )
      fail("deployment_verifier_mismatch");
    if (
      d.runtimeHash &&
      keccak256(await client.getCode({ address: d.contract })) !== d.runtimeHash
    )
      fail("deployment_runtime_mismatch");
    if (d.protocol === "rsa-dkim-v2") {
      if (
        (await read("initialFeeRecipient")).toLowerCase() !==
          (d.initialFeeRecipient ?? d.feeRecipient).toLowerCase() ||
        Number(await read("feeBps")) !== d.feeBps
      )
        fail("deployment_fee_mismatch");
    }
  }
}
export function readValidation(path, mailbox) {
  if (!path) return null;
  const data = JSON.parse(readFileSync(path, "utf8"));
  const required = [
    "direct_delivery",
    "forged_recipient_rejected",
    "forwarded_replay_rejected",
    "issue_reply_blocked",
    "pr_reply_blocked",
    "owner_exemption_rejected",
    "unlock_risk_verified",
    "genuine_pair_claimed",
  ];
  if (
    data.version !== 1 ||
    data.collectorId !== mailbox.githubId ||
    data.mailHost !== mailbox.host ||
    data.mailAddress !== mailbox.address ||
    !required.every(
      (name) =>
        data.tests?.[name]?.passed === true &&
        /^https:\/\/github.com\//.test(data.tests[name].evidence ?? ""),
    )
  )
    fail("disclosure_validation_incomplete");
  return keccak256(Buffer.from(JSON.stringify(data)));
}
