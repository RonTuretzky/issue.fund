# Security review — automation and claim fees

Date: 2026-09-10. This is an implementation review with local regression tests,
not an independent audit or a statement that production launch is complete.

## Scope and deployment boundary

Reviewed `MergeBounty`, `GithubDkimVerifier`, `ReceiptPolicy`, `RsaSha256`, the new
`MergeBountyV2`, and the collector/relay boundaries introduced on
`codex/automation-production`. V1 source and deployed economics are preserved.
V2 is a separate deployment with a fixed fee percentage and owner-controlled fee routing.
The initial fee recipient and owner is `0x86213f1cf0a501857B70Df35c1cb3C2EcF112844`.
Existing V1 balances retain their original terms.

## Findings and disposition

| Finding                                                                | Consequence                                                                                             | Disposition                                                                                                                                                                                                            |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Signed notification headers expose working reply credentials           | Comment impersonation as the notification recipient; not proof of payout theft or full account takeover | Previously confirmed in issue #2. Automatic disclosure is gated on a dedicated outside account, both conversation locks, transport validation and a live acceptance record. Live lock/replay tests remain outstanding. The operator explicitly accepts collector impersonation exposure; a separate scoped acceptance mode enables the relay without claiming validation. |
| Recipient identity headers are unsigned in actual samples              | Trusting `X-GitHub-Recipient` alone would let modified/replayed mail misidentify the exposed account    | Added a direct Gmail delivery policy plus local DKIM verification. Its ingress assumptions still require live forgery/replay validation; other providers fail closed.                                                  |
| GitHub can rotate its pinned DKIM key or change notification templates | New receipts can become unverifiable; users rely on the refund path after the grace period              | Inherent V1/V2 deployment constraint. Monitor key/template drift, pause automation, preserve old escrows, and deploy a reviewed verifier version rather than silently substituting a trust root.                       |
| Current pinned GitHub key is RSA-1024                                  | Security strength is constrained by GitHub's signing key                                                | Verifier supports 1024/2048-bit moduli; an arbitrary larger key cannot verify GitHub's existing mail. This remains a provider constraint.                                                                              |
| Receipt verification is gas-heavy                                      | A public relay can exhaust its gas balance even without a payout exploit                                | Local verification before RPC, enrollment/admission limits, strict claim-only signer, per-claim caps, daily reserved budget and dedicated relay wallet. Genuine server-submitted V2 claim measured 10,232,103 gas; live fee credit, withdrawal, replay and restart checks passed.    |
| Mutable locks and account roles                                        | Public tokens may become useful again after unlocking or privilege changes                              | Operational dependency, not an on-chain guarantee. Persistent-lock obligations and residual risk are documented; live validation remains required.                                                                     |
| A fee sent directly to a receiver during settlement could block payout | Rejecting/reentrant fee receiver could disrupt otherwise valid claims                                   | V2 uses pull credits for both beneficiary and treasury. Failure to withdraw cannot block settlement or take the other credit.                                                                                          |
| Reusing a nonce after uncertain broadcast or restart                   | Duplicate gas expenditure, stuck jobs or wrong transaction replacement                                  | Signed payload persisted before broadcast; same-nonce recovery/replacement, restricted cancellation, budget ledger and block-hash checks. Tested locally with lost responses, competing claims and a reorg.            |
| Unbounded bounty rereads and repeated enrollment attempts              | Growth or spam could delay the mailbox/relay and exhaust GitHub API capacity                            | Indexing now checkpoints a durable funding queue, bounds per-poll bounty reads and rotates active work across restarts. Unenrolled discovery has a separate retry budget.                                              |
| Settled jobs excluded from active sweeps after a reorg                 | An orphaned refund/withdrawal could remain visible as completed                                         | Detected scan reorgs also enqueue settled jobs; open bounties clear orphaned settlement even without repository enrollment. Local regression tests cover this case.                                                    |

## Contract properties checked

RSA verification checks the complete SHA-256 PKCS#1 v1.5 encoded block, signature
length, signature less than modulus, body hash and bounded signed bytes. Receipt
policy rejects copied event comments, duplicate subjects/timestamps, partial-body
signatures, expired signatures, invalid event IDs and unsupported formats.

Escrow claims bind chain/contract/bounty reference, repository, issue, closing PR,
branch, signed wallet and both signature timestamps. Claims are permissionless
but a submitter cannot change the signed payout wallet. Settlement and refund
are exclusive, with a seven-day submission grace period and pull withdrawals.
The test suite covers replay, invalid bindings/windows, unauthorized withdrawal,
failed receiver transfers, reentrancy and conservation of escrowed value.

V2 adds an immutable fee rate with a 500-basis-point hard maximum. The initial
fee recipient is also the owner, using OpenZeppelin Ownable2Step. Only the owner
can change future fee routing. Ownership transfer requires acceptance by the new
owner; pending transfers can be cancelled. Zero/escrow fee recipients and escrow
owners are rejected, and ownership cannot be renounced. Rotation never transfers
previously earned credits, changes the fee rate, or grants access to contributor
credits, the verifier or active bounty principal. Deployment checks pin the initial
recipient and verify the initial owner; runtime checks allow authorized routing changes.
`quoteClaim` uses overflow-safe multiplication, rounds the fee down, and leaves
all remaining wei with the contributor. `Funded.amount` remains the gross reward;
`Paid.amount` is the contributor's net credit; `ClaimFee` records the gross/fee.
No fee accrues on invalid claims, refunds or repeated submissions. The treasury
cannot withdraw open bounty principal. Contributor=treasury is accounted for
without losing or creating credit. Zero and escrow-self payout addresses are
rejected defensively in V2.

No additional demonstrated contract payout bypass was found in this review.
That does not prove the absence of vulnerabilities, and synthetic fixtures do
not establish that every current GitHub email variant is supported.

## Evidence as of this checkpoint

- 54 Solidity tests pass, including the existing RSA/policy/escrow cases and 19
  V2 fee and ownership cases; fuzz cases run 128 inputs each.
- 40 automation tests pass, including a real local EVM path using **locally
  generated RSA signatures**, encrypted receipt persistence, out-of-order/dedup
  handling, admission/readiness checks, disclosure gating before RPC, fee payout,
  withdrawal, gas depletion, restart after a lost broadcast response, replacement,
  competing-claim cancellation and recent reorg recovery.
- Operational health regression tests cover stale/future heartbeats, conditional
  mailbox/disclosure checks, private-error redaction, incomplete/stale backup
  reports, and HTTP 503 while the process liveness endpoint still returns 200.
- 16 existing JavaScript GitHub/DKIM tests pass; the static Gnosis build passes.
- DigitalOcean, GitHub and the collector's Gmail IMAP authentication succeed.
  The supplied fine-grained PAT verifies an existing public repository watch
  through GraphQL; it cannot create new subscriptions.
- Initial issue/PR notifications establish delivery readiness without becoming
  settlement receipts. The IMAP adapter filters senders before downloading bodies
  and preserves read-only polling, UID recovery and deduplication.

## Release work still required

The frontend now includes automatic/manual onboarding, status flows, exact fee/net
quotes and separate V1/V2 bounty identities and withdrawal balances. Local browser
checks cover readiness loss, manual fallback, old links and independent withdrawal.
The static build passes; browser RPC coverage verifies both deployed local escrows and rejects changed
immutable fee rates while accepting authorized fee-recipient changes. The new
fee owner controls also pass browser transfer, cancellation, acceptance and mobile
accessibility checks. V2 is deployed on Gnosis. A genuine public-site manual collection, claim, fee credit
and contributor withdrawal run passed on September 10; see [the evidence](../../deployments/gnosis/v2-e2e.json).
Retention uses a persistent settlement timestamp and prunes settled encrypted
payloads after 30 days, while active transactions pin their evidence. An online
backup/restore test passes. DigitalOcean deployment and HTTPS are live. The operator has authorized relay and
automatic disclosure under explicit collector-risk acceptance. Separate users, secret access, the private signer network and a live
database restore have been checked.

The maintainer App is installed only on the public acceptance repository; its
permissions and the outside collector role were verified against GitHub.

Verify external alert delivery and off-host backup scheduling; arrange watching
for additional repositories; and preserve the evidence from the completed genuine unattended GitHub-to-Gnosis
fund/collect/claim/withdraw acceptance run. See [automatic evidence](../../deployments/gnosis/automatic-e2e.json). Review the final source and deployed
bytecode after these changes. Do not label the release production-ready before
those requirements are evidenced.

## Operator-accepted collector exposure

On September 10 the operator explicitly requested auto-submit despite possible
impersonation of the dedicated collector account. `readRiskAcceptance` records
this decision separately from test validation and binds it to the exact GitHub
numeric account ID and Gmail mailbox. Default configuration remains disabled.
The API distinguishes authorization from validation. Regression tests cover
missing/incorrect acknowledgment, changed account/mailbox, file permissions,
readiness, and retained role/identity/lock checks. The live reply-lock and SMTP
forgery/replay matrix has not been run and is not represented as passed. Direct
Gmail ingress assumptions and reversible lock/account-role risks remain.
