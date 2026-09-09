import fs from "node:fs";
import { createHash } from "node:crypto";
import { keccak256 } from "viem";
export const dkimKey = JSON.parse(
  fs.readFileSync("public/github-dkim-key.json", "utf8"),
);
export const artifact = (name) =>
  JSON.parse(fs.readFileSync(`out/${name}.sol/${name}.json`, "utf8"));
export function normalize(code, references) {
  let hex = code.toLowerCase().replace(/^0x/, "");
  for (const refs of Object.values(references ?? {}))
    for (const { start, length } of refs)
      hex =
        hex.slice(0, start * 2) +
        "0".repeat(length * 2) +
        hex.slice((start + length) * 2);
  return hex;
}
export async function exportManifest(client, contract, verifier, transactions) {
  if ((await client.getChainId()) !== 100)
    throw Error("Gnosis chain 100 required");
  const e = artifact("MergeBounty"),
    v = artifact("GithubDkimVerifier");
  for (const [address, a] of [
    [contract, e],
    [verifier, v],
  ]) {
    const code = await client.getCode({ address });
    if (
      !code ||
      normalize(code, a.deployedBytecode.immutableReferences) !==
        normalize(
          a.deployedBytecode.object,
          a.deployedBytecode.immutableReferences,
        )
    )
      throw Error("Deployed runtime differs from the compiled source");
  }
  const read = (functionName) =>
    client.readContract({ address: contract, abi: e.abi, functionName });
  if (
    (await read("verifier")).toLowerCase() !== verifier.toLowerCase() ||
    (await read("githubKeyHash")) !== dkimKey.keyHash ||
    dkimKey.keyHash !== keccak256(dkimKey.modulus)
  )
    throw Error("Immutable verifier/key mismatch");
  if (
    (await client.readContract({
      address: verifier,
      abi: v.abi,
      functionName: "modulus",
    })) !== dkimKey.modulus
  )
    throw Error("RSA modulus mismatch");
  for (const hash of transactions) {
    if ((await client.getTransactionReceipt({ hash })).status !== "success")
      throw Error("Deployment transaction failed");
  }
  const manifest = {
    protocol: "rsa-dkim-v1",
    chainId: 100,
    chainName: "Gnosis",
    currency: "xDAI",
    rpcUrl: "https://rpc.gnosischain.com",
    explorerUrl: "https://gnosisscan.io",
    contract,
    verifier,
    keyHash: dkimKey.keyHash,
    dkimKey,
    experimental: true,
    local: false,
    deployedAt: new Date().toISOString(),
    deploymentTransactions: transactions,
    verifierSourceSha256: createHash("sha256")
      .update(fs.readFileSync("contracts/GithubDkimVerifier.sol"))
      .digest("hex"),
    etherformCommit: "180aa91926a02ce2045f9a7e3ed08be9395ecfab",
    abi: e.abi,
  };
  for (const file of [
    "public/deployment.gnosis.json",
    "deployments/gnosis/deployment.json",
    ".local/deployment.rsa.gnosis.json",
  ])
    fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + "\n");
  return manifest;
}
