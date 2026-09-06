import { spawn } from "node:child_process";
import { mkdirSync, existsSync, writeFileSync, renameSync } from "node:fs";
import { randomBytes } from "node:crypto";
mkdirSync("artifacts", { recursive: true });
const completed = [
  "artifacts/Receipt.zkey",
  "artifacts/verification-key.json",
  "artifacts/setup-metadata.json",
];
if (
  completed.every(existsSync) &&
  existsSync("contracts/ReceiptVerifier.sol")
) {
  console.log("Proof setup already exists. Reusing it; no keys were replaced.");
  process.exit(0);
}
if (completed.some(existsSync)) {
  throw new Error(
    "Incomplete proof setup found. Preserve existing keys and recover the failed step before running setup again.",
  );
}
const run = (args) =>
  new Promise((resolve, reject) => {
    const p = spawn(
      process.execPath,
      [
        "--max-old-space-size=65536",
        "node_modules/snarkjs/build/cli.cjs",
        ...args,
      ],
      { stdio: "inherit" },
    );
    p.on("exit", (c) =>
      c === 0
        ? resolve()
        : reject(
            new Error(`Setup step ${args.slice(0, 2).join(" ")} failed: ${c}`),
          ),
    );
  });
// A local development ceremony, never represented as production MPC. Supply a
// verified community PTAU using MERGEBOUNTY_PTAU for an independent ceremony.
let ptau = process.env.MERGEBOUNTY_PTAU;
if (!ptau) {
  ptau = "artifacts/dev-pot23-final.ptau";
  if (!existsSync(ptau)) {
    await run([
      "powersoftau",
      "new",
      "bn128",
      "23",
      "artifacts/dev-pot23-0.ptau",
    ]);
    await run([
      "powersoftau",
      "contribute",
      "artifacts/dev-pot23-0.ptau",
      "artifacts/dev-pot23-1.ptau",
      "--name=Local development only",
      `-e=${randomBytes(64).toString("hex")}`,
    ]);
    await run([
      "powersoftau",
      "prepare",
      "phase2",
      "artifacts/dev-pot23-1.ptau",
      `${ptau}.partial`,
      "-v",
    ]);
    renameSync(`${ptau}.partial`, ptau);
  }
}
await run([
  "groth16",
  "setup",
  "artifacts/Receipt.r1cs",
  ptau,
  "artifacts/Receipt-0.zkey",
]);
await run([
  "zkey",
  "contribute",
  "artifacts/Receipt-0.zkey",
  "artifacts/Receipt.zkey",
  "--name=Local circuit development",
  `-e=${randomBytes(64).toString("hex")}`,
]);
await run([
  "zkey",
  "export",
  "verificationkey",
  "artifacts/Receipt.zkey",
  "artifacts/verification-key.json",
]);
await run([
  "zkey",
  "export",
  "solidityverifier",
  "artifacts/Receipt.zkey",
  "contracts/ReceiptVerifier.sol",
]);
writeFileSync(
  "artifacts/setup-metadata.json",
  JSON.stringify(
    {
      developmentCeremony: true,
      phase1Origin: process.env.MERGEBOUNTY_PTAU
        ? "externally supplied"
        : "local development",
      phase2Origin: "local development",
      completedAt: new Date().toISOString(),
      ptau,
    },
    null,
    2,
  ),
);
