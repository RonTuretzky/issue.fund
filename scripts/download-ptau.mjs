import fs from "node:fs";
import { createHash } from "node:crypto";
import { pipeline } from "node:stream/promises";
const url =
  "https://risc0-artifacts.s3.us-west-2.amazonaws.com/tsc/2024-04-04/powersOfTau28_hez_final_23.ptau";
// Published by iden3/snarkjs, independent of the RISC Zero file mirror.
const expected =
  "3063a0bd81d68711197c8820a92466d51aeac93e915f5136d74f63c394ee6d88c5e8016231ea6580bec02e25d491f319d92e77f5c7f46a9caa8f3b53c0ea544f";
const size = 9663759512,
  chunkSize = 64 * 1024 * 1024;
fs.mkdirSync("artifacts", { recursive: true });
const file = "artifacts/hermez23.download",
  stateFile = "artifacts/hermez23.download.json";
const count = Math.ceil(size / chunkSize);
const completed = new Set(
  fs.existsSync(stateFile) && fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(stateFile, "utf8")).completed
    : [],
);
if (!fs.existsSync(file)) {
  const fd = fs.openSync(file, "w");
  fs.ftruncateSync(fd, size);
  fs.closeSync(fd);
}
const queue = Array.from({ length: count }, (_, i) => i).filter(
  (i) => !completed.has(i),
);
async function worker() {
  while (queue.length) {
    const i = queue.shift(),
      start = i * chunkSize,
      end = Math.min(size - 1, start + chunkSize - 1);
    let success = false;
    for (let attempt = 0; attempt < 3 && !success; attempt++) {
      try {
        const response = await fetch(url, {
          headers: { Range: `bytes=${start}-${end}` },
          signal: AbortSignal.timeout(300000),
        });
        if (
          response.status !== 206 ||
          response.headers.get("content-range") !==
            `bytes ${start}-${end}/${size}`
        )
          throw new Error("Mirror did not return the requested byte range.");
        await pipeline(
          response.body,
          fs.createWriteStream(file, { flags: "r+", start }),
        );
        completed.add(i);
        fs.writeFileSync(
          stateFile,
          JSON.stringify({ url, size, completed: [...completed] }),
        );
        if (completed.size % 8 === 0 || completed.size === count)
          console.log(
            `Downloaded ${completed.size}/${count} verified HTTP ranges`,
          );
        success = true;
      } catch (e) {
        if (attempt === 2) throw e;
      }
    }
  }
}
await Promise.all(Array.from({ length: 24 }, worker));
console.log("Checking the independent upstream BLAKE2b checksum…");
const hash = createHash("blake2b512");
for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
const actual = hash.digest("hex");
if (actual !== expected)
  throw new Error("Checksum mismatch; downloaded parameters must not be used.");
fs.renameSync(file, "artifacts/hermez23.ptau");
fs.unlinkSync(stateFile);
fs.writeFileSync(
  "artifacts/ptau-provenance.json",
  JSON.stringify(
    {
      url,
      mirrorSource:
        "https://github.com/risc0/risc0/blob/main/groth16_proof/README.md",
      checksumSource: "https://github.com/iden3/snarkjs",
      algorithm: "blake2b512",
      expected,
      actual,
      verifiedAt: new Date().toISOString(),
    },
    null,
    2,
  ),
);
console.log("Public power-23 parameters match the upstream BLAKE2b checksum.");
