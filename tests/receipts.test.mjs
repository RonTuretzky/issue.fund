import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  extractDisclosures,
  checkPair,
  pack,
  expectedSignals,
  prepareReceipt,
} from "../server/receipt.mjs";
import {
  saveStatus,
  readStatus,
  recoverJobs,
  privateFiles,
} from "../server/jobs.mjs";
const wallet = "0x1111111111111111111111111111111111111111";
const ref = "0x" + "ab".repeat(32);
const title = `[bounty ${ref}] [wallet ${wallet}] Fix the parser`;
const dkim =
  "\r\ndkim-signature:v=1; a=rsa-sha256; c=relaxed/relaxed; d=github.com; s=pf2023; t=1788699000; bh=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=; h=Date:From:Subject:To; b=";
const mime =
  "\r\n----==_mimepart_6a9d62d2c9150_eb11b8353365\r\nContent-Type: text/plain;\r\n charset=UTF-8\r\nContent-Transfer-Encoding: 7bit\r\n\r\n";
const headers = (kind = "PR", n = 2, t = title) =>
  `date:Sun, 6 Sep 2026 09:00:00 +0000\r\nsubject:Re: [owner/repo] ${t} (${kind} #${n})\r\nfrom:notifications@github.com${dkim}`;
const body = (event = "Merged #2 into main.") =>
  `${mime}${event}\r\n\r\nPrivate remainder never disclosed.`;
function receipt(closure = false) {
  const d = extractDisclosures(
    closure ? headers("Issue", 1, "Fix parser") : headers(),
    body(closure ? "Closed #1 as completed via #2." : undefined),
  );
  return {
    disclosures: { subject: d.subject, prefix: d.prefix, dkim: d.dkim },
    summary: { ...d.summary, keyHash: "123" },
  };
}
const bounty = {
  repo: "owner/repo",
  issue: 1,
  branch: "main",
  bountyRef: ref,
  keyHash: "123",
  createdAt: 1788698999,
  deadline: 1788699001,
};
test("native receipt pair binds repository, issue, PR, beneficiary and escrow reference", () => {
  assert.deepEqual(checkPair(receipt(), receipt(true), bounty), {
    repo: "owner/repo",
    issue: 1,
    pr: 2,
    branch: "main",
    wallet,
    bountyRef: ref,
    mergeIssuedAt: 1788699000,
    closedIssuedAt: 1788699000,
  });
});
test("only the first native event paragraph is disclosed", () => {
  const d = receipt().disclosures;
  assert.equal(d.prefix, `${mime}Merged #2 into main.\r\n\r\n`);
  assert(!JSON.stringify(d).includes("Private remainder"));
});
test("ordinary comment cannot masquerade as a merge", () =>
  assert.throws(
    () =>
      extractDisclosures(
        headers(),
        body("alice left a comment (owner/repo#2)\r\n\r\nMerged #2 into main."),
      ),
    /native merge/,
  ));
test("a closed but unmerged PR cannot claim", () =>
  assert.throws(
    () => extractDisclosures(headers(), body("Closed #2.")),
    /native merge/,
  ));
test("a forged second MIME part cannot supply the first event", () =>
  assert.throws(
    () => extractDisclosures(headers(), body("Not a merge") + body()),
    /native merge/,
  ));
test("forwarded and quoted-printable messages fail closed", () => {
  assert.throws(
    () => extractDisclosures(headers(), "Forwarded\r\n" + body()),
    /encoding/,
  );
  assert.throws(
    () =>
      extractDisclosures(headers(), body().replace("7bit", "quoted-printable")),
    /encoding/,
  );
});
test("subject and body PR mismatch is rejected", () =>
  assert.throws(
    () => extractDisclosures(headers("PR", 3), body()),
    /disagree/,
  ));
test("ambiguous wallet and bounty markers are rejected", () => {
  for (const extra of [`[wallet ${wallet}]`, `[bounty ${ref}]`])
    assert.throws(
      () => extractDisclosures(headers("PR", 2, title + " " + extra), body()),
      /exactly one/,
    );
});
test("truncated DKIM line and body-length signatures are rejected", () => {
  assert.throws(
    () => extractDisclosures(headers().slice(0, -2), body()),
    /complete/,
  );
  assert.throws(
    () => extractDisclosures(headers().replace("; b=", "; l=200; b="), body()),
    /complete/,
  );
});
test("missing signed issuance time fails closed", () =>
  assert.throws(
    () => extractDisclosures(headers().replace("t=1788699000; ", ""), body()),
    /issuance time/,
  ));
test("pair rejects swapped receipts and conflicting bounty terms", () => {
  assert.throws(() => checkPair(receipt(true), receipt(), bounty), /first/);
  for (const changes of [
    { repo: "other/repo" },
    { issue: 99 },
    { branch: "develop" },
    { bountyRef: "0x" + "cd".repeat(32) },
    { keyHash: "456" },
    { createdAt: 1788699001 },
    { deadline: 1788698999 },
  ])
    assert.throws(() =>
      checkPair(receipt(), receipt(true), { ...bounty, ...changes }),
    );
});
test("zero recipient cannot burn a bounty", () => {
  const m = receipt();
  m.summary.wallet = "0x" + "0".repeat(40);
  assert.throws(() => checkPair(m, receipt(true), bounty), /nonzero/);
});
test("public signal packing is little endian and contains exactly 43 field elements", () => {
  assert.equal(pack("AB", 1)[0], String(0x4241));
  assert.equal(expectedSignals(receipt()).length, 43);
  assert.throws(() => pack("x".repeat(32), 1), /too long/);
});
test("oversized or non-original uploads are rejected before DNS", async () => {
  await assert.rejects(() => prepareReceipt("x".repeat(100001)), /100 KB/);
  await assert.rejects(
    () => prepareReceipt("No original signature"),
    /original/,
  );
});
test("restart recovery removes private witnesses and preserves finished proofs", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mergebounty-jobs-"));
  try {
    for (const [id, status] of [
      ["running", "proving"],
      ["done", "ready"],
    ]) {
      const dir = path.join(root, id);
      fs.mkdirSync(dir);
      saveStatus(dir, {
        id,
        status,
        result: status === "ready" ? { proof: "public" } : undefined,
      });
      for (const name of privateFiles)
        fs.writeFileSync(path.join(dir, name), "private");
    }
    recoverJobs(root);
    assert.equal(readStatus(path.join(root, "running")).status, "failed");
    assert.equal(readStatus(path.join(root, "done")).result.proof, "public");
    for (const id of ["running", "done"])
      assert.deepEqual(fs.readdirSync(path.join(root, id)), ["status.json"]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
