import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
const source =
  process.env.MERGEBOUNTY_CIRCUIT_INPUT ?? ".local/sample-input.json";
if (!fs.existsSync(source))
  throw new Error(
    "Prepare a real receipt input first; set MERGEBOUNTY_CIRCUIT_INPUT to its private JSON path.",
  );
const valid = JSON.parse(fs.readFileSync(source, "utf8"));
const root = fs.mkdtempSync(path.resolve(".local/circuit-negative-"));
fs.chmodSync(root, 0o700);
const mutations = [
  [
    "altered RSA signature",
    (x) => {
      x.signature[0] = (BigInt(x.signature[0]) + 1n).toString();
    },
  ],
  [
    "altered signed subject",
    (x) => {
      const i = Number(x.subjectStart) + 20;
      x.emailHeader[i] = String(Number(x.emailHeader[i]) ^ 1);
    },
  ],
  [
    "altered event body",
    (x) => {
      x.emailBody[150] = String(Number(x.emailBody[150]) ^ 1);
    },
  ],
  [
    "unproven SHA prefix state",
    (x) => {
      x.precomputedSHA[0] = "0";
    },
  ],
  [
    "truncated DKIM disclosure",
    (x) => {
      x.dkimLength = String(Number(x.dkimLength) - 1);
    },
  ],
];
const results = [];
try {
  for (const [name, mutate] of mutations) {
    const x = structuredClone(valid);
    mutate(x);
    const input = path.join(root, "input.json"),
      witness = path.join(root, "witness.wtns");
    fs.writeFileSync(input, JSON.stringify(x), { mode: 0o600 });
    const result = spawnSync(
      process.execPath,
      [
        "--max-old-space-size=65536",
        "artifacts/Receipt_js/generate_witness.js",
        "artifacts/Receipt_js/Receipt.wasm",
        input,
        witness,
      ],
      { stdio: "pipe", timeout: 300000 },
    );
    assert(
      !result.error,
      `Witness process failed to run: ${result.error?.message}`,
    );
    assert.notEqual(
      result.status,
      0,
      `${name} incorrectly satisfied the circuit`,
    );
    assert.match(
      result.stderr.toString(),
      /Assert Failed|Assert Failed|Error in template/,
      `${name} must fail a circuit assertion, not tooling`,
    );
    results.push({ name, rejected: true });
    console.log(`PASS: ${name}`);
  }
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
fs.writeFileSync(
  ".local/circuit-negative-results.json",
  JSON.stringify({ testedAt: new Date().toISOString(), results }, null, 2),
);
