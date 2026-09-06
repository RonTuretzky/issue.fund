# Verified local implementation

The local Anvil checks below were completed September 6, 2026, before the Gnosis deployment. The subsequent real-xDAI deployment and complete proof/claim/withdrawal test passed at 16:20 UTC; see [GNOSIS.md](GNOSIS.md). Both versions remain unaudited and use a development proof ceremony.

## Results

Public repository onboarding was added and checked on September 6, 2026. It uses GitHub's public API without credentials. A real issue was created using GitHub's own form reached from MergeBounty, discovered back in the app, funded through the new preflight review, refunded after local expiry and withdrawn. This new acceptance flow ran on Anvil and restored its snapshot; it did not modify Gnosis bounty #2. The static Gnosis build also passed real public-GitHub lookup and xDAI review, with no horizontal overflow at 390, 768, 820, 1024 or 1280 pixels.

| Check | Result |
|---|---|
| Solidity escrow and receipt policy | 31 tests passed, including 128 fuzz runs for credit conservation |
| Receipt parsing, private job lifecycle and public GitHub preflight | 23 tests passed |
| Browser suite | 24 UI state tests, 3 Anvil chain regressions and 1 real public-GitHub onboarding/funding/refund flow passed |
| Circuit tampering | 5 invalid witnesses rejected by circuit assertions |
| Actual GitHub signatures | Two original GitHub DKIM emails generated valid Groth16 proofs |
| Actual payout | A separate relayer submitted the claim; the title's wallet received and withdrew 0.05 test ETH |
| Actual refunds | Early refund rejected; funder-only refund and withdrawal to another destination passed |
| Accessibility | No automated WCAG A/AA violations on explore, detail, guide, repository browsing or funding review screens |
| Branding | Official Decentral Park mark, self-hosted fonts, palette and button styling; desktop/mobile reviewed |
| Build and local service | TypeScript/Vite build passed; built app, font/logo assets, Host/Origin guards checked |
| Privacy cleanup | Completed jobs contain no raw private inputs or witnesses |

The contract unit suite uses an explicitly test-only verifier to isolate policy. The three chain flows use the actual generated Groth16 verifier. UI state tests use controlled responses to exercise errors and recovery. These are distinct forms of evidence.

## Real receipt experiment

A bounty was funded through the interface before PR #10 merged into main and closed issue #9 in the private disposable lab repository. Gmail's original-message download supplied both genuine signed receipts. Their PR title carried the exact escrow bounty reference and beneficiary wallet.

The browser uploaded the two originals, inspected them, generated and exported fresh proofs, submitted the claim from a different account, and withdrew the credited ETH. The fresh proof generation and payout run passed in approximately 2.5 minutes. A subsequent run also checked importing the exported proofs against the real contract.

The test rejected an altered public signal, a replayed claim, and the relayer's attempt to withdraw the beneficiary's credit. It verified the recipient's exact final ETH balance including withdrawal gas. The expiry test checked the funder's refund and a separate withdrawal destination.

Latest settlement run: `2026-09-06T15:37:14.828Z`. Claim gas: **3,375,834**. Withdrawal gas: **33,138**. These are local EVM execution measurements, not estimates of a public-network fee.

The tests restore the funded snapshot and synchronize Anvil's clock after finishing. Bounty #1 remains open with 0.05 test ETH for a manual demonstration; the proofs remain at `.local/proof-pair.json`. Choose test wallet 3 to submit, then test wallet 2 to withdraw. Local transaction hashes are recorded in `.local/chain-e2e-results.json`; restored snapshot transactions are not persistent public-network receipts.

## Remaining production work

GitHub remains the source of event truth. Payment verification is on-chain, but the system still depends on GitHub's signing key and notification semantics. It does not prove code quality or contribution authorship.

The circuit-specific ceremony is for development, the GitHub key is pinned with no rotation or revocation, the observed key is RSA-1024, the parser supports a narrow notification format, and repository names can be renamed or reused. A reviewed ceremony, security audits, durable repository identity and key lifecycle handling are required before a production rollout. See [PROTOCOL.md](PROTOCOL.md) and [OPERATIONS.md](OPERATIONS.md).

Latest dependency audit: 16 low-severity findings in transitive dependencies, zero moderate/high/critical findings. This does not establish absence of vulnerabilities.
