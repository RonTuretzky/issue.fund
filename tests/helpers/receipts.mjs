// Synthetic signing keys are generated in memory and used only on local chains.
import {
  generateKeyPairSync,
  createHash,
  sign,
  constants,
  privateEncrypt,
} from "node:crypto";
import { keccak256 } from "viem";
import { canonicalizeEmail } from "../../shared/dkim.mjs";

export function signer(bits = 1024) {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: bits,
    publicExponent: 65537,
  });
  const modulus =
    "0x" +
    Buffer.from(publicKey.export({ format: "jwk" }).n, "base64url").toString(
      "hex",
    );
  const key = {
    domain: "github.com",
    selector: "pf2023",
    exponent: "0x010001",
    modulus,
    keyHash: keccak256(modulus),
  };
  return {
    key,
    email(options = {}) {
      return signedEmail(privateKey, options);
    },
    rawSign(encoded) {
      return privateEncrypt(
        { key: privateKey, padding: constants.RSA_NO_PADDING },
        encoded,
      );
    },
  };
}
export function nativeBody({
  kind = "merge",
  repo = "example/parser",
  issue = 42,
  pr = 43,
  branch = "main",
  eventId = 12345678901,
} = {}) {
  const merge = kind === "merge",
    number = merge ? pr : issue;
  const boundary = "----==_mimepart_abcdef123456_789abc";
  return `\r\n${boundary}\r\nContent-Type: text/plain;\r\n charset=UTF-8\r\nContent-Transfer-Encoding: 7bit\r\n\r\n${merge ? `Merged #${pr} into ${branch}.` : `Closed #${issue} as completed via #${pr}.`}\r\n\r\n--\r\nReply to this email directly or view it on GitHub:\r\nhttps://github.com/${repo}/${merge ? "pull" : "issues"}/${number}#event-${eventId}\r\nYou are receiving this because you are subscribed to this thread.\r\n\r\nMessage ID: <${repo}/${merge ? "pull" : "issue"}/${number}/issue_event/${eventId}@github.com>\r\n${boundary}\r\nContent-Type: text/html;\r\n charset=UTF-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\n<p>Synthetic local test notification</p>\r\n${boundary}--\r\n`;
}
function signedEmail(privateKey, options) {
  const {
    kind = "merge",
    repo = "example/parser",
    issue = 42,
    pr = 43,
    wallet = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    bountyRef = "0x" + "ab".repeat(32),
    timestamp = Math.floor(Date.now() / 1000),
    extraTags = "",
    transformBody = (x) => x,
    transformSubject = (x) => x,
    transformHeaders = (x) => x,
  } = options;
  const body = transformBody(nativeBody(options));
  const title =
    kind === "merge"
      ? `Resolve issue [wallet ${wallet}] [bounty ${bountyRef}]`
      : "Resolve issue";
  const subject = transformSubject(
    `Re: [${repo}] ${title} (${kind === "merge" ? "PR" : "Issue"} #${kind === "merge" ? pr : issue})`,
  );
  const fields = transformHeaders(
    `from:GitHub <notifications@github.com>\r\nto:Local Test <test@example.invalid>\r\nsubject:${subject}\r\n`,
  );
  const canonicalBody =
    body
      .replace(/[ \t]+/g, " ")
      .replace(/ +\r\n/g, "\r\n")
      .replace(/(?:\r\n)*$/, "") + "\r\n";
  const bh = createHash("sha256")
    .update(canonicalBody, "latin1")
    .digest("base64");
  const names = fields
    .split("\r\n")
    .filter(Boolean)
    .map((x) => x.split(":")[0])
    .join(":");
  const headers =
    fields +
    `dkim-signature:v=1; a=rsa-sha256; c=relaxed/relaxed; d=github.com; s=pf2023; t=${timestamp}; bh=${bh}; h=${names}:From; ${extraTags}b=`;
  const signature = sign("sha256", Buffer.from(headers, "latin1"), {
    key: privateKey,
    padding: constants.RSA_PKCS1_PADDING,
  });
  const raw = Buffer.from(
    headers + signature.toString("base64") + "\r\n\r\n" + body,
    "latin1",
  );
  const receipt = {
    headers: "0x" + Buffer.from(headers, "latin1").toString("hex"),
    body: "0x" + Buffer.from(canonicalBody, "latin1").toString("hex"),
    signature: "0x" + signature.toString("hex"),
  };
  return { raw, receipt, headers, body: canonicalBody };
}
export function canonicalReceipt(raw) {
  const c = canonicalizeEmail(raw);
  return Object.fromEntries(
    ["headers", "body", "signature"].map((k) => [
      k,
      "0x" + Buffer.from(c[k]).toString("hex"),
    ]),
  );
}
