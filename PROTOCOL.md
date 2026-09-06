# Protocol and trust boundaries

## Bounty statement

For bounty `id`, the escrow accepts a pair of proofs if all of the following hold:

1. Each proof verifies under the immutable Groth16 verifier and exposes the immutable `githubKeyHash`.
2. Both full DKIM-signed header messages and full bodies authenticate under RSA-SHA256. The body hash in the signed DKIM header agrees with the body SHA256.
3. The complete signed PR subject identifies the funded `owner/repo`, PR `P`, one payout wallet, and this bounty reference. The complete issue subject identifies that same repository and funded issue `I`.
4. At body byte zero, the supported native first MIME part says `Merged #P into B.` for the PR and `Closed #I as completed via #P.` for the issue. Branch `B` equals the funded target branch. The contract does not search arbitrary body text for these phrases.
5. The complete authenticated DKIM line asserts `d=github.com`, `a=rsa-sha256`, `c=relaxed/relaxed`, `v=1`, an issuance time, a body hash, and a signed subject. A body-length `l=` tag is rejected.
6. Both issuance times are within the bounty's creation/deadline window and not ahead of the current block. The claim is submitted before the deadline plus seven days.
7. The bounty is open and its reference equals `keccak256(abi.encode(block.chainid, address(escrow), id))`.

Successful verification changes `Open → Paid` once and credits the wallet in the signed title. `msg.sender` is not the beneficiary selector. The alternative terminal transition is `Open → Refunded`, funder-only and after the claim grace period. Withdrawal zeroes the caller's credit before transferring ETH and is guarded against reentrancy. A failed transfer reverts the entire withdrawal.

## Circuit disclosures

The circuit has 43 public output field elements:

| Indices | Meaning |
|---|---|
| 0 | Poseidon hash of the RSA modulus, using the upstream 121-bit × 17-limb representation |
| 1–13 | Complete signed subject, at most 403 bytes |
| 14–22 | Native first MIME/event prefix, at most 279 bytes, anchored to body byte zero |
| 23–42 | Complete canonical DKIM signature header with `b=` value empty, at most 620 bytes |

Disclosures are packed into 31-byte little-endian words and zero-padded. The on-chain parser rejects out-of-range words, interior zero padding, incomplete subject endings, ambiguous markers, wrong event types and mismatched numbers. The circuit binds header disclosure boundaries and requires the DKIM disclosure to end at the first SHA padding byte. The precomputed body SHA state is pinned to SHA256's standard IV, so an unproved body prefix cannot be substituted.

Compiled size: 5,617,070 constraints, 5,510,183 wires and 43 public outputs. This requires a power-23 Powers of Tau file. The actual padded header/body capacities are smaller than the array lengths because the upstream length representation excludes equality with its power-of-two buffer size.

## What is trusted

**GitHub:** Its DKIM key authenticates the data, notification template and issuance time. GitHub and authorized maintainers still decide when a PR is merged and an issue is completed. The protocol cannot independently establish code quality, repository governance, or a maintainer's honesty. Someone permitted to alter the PR title before merge can change the designated wallet.

**The verifier and ceremony:** Cryptographic soundness depends on the circuit constraints, generated verifier, RSA/SHA256/Poseidon/Groth16 assumptions and the ceremony. The on-chain contract has no administrator that can change its verifier or key. The development ceremony is not a production security claim.

**The local application:** It prepares witnesses and helps the user submit transactions, but has no signing key or separate authorization over the escrow. A dishonest service cannot make an invalid proof pass the contract. It could lie in its interface, omit jobs or mishandle private inputs, so run reviewed local code and inspect wallet transactions.

**DNS:** Used by the local preflight verifier to retrieve a public key. Settlement separately compares the proof's key hash to the immutable deployment key. A malicious DNS answer cannot replace that key in a successful claim, but an unavailable/deleted selector can stop the default preflight from processing old messages.

## Why account ownership is unnecessary here

The payment rule is “pay the address designated in the signed merged-PR title,” not “pay the person who owns GitHub account X.” Anyone can relay the receipt proofs, but no relay can change their public beneficiary without invalidating the proof. This removes the identity-enrollment step, while retaining the requirement that the address be authenticated in the same merged-PR receipt.

A signature from a claimant's wallet is only needed when that wallet authorizes withdrawal. GPG registration or an email-based proof of GitHub-account ownership would add a separate identity policy, not strengthen this existing payout rule automatically.

## Explicit limitations

There is no stable GitHub repository ID in the accepted disclosures. Exact repository names and funder trust in their lifecycle are therefore part of the rule. An issue may be reopened later; this protocol pays for a qualifying completed event, and settlement is not undone. A PR title changed after the native merge notification does not change the signed historical recipient. Bounties cannot be attached retroactively to already issued receipts because both the creation timestamp and deployment-specific reference must match.

The supported native event template is a security boundary. New GitHub formats need new fixtures, negative cases, circuit/policy review, and possibly a new deployment. Do not loosen parsing to accept arbitrary “Merged” substrings.
