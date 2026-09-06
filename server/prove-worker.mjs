import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { groth16 } from "snarkjs";
import { expectedSignals } from "./receipt.mjs";
import { saveStatus, cleanupPrivate } from "./jobs.mjs";
const dir = process.argv[2];
let preview;
const writeStatus = (status, stage, extra = {}) =>
  saveStatus(dir, { id: path.basename(dir), status, stage, preview, ...extra });
let witnessChild;
const calculate = (input, witness) =>
  new Promise((res, rej) => {
    const p = spawn(
      process.execPath,
      [
        "--max-old-space-size=65536",
        "artifacts/Receipt_js/generate_witness.js",
        "artifacts/Receipt_js/Receipt.wasm",
        input,
        witness,
      ],
      { stdio: ["ignore", "ignore", "ignore"] },
    );
    witnessChild = p;
    p.on("error", () =>
      rej(
        new Error(
          "Could not start the witness generator. Check the circuit artifacts.",
        ),
      ),
    );
    p.on("exit", (c) => {
      witnessChild = undefined;
      c === 0
        ? res()
        : rej(
            new Error(
              "Witness generation failed. The email did not satisfy the circuit.",
            ),
          );
    });
  });
process.on("SIGTERM", () => {
  witnessChild?.kill("SIGTERM");
  cleanupPrivate(dir);
  writeStatus("failed", "Proof cancelled", {
    error: "Proof generation was cancelled. You can start again.",
  });
  process.exit(1);
});
try {
  const prepared = JSON.parse(
    fs.readFileSync(path.join(dir, "prepared.json"), "utf8"),
  );
  preview = prepared.preview;
  const result = {};
  const vk = JSON.parse(
    fs.readFileSync("artifacts/verification-key.json", "utf8"),
  );
  for (const [i, kind] of ["merged", "closed"].entries()) {
    writeStatus(
      "proving",
      `Proving ${i === 0 ? "merge" : "issue closure"} receipt (${i + 1} of 2)`,
      { preview: prepared.preview },
    );
    const input = path.join(dir, `${kind}.input.json`);
    const witness = path.join(dir, `${kind}.wtns`);
    fs.writeFileSync(input, JSON.stringify(prepared[kind].inputs), {
      mode: 0o600,
    });
    await calculate(input, witness);
    const { proof, publicSignals } = await groth16.prove(
      "artifacts/Receipt.zkey",
      witness,
    );
    if (
      JSON.stringify(publicSignals) !==
      JSON.stringify(expectedSignals(prepared[kind]))
    )
      throw new Error("Circuit disclosures did not match the receipt.");
    if (!(await groth16.verify(vk, publicSignals, proof)))
      throw new Error("Generated proof did not verify.");
    const calldata = JSON.parse(
      `[${await groth16.exportSolidityCallData(proof, publicSignals)}]`,
    );
    result[kind] = {
      a: calldata[0],
      b: calldata[1],
      c: calldata[2],
      signals: calldata[3],
    };
    fs.unlinkSync(input);
    fs.unlinkSync(witness);
  }
  writeStatus("ready", "Both proofs verified", {
    preview: prepared.preview,
    result,
  });
} catch (e) {
  writeStatus("failed", "Proof generation failed", { error: e.message });
  process.exitCode = 1;
} finally {
  cleanupPrivate(dir);
}
// snarkjs workers keep Node alive unless explicitly closed; all artifacts have
// been atomically produced by the time we exit.
process.exit(process.exitCode ?? 0);
