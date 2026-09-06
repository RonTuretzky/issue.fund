import test from "node:test";
import assert from "node:assert/strict";
import {
  prepareReceipt,
  checkPair,
  canonicalizeEmail,
} from "../shared/dkim.mjs";
import { signer, canonicalReceipt } from "./helpers/receipts.mjs";
const s = signer();
const now = Math.floor(Date.now() / 1000);
const bounty = {
  repo: "example/parser",
  issue: 42,
  branch: "main",
  bountyRef: "0x" + "ab".repeat(32),
  keyHash: s.key.keyHash,
  createdAt: now - 60,
  deadline: now + 3600,
};
test("independently signed RSA email canonicalizes and matches a complete bounty pair", async () => {
  const m = s.email(),
    c = s.email({ kind: "closure" });
  assert.deepEqual(canonicalReceipt(m.raw), m.receipt);
  const a = await prepareReceipt(m.raw, s.key),
    b = await prepareReceipt(c.raw, s.key);
  assert.equal(checkPair(a, b, bounty).pr, 43);
  assert.equal(
    checkPair(a, b, bounty).wallet,
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  );
});
test("relaxed canonicalization preserves signatures across folding, whitespace and line endings", async () => {
  const raw =
    s
      .email()
      .raw.toString("latin1")
      .replace("from:GitHub ", "From:  GitHub\r\n\t")
      .replaceAll("\r\n", "\n") + "\n\n";
  assert.equal(
    (await prepareReceipt(Buffer.from(raw, "latin1"), s.key)).summary.pr,
    43,
  );
});
test("tampered body, signed subject, and RSA signature are rejected", async () => {
  const raw = s.email().raw.toString("latin1");
  for (const x of [
    raw.replace("Merged #43", "Merged #44"),
    raw.replace("Resolve issue [", "Other issue ["),
    raw.replace(/b=([A-Za-z0-9+\/])/, (_, c) => "b=" + (c === "A" ? "B" : "A")),
  ])
    await assert.rejects(prepareReceipt(Buffer.from(x, "latin1"), s.key));
});
test("a valid RSA signature over a copied event comment is insufficient", async () => {
  for (const transformBody of [
    (b) => b.replaceAll("/issue_event/", "/issuecomment/"),
    (b) => b.replace("#event-", "#issuecomment-"),
    (b) => b.replace("/issue_event/12345678901", "/issue_event/12345678902"),
    (b) =>
      b.replace(
        "\r\nMessage ID:",
        "\r\nUser supplied fake footer\r\nMessage ID:",
      ),
  ]) {
    await assert.rejects(
      prepareReceipt(s.email({ transformBody }).raw, s.key),
      /footer/,
    );
  }
});
test("duplicate subjects, partial-body tags, duplicate tags and expired signatures fail closed", async () => {
  for (const options of [
    { extraTags: "l=10; " },
    { extraTags: `t=${now}; ` },
    { extraTags: `x=${now - 1}; ` },
    {
      transformHeaders: (h) =>
        h.replace("subject:", "subject:duplicate\r\nsubject:"),
    },
  ])
    await assert.rejects(prepareReceipt(s.email(options).raw, s.key));
});
test("wrong key and malformed/oversized uploads are rejected", async () => {
  await assert.rejects(
    prepareReceipt(s.email().raw, signer().key),
    /signature/,
  );
  assert.throws(() => canonicalizeEmail(Buffer.alloc(100001)), /100 KB/);
  assert.throws(() => canonicalizeEmail(Buffer.from("not email")), /original/);
});
test("signed pair must bind repo, issue, closing PR, branch, wallet, reference, key and window", async () => {
  const m = await prepareReceipt(s.email().raw, s.key),
    c = await prepareReceipt(s.email({ kind: "closure" }).raw, s.key);
  for (const [part, patch] of [
    ["m", { repo: "other/repo" }],
    ["c", { issue: 99 }],
    ["c", { pr: 99 }],
    ["m", { branch: "develop" }],
    ["m", { wallet: "0x" + "0".repeat(40) }],
    ["m", { bountyRef: "0x" + "cd".repeat(32) }],
    ["c", { keyHash: "different" }],
    ["m", { issuedAt: now - 1000 }],
    ["c", { issuedAt: now + 99999 }],
  ]) {
    const a = structuredClone(m),
      b = structuredClone(c);
    Object.assign((part === "m" ? a : b).summary, patch);
    assert.throws(() => checkPair(a, b, bounty));
  }
});
test("2048-bit RSA keys are supported without changing the signed-message policy", async () => {
  const strong = signer(2048);
  assert.equal(
    (await prepareReceipt(strong.email().raw, strong.key)).summary.pr,
    43,
  );
});
