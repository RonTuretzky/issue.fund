// Browser-compatible DKIM preparation. This only canonicalizes and checks an
// existing RSA signature; it does not generate a proof or contact a service.
const bytes = (s) => Uint8Array.from(s, (c) => c.charCodeAt(0));
const latin1 = (b) => Array.from(b, (c) => String.fromCharCode(c)).join("");
const hex = (b) =>
  "0x" + Array.from(b, (c) => c.toString(16).padStart(2, "0")).join("");
const unhex = (h) =>
  Uint8Array.from(h.slice(2).match(/../g) ?? [], (c) => parseInt(c, 16));
const base64 = (b) => btoa(latin1(b));
const base64url = (b) =>
  base64(b).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
const MIME =
  /^\r\n(----==_mimepart_[0-9a-f_]{12,62})\r\nContent-Type: text\/plain;\r\n charset=UTF-8\r\nContent-Transfer-Encoding: 7bit\r\n\r\n/;

export function canonicalizeEmail(input) {
  if (!(input instanceof Uint8Array) || input.length > 100000)
    throw new Error("Choose an original .eml file under 100 KB.");
  const raw = latin1(input)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n/g, "\r\n");
  const split = raw.indexOf("\r\n\r\n");
  if (split < 0)
    throw new Error("Choose the original GitHub .eml, not a forwarded email.");
  const lines = [];
  for (const line of raw.slice(0, split).split("\r\n")) {
    if (/^[ \t]/.test(line) && lines.length)
      lines[lines.length - 1] += "\r\n" + line;
    else lines.push(line);
  }
  const headers = lines.map((line) => {
    const i = line.indexOf(":");
    if (i < 1 || !/^[a-zA-Z0-9-]+$/.test(line.slice(0, i)))
      throw new Error("Malformed email headers.");
    return {
      name: line.slice(0, i).toLowerCase(),
      value: line
        .slice(i + 1)
        .replace(/\r\n/g, "")
        .replace(/[ \t]+/g, " ")
        .trim(),
    };
  });
  const parseTags = (value) => {
    const out = {};
    for (const part of value.split(";")) {
      if (!part.trim()) continue;
      const eq = part.indexOf("="),
        name = part.slice(0, eq).trim();
      if (eq < 1 || !/^[a-z]+$/.test(name) || Object.hasOwn(out, name))
        throw new Error("Ambiguous DKIM signature tags.");
      out[name] = part.slice(eq + 1).trim();
    }
    return out;
  };
  const signatures = headers
    .filter((h) => h.name === "dkim-signature")
    .map((h) => ({ ...h, tags: parseTags(h.value) }))
    .filter((h) => h.tags.d === "github.com");
  if (signatures.length !== 1)
    throw new Error("Choose an original email with one GitHub DKIM signature.");
  const dkim = signatures[0],
    tags = dkim.tags;
  if (
    tags.v !== "1" ||
    tags.a !== "rsa-sha256" ||
    tags.c !== "relaxed/relaxed" ||
    tags.s !== "pf2023" ||
    tags.l !== undefined
  )
    throw new Error(
      "This email uses an unsupported GitHub DKIM key or format.",
    );
  if (
    !/^[1-9]\d{0,11}$/.test(tags.t ?? "") ||
    (tags.x !== undefined && !/^[1-9]\d{0,11}$/.test(tags.x))
  )
    throw new Error("A signed DKIM timestamp is required.");
  if (
    Object.keys(tags).some(
      (k) =>
        !["v", "a", "c", "d", "s", "t", "bh", "h", "b", "x", "q", "i"].includes(
          k,
        ),
    )
  )
    throw new Error("Unsupported DKIM signature tags.");
  if (
    (tags.q !== undefined && tags.q !== "dns/txt") ||
    (tags.i !== undefined && tags.i !== "@github.com")
  )
    throw new Error("Unsupported DKIM identity or query method.");
  const used = new Set(),
    signed = [];
  for (const name of (tags.h ?? "")
    .split(":")
    .map((n) => n.trim().toLowerCase())) {
    if (!/^[a-z0-9-]+$/.test(name) || name === "dkim-signature")
      throw new Error("Invalid DKIM signed-header list.");
    for (let i = headers.length - 1; i >= 0; i--) {
      if (headers[i].name === name && !used.has(i)) {
        used.add(i);
        signed.push(`${name}:${headers[i].value}\r\n`);
        break;
      }
    }
  }
  const selectedSubjects = signed.filter((h) => h.startsWith("subject:"));
  if (selectedSubjects.length !== 1)
    throw new Error("The GitHub subject must be signed exactly once.");
  const signatureText = (tags.b ?? "").replace(/\s/g, "");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(signatureText))
    throw new Error("Malformed DKIM signature.");
  const canonicalDkim = `${dkim.name}:${dkim.value.replace(/((?:^|;) ?b=)[^;]*/, "$1")}`;
  if (!canonicalDkim.endsWith("b="))
    throw new Error("Unsupported DKIM signature layout.");
  const header = signed.join("") + canonicalDkim;
  const body =
    raw
      .slice(split + 4)
      .replace(/[ \t]+/g, " ")
      .replace(/ +\r\n/g, "\r\n")
      .replace(/(?:\r\n)*$/, "") + "\r\n";
  if (header.length > 8192 || body.length > 65536)
    throw new Error(
      "This email exceeds the supported signed-header or body size.",
    );
  if (/[^\x20-\x7e\r\n]/.test(header))
    throw new Error("Unsupported signed-header encoding.");
  return {
    headers: bytes(header),
    body: bytes(body),
    signature: bytes(atob(signatureText)),
    subject: "\r\n" + selectedSubjects[0],
    tags,
  };
}

export function parseNativeEvent(subject, body, issuedAt) {
  const source = subject.match(
    /^\r\nsubject:Re: \[([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)\] ([\x20-\x7e]+) \((PR|Issue) #([1-9]\d{0,11})\)\r\n$/,
  );
  const mime = body.match(MIME);
  if (!source || !mime)
    throw new Error(
      "Unsupported GitHub subject or native notification format.",
    );
  const eventEnd = body.indexOf("\r\n\r\n", mime[0].length);
  const event = body.slice(mime[0].length, eventEnd);
  const merged = event.match(
    /^Merged #([1-9]\d{0,11}) into ([a-zA-Z0-9_./-]{1,64})\.$/,
  );
  const closed = event.match(
    /^Closed #([1-9]\d{0,11}) as completed via #([1-9]\d{0,11})\.$/,
  );
  if (
    (!merged && !closed) ||
    (merged ? source[3] !== "PR" : source[3] !== "Issue") ||
    source[4] !== (merged?.[1] ?? closed?.[1])
  )
    throw new Error(
      "This is not a matching native merge or issue-closure notification.",
    );
  const plainEnd = body.indexOf("\r\n" + mime[1], eventEnd);
  const footer = body.slice(eventEnd + 4, plainEnd);
  const f = footer.match(
    /^--\r\nReply to this email directly or view it on GitHub:\r\nhttps:\/\/github\.com\/([^\r\n]+)\/(pull|issues)\/([1-9]\d{0,11})#event-([1-9]\d{0,11})\r\nYou are receiving this because [\x20-\x7e]{1,180}\r\n\r\nMessage ID: <([^\r\n]+)\/(pull|issue)\/([1-9]\d{0,11})\/issue_event\/([1-9]\d{0,11})@github\.com>$/,
  );
  if (
    !f ||
    f[1] !== source[1] ||
    f[5] !== source[1] ||
    f[3] !== source[4] ||
    f[7] !== source[4] ||
    f[4] !== f[8] ||
    f[2] !== (merged ? "pull" : "issues") ||
    f[6] !== (merged ? "pull" : "issue") ||
    body.split(mime[1]).length !== 4 ||
    !body.endsWith("\r\n" + mime[1] + "--\r\n") ||
    !body
      .slice(plainEnd)
      .startsWith(
        "\r\n" +
          mime[1] +
          "\r\nContent-Type: text/html;\r\n charset=UTF-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\n",
      )
  )
    throw new Error(
      "This email has no authentic native-event footer. Comments cannot claim a bounty.",
    );
  const wallet = source[2].match(/\[wallet (0x[a-fA-F0-9]{40})\]/g) ?? [];
  const refs = source[2].match(/\[bounty (0x[a-fA-F0-9]{64})\]/g) ?? [];
  if (
    (merged && (wallet.length !== 1 || refs.length !== 1)) ||
    wallet.length > 1 ||
    refs.length > 1
  )
    throw new Error(
      "The PR title needs exactly one wallet and bounty reference.",
    );
  return {
    kind: merged ? "merge" : "closure",
    repo: source[1],
    number: Number(source[4]),
    pr: Number(merged?.[1] ?? closed[2]),
    issue: closed ? Number(closed[1]) : null,
    branch: merged?.[2] ?? null,
    wallet: wallet[0]?.slice(8, -1) ?? null,
    bountyRef: refs[0]?.slice(8, -1) ?? null,
    issuedAt,
    title: source[2],
  };
}

export async function prepareReceipt(input, key) {
  const c = canonicalizeEmail(input);
  if (
    c.tags.d !== key.domain ||
    c.tags.s !== key.selector ||
    key.exponent !== "0x010001"
  )
    throw new Error("This deployment does not trust the email’s DKIM key.");
  const bodyHash = base64(
    new Uint8Array(await crypto.subtle.digest("SHA-256", c.body)),
  );
  if (bodyHash !== c.tags.bh)
    throw new Error(
      "The email body does not match its DKIM signature. Download the original .eml.",
    );
  const publicKey = await crypto.subtle.importKey(
    "jwk",
    {
      kty: "RSA",
      n: base64url(unhex(key.modulus)),
      e: "AQAB",
      alg: "RS256",
      ext: true,
    },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  if (
    !(await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      publicKey,
      c.signature,
      c.headers,
    ))
  )
    throw new Error("GitHub’s RSA signature is invalid for these headers.");
  if (c.tags.x && Number(c.tags.x) * 1000 < Date.now())
    throw new Error("This DKIM signature has expired.");
  const summary = parseNativeEvent(c.subject, latin1(c.body), Number(c.tags.t));
  return {
    receipt: {
      headers: hex(c.headers),
      body: hex(c.body),
      signature: hex(c.signature),
    },
    summary: { ...summary, keyHash: key.keyHash },
  };
}

export function checkPair(merged, closed, bounty) {
  const m = merged.summary,
    c = closed.summary;
  if (m.kind !== "merge" || c.kind !== "closure")
    throw new Error(
      "Upload the merged-PR email first, then the issue-closure email.",
    );
  if (
    m.repo !== bounty.repo ||
    c.repo !== bounty.repo ||
    c.issue !== Number(bounty.issue) ||
    m.pr !== c.pr
  )
    throw new Error(
      "These emails do not match the funded repository, issue and closing PR.",
    );
  if (m.branch !== bounty.branch)
    throw new Error(`The PR must merge into ${bounty.branch}.`);
  if (
    !m.wallet ||
    /^0x0{40}$/.test(m.wallet) ||
    m.bountyRef?.toLowerCase() !== bounty.bountyRef.toLowerCase()
  )
    throw new Error(
      "The merge-time PR title must contain this bounty reference and a nonzero payout wallet.",
    );
  if (m.keyHash !== bounty.keyHash || c.keyHash !== bounty.keyHash)
    throw new Error("These emails use a different DKIM key.");
  if (
    [m, c].some(
      (x) =>
        x.issuedAt < Number(bounty.createdAt) ||
        x.issuedAt > Number(bounty.deadline),
    )
  )
    throw new Error(
      "Both emails must have been signed during this bounty’s funding window.",
    );
  return {
    repo: m.repo,
    issue: c.issue,
    pr: m.pr,
    branch: m.branch,
    wallet: m.wallet,
    bountyRef: m.bountyRef,
    mergeIssuedAt: m.issuedAt,
    closedIssuedAt: c.issuedAt,
  };
}
