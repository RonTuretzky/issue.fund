import { mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
mkdirSync("artifacts", { recursive: true });
const r = spawnSync(
  "circom",
  [
    "circuits/Receipt.circom",
    "--r1cs",
    "--wasm",
    "--sym",
    "--O1",
    "-l",
    "node_modules",
    "-o",
    "artifacts",
  ],
  { stdio: "inherit" },
);
if (r.status === 0)
  writeFileSync(
    "artifacts/Receipt_js/package.json",
    JSON.stringify({ type: "commonjs" }),
  );
process.exit(r.status ?? 1);
