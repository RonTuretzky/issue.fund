import { fail } from "./errors.mjs";

function headersOf(raw) {
  const text = Buffer.from(raw).toString("latin1");
  if (raw.length > 100_000) fail("email_too_large", 422);
  const at = text.search(/\r?\n\r?\n/);
  if (at < 0 || at > 32_768) fail("email_headers_invalid", 422);
  return text
    .slice(0, at)
    .replace(/\r?\n[ \t]+/g, " ")
    .split(/\r?\n/)
    .map((line) => {
      const i = line.indexOf(":");
      if (i <= 0 || !/^[A-Za-z0-9-]+$/.test(line.slice(0, i)))
        fail("email_headers_invalid", 422);
      return [line.slice(0, i).toLowerCase(), line.slice(i + 1).trim()];
    });
}
function unique(headers, name) {
  const values = headers.filter(([n]) => n === name);
  if (values.length !== 1) fail("recipient_not_authenticated", 422);
  return values[0][1];
}
function withoutComments(text) {
  let depth = 0,
    result = "";
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "\\" && depth) {
      i++;
      continue;
    }
    if (c === "(") {
      if (++depth > 5) fail("mail_transport_unverified", 422);
    } else if (c === ")") {
      if (--depth < 0) fail("mail_transport_unverified", 422);
    } else if (!depth) result += c;
  }
  if (depth) fail("mail_transport_unverified", 422);
  return result;
}

// This is an operational trust boundary, not a DKIM-authenticated identity.
// Only call on bytes fetched over authenticated TLS from Gmail itself. Gmail
// must prepend its own Authentication-Results and remove forged local results
// (RFC 8601 §7.1). Forwarded mail and imported/uploaded EML are not eligible.
// Enable automatic disclosure only after the deployment's spoof/reply-lock
// tests have validated this provider path. The escrow still verifies DKIM.
export function verifyGmailDelivery(raw, { login, address, host }) {
  if (host !== "imap.gmail.com") fail("mail_provider_not_validated", 422);
  const headers = headersOf(raw);
  const arIndex = headers.findIndex(([n]) => n === "authentication-results");
  const sigIndex = headers.findIndex(([n]) => n === "dkim-signature");
  if (arIndex < 0 || sigIndex < 0 || arIndex > sigIndex)
    fail("mail_transport_unverified", 422);
  const parts = withoutComments(headers[arIndex][1])
    .split(";")
    .map((s) => s.trim());
  if (parts.shift() !== "mx.google.com") fail("mail_transport_unverified", 422);
  const spf = parts.filter((p) => /^spf=/i.test(p));
  const dkim = parts.filter((p) => /^dkim=pass\s/i.test(p));
  if (
    spf.length !== 1 ||
    !/^spf=pass\s+smtp\.mailfrom=noreply@github\.com$/i.test(spf[0])
  )
    fail("mail_transport_unverified", 422);
  if (
    !dkim.some(
      (p) =>
        /(?:^|\s)header\.i=@github\.com(?:\s|$)/i.test(p) &&
        /(?:^|\s)header\.s=pf2023(?:\s|$)/i.test(p),
    )
  )
    fail("mail_transport_unverified", 422);
  if (
    unique(headers, "x-github-recipient").toLowerCase() !==
      login.toLowerCase() ||
    unique(headers, "x-github-recipient-address").toLowerCase() !==
      address.toLowerCase()
  )
    fail("recipient_not_authenticated", 422);
  const delivered = headers.find(([n]) => n === "delivered-to");
  if (delivered?.[1].toLowerCase() !== address.toLowerCase())
    fail("recipient_not_authenticated", 422);
  return {
    recipient: login,
    mailbox: address,
    method: "gmail-direct-spf-dkim",
  };
}
