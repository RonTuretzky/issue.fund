// Promote only a verified deployment, preserving original links and escrow history.
import fs from "node:fs";
import { createPublicClient, http } from "viem";
import { verifyLegacy } from "./v2-deployment.mjs";
const candidate = JSON.parse(fs.readFileSync(".local/v2-release.json", "utf8"));
const current = JSON.parse(
  fs.readFileSync("public/deployment.gnosis.json", "utf8"),
);
if (candidate.protocol !== "rsa-dkim-v2" || candidate.chainId !== 100)
  throw Error("Expected Gnosis V2 candidate");
if (
  ![current, ...(current.legacyDeployments ?? [])].every((old) =>
    [candidate, ...(candidate.legacyDeployments ?? [])].some(
      (next) => next.contract.toLowerCase() === old.contract.toLowerCase(),
    ),
  ) ||
  candidate.legacyLinkContract.toLowerCase() !==
    (current.legacyLinkContract ?? current.contract).toLowerCase()
)
  throw Error(
    "Candidate loses the existing deployment or original bounty links",
  );
const client = createPublicClient({
  transport: http(candidate.rpcUrl, { retryCount: 0 }),
});
await verifyLegacy(client, candidate);
const receipt = await client.getTransactionReceipt({
  hash: candidate.deploymentTransactions[0],
});
if (
  receipt.status !== "success" ||
  receipt.contractAddress?.toLowerCase() !== candidate.contract.toLowerCase() ||
  Number(receipt.blockNumber) !== candidate.fromBlock ||
  (await client.getBlockNumber()) < receipt.blockNumber + 11n
)
  throw Error("Candidate deployment lacks 12 confirmed blocks");
const block = await client.getBlock({ blockNumber: receipt.blockNumber });
if (block.hash !== receipt.blockHash) throw Error("Deployment block changed");
const flat = [candidate, ...candidate.legacyDeployments].map((d) => {
  const { legacyDeployments, legacyLinkContract, ...rest } = d;
  return rest;
});
for (const d of flat) {
  if (!Number.isSafeInteger(d.fromBlock)) {
    const r = await client.getTransactionReceipt({
      hash: d.deploymentTransactions.at(-1),
    });
    if (r.contractAddress?.toLowerCase() !== d.contract.toLowerCase())
      throw Error("Cannot find the legacy deployment block");
    d.fromBlock = Number(r.blockNumber);
  }
}
const output = JSON.stringify(candidate, null, 2) + "\n";
fs.writeFileSync("public/deployment.gnosis.json", output);
fs.writeFileSync("deployments/gnosis/deployment.json", output);
fs.writeFileSync("deployments/gnosis/v2-deployment.json", output);
fs.writeFileSync(
  ".local/automation-deployments.json",
  JSON.stringify(flat, null, 2) + "\n",
);
console.log(
  "Verified V2 manifest promoted locally with all legacy escrows. Deploy the service manifests, then build and publish Pages.",
);
