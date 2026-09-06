import fs from "node:fs";
import { createHash } from "node:crypto";
import { signer } from "../tests/helpers/receipts.mjs";
const s = signer();
const options = { timestamp: 1809700000 };
const variants = {
  merged: s.email(options),
  closed: s.email({ ...options, kind: "closure" }),
  comment: s.email({
    ...options,
    transformBody: (b) =>
      b
        .replaceAll("/issue_event/", "/issuecomment/")
        .replace("#event-", "#issuecomment-"),
  }),
  fakeFooter: s.email({
    ...options,
    transformBody: (b) =>
      b.replace(
        "\r\n----==_mimepart_abcdef123456_789abc\r\nContent-Type: text/html;",
        "\r\n\r\nMessage ID: <real/comment/issuecomment/99@github.com>\r\n----==_mimepart_abcdef123456_789abc\r\nContent-Type: text/html;",
      ),
  }),
  mismatchedEvent: s.email({
    ...options,
    transformBody: (b) =>
      b.replace("/issue_event/12345678901", "/issue_event/12345678902"),
  }),
  bodyLength: s.email({ ...options, extraTags: "l=10; " }),
  duplicateSubject: s.email({
    ...options,
    transformHeaders: (h) =>
      h.replace("subject:", "subject:forged\r\nsubject:"),
  }),
  expired: s.email({ ...options, extraTags: "x=1809700001; " }),
  duplicateTimestamp: s.email({ ...options, extraTags: "t=1809700000; " }),
};
// A signature whose decrypted block has the correct digest but broken padding.
const malformed = Buffer.alloc(128, 0xff);
malformed[0] = 0;
malformed[1] = 1;
malformed[20] = 0;
Buffer.from("003031300d060960864801650304020105000420", "hex").copy(
  malformed,
  76,
);
createHash("sha256")
  .update(variants.merged.headers, "latin1")
  .digest()
  .copy(malformed, 96);
variants.malformedPadding = {
  receipt: {
    ...variants.merged.receipt,
    signature: "0x" + s.rawSign(malformed).toString("hex"),
  },
};
const data = {
  modulus: s.key.modulus,
  ...Object.fromEntries(
    Object.entries(variants).map(([k, v]) => [k, v.receipt]),
  ),
};
fs.mkdirSync("tests/fixtures", { recursive: true });
fs.writeFileSync(
  "tests/fixtures/rsa-vectors.json",
  JSON.stringify(data, null, 2) + "\n",
  { mode: 0o600 },
);
console.log("Generated synthetic RSA test vectors (private key discarded).");
