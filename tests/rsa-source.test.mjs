import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

test("RSA candidate changes only the documented upstream minimum and import path", () => {
  const upstream = readFileSync("node_modules/@openzeppelin/contracts/utils/cryptography/RSA.sol", "utf8");
  assert.equal(createHash("sha256").update(upstream).digest("hex"), "036c1fab2a132d7acb7fa0873812f2ad22c873d2efc91032b8ac7a1fda5ff476");
  const expected = upstream.replace('"../math/Math.sol"', '"@openzeppelin/contracts/utils/math/Math.sol"').replace("length < 0x100", "length < 0x80");
  const candidate = readFileSync("contracts/vendor/openzeppelin/RSA.sol", "utf8");
  const code = source => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "").replace(/\s+/g, "");
  assert.equal(code(candidate), code(expected));
});
