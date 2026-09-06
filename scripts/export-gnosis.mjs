import fs from "node:fs";
import { createPublicClient, http } from "viem";
import { exportManifest } from "./gnosis-manifest.mjs";
const b = JSON.parse(
  fs.readFileSync("broadcast/Deploy.s.sol/100/run-latest.json", "utf8"),
);
const creations = b.transactions.filter((t) => t.transactionType === "CREATE");
const verifier = creations.find(
  (t) => t.contractName === "GithubDkimVerifier",
)?.contractAddress;
const contract = creations.find(
  (t) => t.contractName === "MergeBounty",
)?.contractAddress;
if (!verifier || !contract || Number(b.chain) !== 100)
  throw Error("Missing direct-DKIM Gnosis deployment");
await exportManifest(
  createPublicClient({ transport: http("https://rpc.gnosischain.com") }),
  contract,
  verifier,
  creations.map((t) => t.hash),
);
console.log({ contract, verifier, protocol: "rsa-dkim-v1" });
