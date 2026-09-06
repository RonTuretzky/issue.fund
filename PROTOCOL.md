# Direct RSA/DKIM protocol

The payment rule is “credit the wallet designated in the authenticated merged-PR title, when a native GitHub closure notification links that PR to the funded issue.” This is not a GitHub account-ownership claim. GitHub is the event authority; the chain independently verifies its signed email evidence.

## Accepted claim

`claim(id, merged, closed)` accepts two receipts, each containing the canonical signed headers, complete canonical body and RSA signature. The verifier pins the RSA modulus; its key identifier is `keccak256(modulus)`. Exponent 65537 is fixed.

For each receipt:

1. Headers are bounded to 8192 bytes; bodies to 65536 bytes. The client additionally bounds original uploads to 100 KB.
2. The signed DKIM tags require `v=1`, `a=rsa-sha256`, `c=relaxed/relaxed`, `d=github.com`, `s=pf2023`, a positive timestamp, `h=`, `bh=` and the blanked final `b=`. Duplicate and unknown tags, including `l=` partial-body signatures, fail closed. Optional expiry must be valid. Exactly one subject is authenticated; the signed header order must agree with `h=`. GitHub's oversigned missing `From` occurrence is supported.
3. `bh=` must equal Base64(SHA256(full canonical body)). SHA256(canonical signed headers) must verify against the existing RSA signature. The implementation compares the complete PKCS#1 v1.5 encoded block, including every padding byte and SHA-256 DigestInfo, after modular exponentiation. It rejects signatures at or above the modulus and wrong lengths.
4. The subject must be the supported native GitHub `Re: [owner/repo] … (PR #N)` or `(Issue #N)` form. The first MIME part must be the exact observed text/plain template. The event paragraph must say `Merged #N into BRANCH.` or `Closed #I as completed via #N.`
5. The GitHub-generated footer must contain the same repository, thread and event ID in both its `#event-ID` URL and `/issue_event/ID@github.com` Message ID. It must end at the actual text-part MIME boundary, with the matching HTML part and final boundary. Exactly three occurrences of that boundary are accepted. A signed comment quoting “Merged…” or injecting a fake footer does not meet this policy.

The escrow then requires:

- An existing, still-open bounty, with submission no later than `deadline + 7 days`.
- The same case-sensitive repository on both events; the funded issue in the closure; the same PR in merge and closure; and the funded target branch in the merge.
- Exactly one nonzero `[wallet 0x…]` and one `[bounty 0x…]` marker in the merge-time title.
- A bounty reference equal to `keccak256(abi.encode(chainId, escrowAddress, bountyId))`.
- Both authenticated DKIM timestamps at or after creation, at or before the completion deadline, and not in the future relative to the chain.

Successful claims consume the bounty and credit the signed wallet. No caller identity can redirect that credit. Only the credited wallet can withdraw, optionally to another address. State updates precede the transfer; reentrancy is blocked. Failed transfers preserve credit. After the grace period, only the original funder can refund an unclaimed bounty into their own credit.

## Trust and limitations

**GitHub and email semantics.** DKIM authenticates a GitHub-generated message, not a consensus vote about code quality. Maintainers decide what to merge; a compromised GitHub signing key could forge evidence. The parser supports the exact observed native notification format, not arbitrary email. GitHub template changes can stop new claims and require a reviewed new deployment. No GitHub API response authorizes a payout.

**Pinned key lifecycle.** The live deployment pins GitHub's observed `pf2023` RSA-1024 public key. OpenZeppelin's general RSA helper requires at least 2048 bits; this implementation uses its modular-exponentiation utility and a narrow full-padding checker to support the actual GitHub key. RSA-1024 is an inherited security limitation, not a claim of modern 2048-bit strength. The code also supports 2048-bit moduli in separate deployments. There is no key rotation, revocation, admin, upgrade, oracle override or emergency seizure function. If GitHub rotates or revokes this key, existing cryptographically valid signatures remain valid under the pinned key; a new deployment is required for another key. Observe key changes before funding long deadlines.

**Repository identity.** Email evidence binds the owner/repository name, not GitHub's durable numeric repository ID. Anonymous UI preflight checks numeric identity and canonical naming before funding, but it cannot eliminate rename/reuse attacks during an active bounty. Private repositories are outside the supported UI. The permissionless contract cannot independently determine current GitHub visibility, or whether an issue exists, at funding time.

**Receipt availability and payout designation.** Claimants need the two native emails, signed within the bounty window. Subscribe beforehand. A PR can close several issues, but its one bounty-reference marker cannot automatically claim multiple separately funded bounties. Renaming a title after the merge does not rewrite its original receipt. A branch-only wallet marker is not supported by the observed receipts.

**Public disclosure.** Signed headers can include addresses and reply/unsubscribe capabilities. Full canonical bodies, including any notification links, are public in direct claim calldata. The browser does not send email data during local checking; after the disclosure acknowledgement, simulation and wallet submission may send it to RPC operators even if no transaction is mined. There is no selective redaction in direct DKIM mode. Do not log receipt calldata or include originals in bug reports.

**Client and RPC.** The client can be independently hosted. It does not authorize payments and has no custody key. A malicious UI can still mislead wallet actions or disclose selected files, so review the deployed source and wallet transaction. RPC providers can censor or misreport reads, but cannot make invalid signatures pass the contracts. The current UI shows the newest 100 bounties; full-history indexing remains future work.

The cryptographic code and application are experimental and unaudited. The archived optional privacy design and its remaining work are documented in [issue #1](https://github.com/RonTuretzky/mergebounty/issues/1).
