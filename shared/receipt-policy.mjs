const MIME =
  /^\r\n----==_mimepart_[0-9a-f_]{12,62}\r\nContent-Type: text\/plain;\r\n charset=UTF-8\r\nContent-Transfer-Encoding: 7bit\r\n\r\n/;
export function extractDisclosures(headers, body) {
  const subjectStart = headers.indexOf("\r\nsubject:");
  if (subjectStart < 0)
    throw new Error(
      "The signed headers must include the original PR or issue subject.",
    );
  const subjectEnd = headers.indexOf("\r\n", subjectStart + 2);
  const subject = headers.slice(subjectStart, subjectEnd + 2);
  if (
    !/^\r\nsubject:Re: \[[\x20-\x7e]+\r\n$/.test(subject) ||
    subject.length > 403
  )
    throw new Error(
      "This notification subject format is not supported. Use an ASCII PR title below 350 characters.",
    );
  const dkimStart = headers.indexOf("\r\ndkim-signature:");
  const dkim = headers.slice(dkimStart);
  if (
    dkimStart < 0 ||
    dkim.length > 620 ||
    !dkim.endsWith("b=") ||
    /(?:;|:)\s*l=/.test(dkim)
  )
    throw new Error(
      "A complete, untruncated GitHub DKIM signature is required.",
    );
  const mime = body.match(MIME);
  if (!mime)
    throw new Error(
      "Unsupported email encoding. Download the original GitHub event email; forwarded emails are not supported.",
    );
  const eventEnd = body.indexOf("\r\n\r\n", mime[0].length);
  if (eventEnd < 0) throw new Error("The GitHub event paragraph is missing.");
  const event = body.slice(mime[0].length, eventEnd);
  const prefix = body.slice(0, eventEnd + 4);
  if (prefix.length > 279)
    throw new Error("This event is too long for the receipt proof.");
  const merge = event.match(
    /^Merged #([1-9]\d*) into ([a-zA-Z0-9_./-]{1,64})\.$/,
  );
  const closure = event.match(
    /^Closed #([1-9]\d*) as completed via #([1-9]\d*)\.$/,
  );
  if (!merge && !closure)
    throw new Error(
      "This is not a native merge or issue-closure receipt. Comments and unmerged closures cannot claim a bounty.",
    );
  const source = subject.match(
    /^\r\nsubject:Re: \[([^\]]+)\] (.+) \((PR|Issue) #([1-9]\d*)\)\r\n$/,
  );
  if (!source)
    throw new Error("The signed subject does not identify a GitHub thread.");
  if (
    (merge && source[3] !== "PR") ||
    (closure && source[3] !== "Issue") ||
    Number(source[4]) !== Number(merge?.[1] ?? closure?.[1])
  )
    throw new Error("The signed subject and event disagree.");
  const wallet = source[2].match(/\[wallet (0x[0-9a-fA-F]{40})\]/g) ?? [];
  const refs = source[2].match(/\[bounty (0x[0-9a-fA-F]{64})\]/g) ?? [];
  if (wallet.length > 1 || refs.length > 1)
    throw new Error(
      "Use exactly one wallet and one bounty reference in the PR title.",
    );
  const issued = dkim.match(/;\s*t=([1-9]\d*);/);
  if (!issued) throw new Error("This DKIM signature has no issuance time.");
  return {
    subject,
    dkim,
    prefix,
    subjectStart,
    subjectLength: subject.length,
    dkimStart,
    dkimLength: dkim.length,
    prefixLength: prefix.length,
    summary: {
      kind: merge ? "merge" : "closure",
      repo: source[1],
      number: Number(source[4]),
      pr: Number(merge?.[1] ?? closure[2]),
      issue: closure ? Number(closure[1]) : null,
      branch: merge?.[2] ?? null,
      wallet: wallet[0]?.slice(8, -1) ?? null,
      bountyRef: refs[0]?.slice(8, -1) ?? null,
      issuedAt: Number(issued[1]),
      title: source[2],
    },
  };
}

export function checkPair(merge, closure, bounty) {
  const m = merge.summary,
    c = closure.summary;
  if (m.kind !== "merge" || c.kind !== "closure")
    throw new Error(
      "Upload the merged-PR email first, then the linked issue-closure email.",
    );
  if (
    m.repo !== bounty.repo ||
    c.repo !== bounty.repo ||
    c.issue !== Number(bounty.issue) ||
    m.pr !== c.pr
  )
    throw new Error(
      "These receipts do not match the funded repository, issue and closing PR.",
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
    throw new Error(
      "This deployment does not trust the DKIM key used by these messages.",
    );
  if (
    [m, c].some(
      (x) =>
        x.issuedAt < Number(bounty.createdAt) ||
        x.issuedAt > Number(bounty.deadline),
    )
  )
    throw new Error(
      "Both signed receipts must be issued during this bounty’s funding window.",
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

export function pack(s, words) {
  const b = new TextEncoder().encode(s);
  if (b.length > words * 31) throw new Error("Disclosure too long");
  return Array.from({ length: words }, (_, i) => {
    let n = 0n;
    for (let j = 0; j < 31; j++)
      n |= BigInt(b[i * 31 + j] ?? 0) << BigInt(8 * j);
    return n.toString();
  });
}
export function expectedSignals(prepared) {
  return [
    prepared.summary.keyHash,
    ...pack(prepared.disclosures.subject, 13),
    ...pack(prepared.disclosures.prefix, 9),
    ...pack(prepared.disclosures.dkim, 20),
  ];
}
export function publicReceipt(proof) {
  const uint = (x) => {
    if (
      typeof x !== "string" ||
      !/^(0x[0-9a-fA-F]+|[0-9]+)$/.test(x) ||
      BigInt(x) >= 1n << 256n
    )
      throw new Error("Invalid proof field.");
    return BigInt(x);
  };
  if (
    !proof ||
    !Array.isArray(proof.signals) ||
    proof.signals.length !== 43 ||
    !Array.isArray(proof.a) ||
    proof.a.length !== 2 ||
    !Array.isArray(proof.b) ||
    proof.b.length !== 2 ||
    !Array.isArray(proof.c) ||
    proof.c.length !== 2 ||
    proof.b.some((row) => !Array.isArray(row) || row.length !== 2)
  )
    throw new Error("Choose a valid exported proof file.");
  [...proof.a, ...proof.b.flat(), ...proof.c, ...proof.signals].forEach(uint);
  const unpack = (start, count) => {
    const b = [];
    let ended = false;
    for (const f of proof.signals.slice(start, start + count)) {
      let n = uint(f);
      if (n >> 248n) throw new Error("Invalid disclosure field.");
      for (let j = 0; j < 31; j++) {
        const c = Number(n & 255n);
        n >>= 8n;
        if (!c) ended = true;
        else {
          if (ended) throw new Error("Invalid disclosure padding.");
          b.push(c);
        }
      }
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(b));
  };
  const d = extractDisclosures(unpack(1, 13) + unpack(23, 20), unpack(14, 9));
  return {
    summary: { ...d.summary, keyHash: uint(proof.signals[0]).toString() },
  };
}
