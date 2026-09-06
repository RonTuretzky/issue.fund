import fs from "node:fs";
import { createHash } from "node:crypto";
import { createPublicClient, http } from "viem";
const broadcast = JSON.parse(
  fs.readFileSync("broadcast/Deploy.s.sol/100/run-latest.json", "utf8"),
);
const creations = broadcast.transactions.filter(
  (t) => t.transactionType === "CREATE",
);
const verifier = creations.find(
  (t) => t.contractName === "Groth16Verifier",
)?.contractAddress;
const contract = creations.find(
  (t) => t.contractName === "MergeBounty",
)?.contractAddress;
if (!verifier || !contract || Number(broadcast.chain) !== 100)
  throw new Error("Missing Gnosis deployment broadcast.");
const artifact = JSON.parse(
  fs.readFileSync("out/MergeBounty.sol/MergeBounty.json", "utf8"),
);
const verifierArtifact = JSON.parse(
  fs.readFileSync("out/ReceiptVerifier.sol/Groth16Verifier.json", "utf8"),
);
const client = createPublicClient({
  transport: http("https://rpc.gnosischain.com"),
});
for (const t of creations) {
  const r = await client.getTransactionReceipt({ hash: t.hash });
  if (
    r.status !== "success" ||
    r.contractAddress.toLowerCase() !== t.contractAddress.toLowerCase()
  )
    throw new Error("Deployment receipt mismatch.");
}
if (
  (await client.getCode({ address: verifier })).toLowerCase() !==
  verifierArtifact.deployedBytecode.object.toLowerCase()
)
  throw new Error("Live verifier differs from the tested verifier.");
const read = (functionName) =>
  client.readContract({ address: contract, abi: artifact.abi, functionName });
if ((await read("verifier")).toLowerCase() !== verifier.toLowerCase())
  throw new Error("Escrow verifier mismatch.");
const keyHash = String(await read("githubKeyHash"));
const digest = (p) =>
  createHash("sha256").update(fs.readFileSync(p)).digest("hex");
const manifest = {
  chainId: 100,
  chainName: "Gnosis",
  currency: "xDAI",
  rpcUrl: "https://rpc.gnosischain.com",
  explorerUrl: "https://gnosisscan.io",
  contract,
  verifier,
  keyHash,
  developmentCeremony: true,
  local: false,
  deployedAt: new Date().toISOString(),
  deploymentTransactions: creations.map((t) => t.hash),
  verificationKeySha256: digest("artifacts/verification-key.json"),
  verifierSourceSha256: digest("contracts/ReceiptVerifier.sol"),
  etherformCommit: "180aa91926a02ce2045f9a7e3ed08be9395ecfab",
  abi: artifact.abi,
};
fs.writeFileSync(
  "public/deployment.gnosis.json",
  JSON.stringify(manifest, null, 2) + "\n",
);
fs.writeFileSync(
  ".local/deployment.gnosis.json",
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log({
  contract,
  verifier,
  chainId: 100,
  keyHash,
  transactions: manifest.deploymentTransactions,
});
