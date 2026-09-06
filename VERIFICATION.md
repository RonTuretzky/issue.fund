# Verification record

The direct implementation was tested on September 6, 2026. No independent security audit has been completed.

- 16 JavaScript tests passed for public GitHub validation and direct DKIM checks.
- 35 Foundry tests passed, including 128 randomized escrow-conservation cases.
- 23 interface/onboarding tests passed, including wallet rejection, public-only checks, final funding preflight, accessibility and mobile layout.
- The additional browser integration passed local signature checks → disclosure consent → actual RSA contract claim from a relayer → beneficiary withdrawal. No email-bearing request was sent during local checking.
- Full chain tests passed with independent synthetic RSA-1024 and RSA-2048 keys. They used the actual verifier, not a mock, and checked tampering, wrong bounty references, replay, unauthorized withdrawals and exact balances after gas.
- Two genuine original GitHub native notifications passed WebCrypto and the actual pinned-key verifier on local Anvil. The historical raw originals remained local.
- A real public GitHub issue passed anonymous discovery → final preflight → actual Anvil funding → expiry refund → withdrawal through the browser.
- The Gnosis direct verifier and escrow deployed successfully; runtime bytecode, immutable linkage and pinned modulus were checked against the build.

Synthetic local claims consumed approximately 2.90 million gas for two receipts; genuine notification gas depends on header/body size and must be estimated before submission. Local integration tests restore snapshots, so their transaction hashes are not persistent public-network records. Genuine email fixtures and private keys are not committed.

See `TESTING.md` for commands and `GNOSIS.md` for the deployed addresses. Legacy ZK test results belong to the archived branch and are not evidence for this replacement implementation.

The fresh **real Gnosis** acceptance test also passed: a public GitHub issue and PR generated two new genuine emails; the static browser checked them locally, the actual on-chain verifier settled the bounty, and the recipient withdrew 0.001 xDAI. All three transactions succeeded. See `deployments/gnosis/e2e.json` and the linked transaction records in `GNOSIS.md`. The legacy escrow's bounty #2 was separately confirmed still open with its original 0.001 xDAI.

Both deployed contract sources were verified on Gnosisscan. The genuine two-email claim used 9,283,775 gas; the successful public transaction is recorded above.

## issue.fund documentation and hosting update

On September 6, 2026, all 29 browser checks passed after the rename and documentation integration. These cover repository discovery and funding, wallet errors, disclosure-gated local RSA checking, a real local-contract claim and withdrawal, and the new handbook. All 14 guides were opened through the catalogue; hash links, reload and browser history, missing-page recovery, offline reading, mobile navigation at 320/390 pixels, and footer-only Decentral Park attribution passed. Automated WCAG checks passed for the documentation hub and representative onboarding, PR, privacy and contract pages. Desktop and mobile screenshots were reviewed.

The static Gnosis build, generated-documentation consistency check, TypeScript check and Cloudflare Wrangler dry run passed. The initial Cloudflare publish was rejected with authentication error 10000; a successful dry run is not a live deployment. The hosting setup was subsequently changed to GitHub Pages with Cloudflare DNS; see [hosting configuration](CLOUDFLARE.md). Contract code and deployed addresses were unchanged by this update.
