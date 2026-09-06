import { verifyDKIMSignature } from "@zk-email/helpers/dist/dkim/index.js";
import { generateEmailVerifierInputsFromDKIMResult } from "@zk-email/helpers/dist/input-generators.js";
import { poseidonLarge } from "@zk-email/helpers/dist/hash.js";

import { extractDisclosures } from "../shared/receipt-policy.mjs";
export {
  extractDisclosures,
  checkPair,
  pack,
  expectedSignals,
  publicReceipt,
} from "../shared/receipt-policy.mjs";

export async function prepareReceipt(raw) {
  if (
    typeof raw !== "string" ||
    Buffer.byteLength(raw) > 100_000 ||
    !raw.includes("DKIM-Signature:")
  )
    throw new Error("Choose an original .eml file under 100 KB.");
  const verified = await verifyDKIMSignature(raw, "github.com", false, false);
  if (verified.algo !== "rsa-sha256" || verified.format !== "relaxed/relaxed")
    throw new Error(
      "Only GitHub RSA-SHA256 relaxed/relaxed receipts are supported.",
    );
  return fromVerified(verified);
}

// This also supports fixture generation from locally signed test messages.
// It is NOT exposed by the HTTP service and settlement independently checks
// the public key hash against the immutable deployment key.
export async function fromVerified(verified) {
  const h = verified.headers.toString();
  const b = verified.body.toString();
  // The upstream circuit encodes padded length in log2(buffer) bits. Leave
  // one SHA block unused so that length never equals the buffer capacity.
  if (Buffer.byteLength(h) > 1975 || Buffer.byteLength(b) > 4023)
    throw new Error(
      "This receipt exceeds the v1 proof size (1,975 header bytes / 4,023 body bytes). A larger circuit is required.",
    );
  const d = extractDisclosures(h, b);
  const inputs = generateEmailVerifierInputsFromDKIMResult(verified, {
    maxHeadersLength: 2048,
    maxBodyLength: 4096,
  });
  Object.assign(
    inputs,
    Object.fromEntries(
      [
        "subjectStart",
        "subjectLength",
        "dkimStart",
        "dkimLength",
        "prefixLength",
      ].map((k) => [k, String(d[k])]),
    ),
  );
  const keyHash = (await poseidonLarge(verified.publicKey, 9, 242)).toString();
  return {
    inputs,
    disclosures: { subject: d.subject, prefix: d.prefix, dkim: d.dkim },
    summary: {
      ...d.summary,
      keyHash,
      signature: "verified",
      privateFields:
        "Sender, recipient, reply links and remaining email body are hidden.",
    },
  };
}
