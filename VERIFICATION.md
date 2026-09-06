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

## GitHub Pages and issue.fund

On September 6, 2026, the static app was published to the `codex/pages` branch of `RonTuretzky/issue.fund` and GitHub Pages completed its deployment. Cloudflare DNS points the apex to all four GitHub Pages IPv4 addresses, with `www` pointing to `ronturetzky.github.io`. All five records use DNS-only mode.

GitHub issued an approved certificate for both `issue.fund` and `www.issue.fund`, and HTTPS enforcement was enabled. A direct anonymous HTTPS request returned 200; HTTP, the `www` variant, and the default GitHub Pages URL all redirected to `https://issue.fund/`.

A fresh browser session on the live HTTPS domain passed: all 14 guides listed, maintainer and contributor navigation, deep-link reload, public repository onboarding using GitHub's real API, funding review of an actual open issue in xDAI, and reading existing Gnosis bounty #1. No browser page errors occurred. The browser confirmed a secure context, and the mobile page fit a 390-pixel viewport. Desktop and mobile screenshots were reviewed. These deployment checks sent no transactions; the previously recorded on-chain claim and withdrawal remain the payment acceptance evidence.

The published `/site-version.json` identifies source commit `4f704a88d1d94f31bc520cf1324d811dd30ef7a1`. See `deployments/hosting/github-pages.json` for the deployment record and `CLOUDFLARE.md` for configuration and repeat publishing instructions.

## Issue-first funding and bookmark removal

On September 6, 2026, repository add/save/remove controls and browser-storage helpers were removed, including the implicit bookmark write during funding. The optional repository directory now derives its entries from loaded escrow bounties. Funding starts directly from an open public GitHub issue URL, and the maintainer handbook and README describe this path.

All 29 browser checks passed, including the empty-directory issue URL path with obsolete bookmarks present, directory reload without storage, public-only validation, issue browsing/search/pagination, final funding preflight, documentation, accessibility, mobile layout, and the actual local RSA claim/withdrawal integration. The real public-GitHub integration also passed direct issue URL review → local Anvil funding → expiry refund → withdrawal, restoring its chain snapshot afterward. The static Gnosis build, TypeScript, generated documentation, and diff checks passed. No contract change or new public-chain payment was needed.

The automatic email collector and claim relay remain a proposal in [backlog issue #3](https://github.com/RonTuretzky/issue.fund/issues/3), with the reply-credential disclosure dependency linked to issue #2.

GitHub Pages completed the update from source `58dc98268e260db2a12d7048c04c4c14e0f1adb8`, confirmed by the live `/site-version.json`. Live HTTPS browser checks passed the bounty-derived directory with no bookmark controls or storage writes, real GitHub issue browsing, direct review of an open issue in xDAI, all 14 documentation entries, onboarding navigation/reload, and the existing Gnosis bounty. Desktop and mobile directory screenshots were reviewed with no overflow or page errors. These deployment checks sent no transactions.

## issue.fund logo

On September 6, 2026, the new issue.fund mark was added to the header alongside live text and configured as the favicon/home-screen icon. The transparent original and built-in generation prompt are preserved under `public/brand/issue-fund/`. Decentral Park attribution remains in the footer.

The static Gnosis build and generated-documentation/TypeScript checks passed. All five handbook/branding/accessibility browser checks passed. A browser smoke check verified successful logo and favicon loading, the home link and funding dialog, and no logo/wallet overlap or horizontal page overflow at 1440, 1024, 800, 390, and 320 pixels. Desktop and mobile screenshots were reviewed. No contract code changed.
