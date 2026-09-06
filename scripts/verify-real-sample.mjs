import fs from "node:fs";
import assert from "node:assert/strict";
import { groth16 } from "snarkjs";
import { createPublicClient, http } from "viem";
const d = JSON.parse(fs.readFileSync(".local/deployment.json", "utf8"));
const vk = JSON.parse(
  fs.readFileSync("artifacts/verification-key.json", "utf8"),
);
console.log("Proving the previously captured, genuine GitHub DKIM witness…");
const started = Date.now();
const { proof, publicSignals } = await groth16.prove(
  "artifacts/Receipt.zkey",
  ".local/sample.wtns",
);
assert.equal(await groth16.verify(vk, publicSignals, proof), true);
const [a, b, c, signals] = JSON.parse(
  `[${await groth16.exportSolidityCallData(proof, publicSignals)}]`,
);
const client = createPublicClient({ transport: http("http://127.0.0.1:8547") });
const abi = JSON.parse(
  fs.readFileSync("out/ReceiptVerifier.sol/Groth16Verifier.json", "utf8"),
).abi;
assert.equal(
  await client.readContract({
    address: d.verifier,
    abi,
    functionName: "verifyProof",
    args: [a, b, c, signals],
  }),
  true,
);
const changed = [...signals];
changed[1] = (BigInt(changed[1]) ^ 1n).toString();
assert.equal(
  await client.readContract({
    address: d.verifier,
    abi,
    functionName: "verifyProof",
    args: [a, b, c, changed],
  }),
  false,
);
fs.writeFileSync(
  ".local/real-dkim-sample-proof.json",
  JSON.stringify({ a, b, c, signals }, null, 2),
);
const result = {
  testedAt: new Date().toISOString(),
  realGitHubSignature: true,
  witnessConstraintsChecked: true,
  groth16VerifiedOffchain: true,
  groth16VerifiedOnchain: true,
  alteredDisclosureRejectedOnchain: true,
  publicSignals: publicSignals.length,
  provingSeconds: Math.round((Date.now() - started) / 1000),
  verifier: d.verifier,
  scope:
    "Verifies the existing PR #2 receipt cryptographically; a new receipt pair with the funded bounty reference is still required for the escrow payout test.",
};
fs.writeFileSync(
  ".local/real-dkim-verifier-report.json",
  JSON.stringify(result, null, 2),
);
console.log(result);
process.exit(0);
