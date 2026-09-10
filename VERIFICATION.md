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

GitHub Pages published logo source `f964c855b45059385b3d93128a78f97977031f94`; the live version manifest and successful Pages build agreed. The logo/favicon, responsive header, home navigation, and funding-dialog smoke checks passed again on `https://issue.fund/`, with zero page errors and zero transactions sent.

## Selected Bounty Ticket identity

The user selected option 3, Bounty Ticket. The header and browser/home-screen icon now use the transparent terminal-ticket mark with a green tab, paired with live text in a locally hosted Anton subset. The earlier checkmark asset was removed; brand notes preserve the generation prompts and font license.

The static Gnosis build, TypeScript, documentation consistency, and diff checks passed. Four handbook/branding browser cases passed on the first run; the accessibility case timed out during an unusually long run, then passed on its isolated retry. The logo/font/favicon and home-link/funding-dialog smoke check passed at 1440, 1024, 800, 390, and 320 pixels, with no header overlap, horizontal page overflow, or browser page errors. Desktop and mobile screenshots were reviewed. These checks sent no transactions.

The selected ticket identity was published from source `ce12b20203a5982eceac5d27907af74213a7d9b4`, confirmed by the live version manifest and successful GitHub Pages build. Logo, locally hosted wordmark font, favicon, responsive-header, navigation, and funding-dialog checks passed on the live HTTPS site with zero page errors and zero transactions sent. The existing user-facing live tab was refreshed to the new asset.

## Premium automation contact for maintainers

Added a shared maintainer-service note to the homepage, repository directory, maintainer onboarding, and funding guide. It offers premium setup of email collection/submission so contributors can skip uploads and links to `mailto:turetzkyron@gmail.com` with an inquiry subject. It describes an arranged service; no collector implementation or payment behavior changed.

The static Gnosis build, TypeScript, generated-documentation consistency, and diff checks passed. All five documentation/branding/accessibility browser checks passed. The note and exact mail link were checked on all four routes, with mobile overflow and desktop/mobile screenshot checks. No emails or transactions were sent.

GitHub Pages published the contact update from `bd41ad0396697d2900f339d2d72168e08a19dfa0`, confirmed by the live version manifest and successful Pages build. The note and exact mail link passed checks on all four live HTTPS routes; the existing live browser tab was refreshed. No emails or transactions were sent.

## Automation frontend and persistence checkpoint

Added collector preparation/readiness, explicit manual fallback, automatic claim
status, immutable V2 fee/net quotes, contract-qualified bounty links, legacy link
resolution and per-escrow credit withdrawal. The existing 32-case browser run
passed 31 cases; the failure was a stale navigation count after adding two guides.
After correcting it, all eight automation/documentation cases passed, including
readiness loss immediately before funding and independent V1/V2 withdrawal.
Paid bounty headlines now show the net credit. TypeScript and the static Gnosis
build pass. These tests used local Anvil and synthetic email fixtures.

25 automation tests pass, including terminal-retention/reorg behavior, encrypted
payload capacity and an online SQLite backup/restore while the writer remains
open. The collector now closes its store after in-flight work on shutdown.
DigitalOcean droplet 599168492 was provisioned with a dedicated key, restricted
firewall, backups and DNS at api.issue.fund. Runtime deployment verification is
still in progress; automatic disclosure remains gated and V2 is not on Gnosis.

The complete browser suite now passes all 34 cases. Additional browser RPC checks
read both locally deployed escrow versions, resolve the same bounty ID independently,
and reject a manifest with altered immutable fees. Automatic status cannot show
credited funds while the browser's chain read still reports an open bounty. The
static Gnosis build passes. The public frontend still serves the previous release.

DigitalOcean now serves https://api.issue.fund with a valid HTTPS certificate and
HTTP redirect. The service API, separate Unix identities, protected credential
files, private signer network, and rejection of an invalid signing request were
checked on the deployed host. A forced-stop drill restarted both supervised
processes with their persistent databases and Unix socket intact. Both database
snapshots restored successfully; a protected off-server backup copy has the same
SHA-256 as the source archive. Automatic disclosure and relay are disabled. Health
reports the missing mailbox; preparation returns maintainer_installation_required.
No production claims or fund transfers were made by these deployment checks.

## CI, V2 release tooling and bounded indexing

[CI run 34415924566](https://github.com/RonTuretzky/issue.fund/actions/runs/34415924566)
completed successfully for source `160e12fce96b051947717f6a4ef3cd8614df7824`:
50 Solidity tests, 25 automation tests, two V2 deployment tests, the existing
JavaScript/local-chain checks, static build and all 34 browser cases. The original
Etherform installer failed before contract tests; the corrected workflow pins a
working official Foundry action and executes the entire contract suite directly.

V2 deployment now has a read-only cost/terms plan, a signed-transaction checkpoint
written before broadcast, recovery without changing the deployment nonce, and
verification of immutable fees, bytecode, confirmations and legacy escrow links.
An isolated Anvil test verifies recovery after a lost broadcast response. No new
Gnosis deployment has been made; the fee treasury is still required.

Subsequent indexer changes pass all 30 automation tests locally. A persistent
funding queue and rotating active sweep bound bounty reads; failed RPC reads and
process restarts retain progress. Enrollment discovery has a separate retry
budget. Regression tests also cover a reorg during log retrieval, transactional
event checkpoints, and settled jobs whose later settlement is orphaned while
their original funding remains canonical. These tests use controlled RPC fixtures
alongside the existing real Anvil relay suite; they are not live-chain fault tests.

[CI run 34416415413](https://github.com/RonTuretzky/issue.fund/actions/runs/34416415413)
then passed for `8f2d96d334d648060fc528f81a9777d04b195284`, including all 30
automation tests, 50 Solidity tests, two deployment tests and 34 browser cases.
The JavaScript/local-chain checks and static build passed; the optional private
original-email chain test was skipped in CI as intended.

That source is deployed on DigitalOcean. The service health, private signer
network, credential separation, exact invalid-sign policy rejection and both
database restores passed again. The live collector has the new queue/sweep schema,
two indexed bounties, no pending discovery backlog and zero relay transactions.
The relay address and disclosure validation remain unconfigured. Backlog issue #3
now records the implementation checkpoint while leaving live acceptance open.

## External monitoring checkpoint

Created DigitalOcean HTTPS availability check
`aa4cd079-dd99-4edc-a4ea-d1497fbc2c83` for `https://api.issue.fund/healthz`.
Provider state reports UP from US East, US West and Europe. Reapplying the operator
script retained the same ID and exactly one matching check. Its syntax and
read-only plan were checked before applying. No alert destinations are configured,
and no notification-delivery claim is made. This process/TLS check does not validate
the worker, mailbox, relay or backups. Runtime source and public frontend were
unchanged by this control-plane setup.

The operator script also prepares scoped outage, certificate, CPU, memory and disk
alerts for an explicitly chosen email address. The address choice is pending.
The documented Spaces key endpoint returned 404 with current account access;
the browser console is signed out. No bucket or storage key was created, and
recurring off-host export remains pending alongside the real-mail launch inputs.

## Operational health and backup failure detection

The monitoring target is being upgraded from process liveness to
`/v1/health/operational`. The new probe uses worker/chain freshness, configured
mailbox health, reported relay/repository errors, disclosure state and a root-owned
backup report. Backup status is written atomically after both snapshots pass
integrity checks; a partial failure cannot retain a previous success report.
Setup mode remains distinct from enabled automatic claims. All 35 automation
tests pass locally, including the added operational-health and partial-backup
regressions. Deployment and live failure/recovery verification follow separately.

Source `5e347729a19c04ddb07c404f984df2418ebba069` is deployed. Host verification
passed the operational probe, root-owned backup-report read/write isolation,
credential and signer-network separation, invalid-sign rejection and both database
restores. A controlled partial-backup attempt in setup mode returned failure and
made the public operational probe return 503 with `backup` listed. Running the
normal backup service restored HTTP 200 and a successful two-database report.
The temporary test copy was removed; no live database or escrow state was changed.

The existing DigitalOcean check now targets the operational probe and reports UP
in all three regions. Alert destinations remain unconfigured.
[CI run 34417480650](https://github.com/RonTuretzky/issue.fund/actions/runs/34417480650)
passed 50 Solidity, 35 automation, two deployment and 34 browser tests, plus the
JavaScript/local-chain checks and static build. The optional private-email test
remains skipped in CI.

The Chrome session is signed in as RonTuretzky, but GitHub requires its Confirm
access re-authentication before collector App registration. That handoff is open;
no App credential or installation has yet been created. The compatible watching
PAT, Gmail credentials, fee treasury, alert recipient and off-host storage access
are still missing. Automatic disclosure and relay remain disabled.

## September 10: GitHub App and owner-managed V2 deployment

- Created the collector App (4898691), installed it only on the public acceptance
  repository, and verified Metadata read / Issues write / Pull requests write
  permissions. The `DecentralParkNY` collector has no repository privileges.
- Fresh Gnosis escrow: `0x1f5cE96dFa05D207Ca8E59C6ab4B9F1895D24630`.
  Initial owner and fee recipient: `0x86213f1cf0a501857B70Df35c1cb3C2EcF112844`.
  Fee: fixed 1%. Deployment reached 12 confirmations, runtime and immutable
  values matched source, and explorer source verification succeeded.
- Only the owner can change future fee routing. Existing credits remain with
  their original recipients. Ownership transfers require acceptance; pending
  transfers can be cancelled. Live read-only simulations accepted the owner and
  rejected unauthorized and zero-recipient calls. No live routing change was sent.
- Local validation: 54 Solidity, 35 automation, 16 GitHub/DKIM, two deployment,
  three local-chain and 35 browser tests pass. The local-chain suite also verifies
  original GitHub signatures privately; this is not a genuine V2 mainnet claim.
- Source `ac49267d0ffaf3ec5457b9d04182efbda3f4b211` is deployed on both
  GitHub Pages and DigitalOcean. The public site serves V2, preserves V1 bounty
  links and balances, and exposes fee controls to the connected owner/pending
  owner. Live browser checks used a read-only test wallet provider with signing
  blocked; mobile layout, fee docs and legacy bounty #2 passed without page errors.
- The backend accepts both manifests and the App credentials. Storage/signing
  keys were preserved; service, signer isolation, backup report and both database
  restores pass. Preparation for the public test issue now reaches
  `classic_watch_token_required`, rather than missing App installation.
- Automatic collection/relay remains disabled. A compatible classic bot PAT,
  Gmail access, real reply-lock/replay validation and a genuine V2
  fund/collect/claim/withdraw test are still needed. Alert delivery and recurring
  off-host exports remain outstanding. The fee treasury and App registration are
  now complete; earlier pending notes above describe previous checkpoints.

CI [34490470026](https://github.com/RonTuretzky/issue.fund/actions/runs/34490470026) passed on the exact deployed source, including contract, deployment, automation, static build and full browser suites. The optional private original-email fixture remains skipped in CI.


## September 10: genuine V2 public-site acceptance

The opt-in funding and claim/withdrawal browser tests both passed on
`https://issue.fund`, using a fresh public issue #5 and merged PR #6. Original
native merge and closure emails arrived at the outside `DecentralParkNY` Gmail
account. The App verified that account's lack of repository privileges and locked
both completed conversations before the manual claim disclosed the receipts.

V2 bounty #1 funded 0.0001 xDAI. Local browser RSA checking preceded disclosure
consent; the live verifier accepted both receipts. Paid and ClaimFee events matched
0.000099 xDAI contributor credit plus 0.000001 xDAI treasury credit. Replaying the
claim reverted with NotOpen. Contributor withdrawal succeeded, cleared its credit,
and increased its balance by the exact net credit less withdrawal gas. The genuine
claim used 10,251,619 gas. A treasury withdrawal simulation passed; the fee remains
credited to the user's wallet and no treasury/ownership transaction was signed.

See [transactions and scope](GNOSIS.md#v2-real-github--issuefund--gnosis-acceptance-test)
and [sanitized evidence](deployments/gnosis/v2-e2e.json). Existing V1 records are
preserved. Only tests and documentation changed; the tested deployed source is
still `ac49267d0ffaf3ec5457b9d04182efbda3f4b211`.

The supplied bot token authenticates and reveals the collector's verified Gmail
address, but is fine-grained and cannot watch repositories through the API. Browser
watching and original-message download worked. Server Gmail authentication and a
compatible bot watching token remain absent. A newly generated token resolved to
the wrong browser account; it was never deployed and revocation was verified.
Automatic disclosure/relay stays disabled pending these credentials, the real
reply-lock/replay matrix, relay acceptance, alert delivery and scheduled off-host
exports. This manual acceptance run does not establish unattended operation.


## Existing-token subscription verification

The collector now verifies an already enabled public repository watch through
GitHub GraphQL when using a fine-grained PAT. The actual supplied token confirmed
`DecentralParkNY` and `SUBSCRIBED` for the example repository. A GraphQL write was
also tested and rejected by GitHub, so the service does not claim to subscribe new
repositories with this token. New watches need operator setup or compatible classic
authentication. Ignored/unsubscribed state, private/mismatched repositories and
HTTP-200 GraphQL errors cannot establish readiness. All 36 automation tests pass.

Google's account settings show 2-Step Verification off for the collector Gmail
account; app passwords are unavailable until the owner enables it. The setup page
was opened for the user. No mailbox password or disclosure-validation record has
been invented, and automatic submission remains off.

## Live automatic collection, claim and withdrawal — September 10

The server's Gmail IMAP connection is configured. It filters notifications before
fetching message bodies and preserves read-only polling. The real new-issue email
revealed that initial notifications omit `Re:`; the collector now recognizes them
for delivery readiness while retaining strict native settlement parsing.

The operator explicitly accepted exposure of the dedicated collector account's
reply credentials and requested enabling auto-submit. A private account/mailbox-
scoped acceptance record enables that policy separately from validation; the API
reports `disclosureValidated: false` and `disclosureAuthorized: true`. No unrun
SMTP forgery/replay or reply-lock test is recorded as passed.

The genuine public-site automatic run passed: issue #7 → V2 bounty #2 funding →
PR #8 merge/closure → server IMAP collection and verification → both locks →
relay transaction → exact 1% fee and contributor credit → browser withdrawal.
The browser sent no claim and uploaded no receipt. Replay was rejected. Both
server processes restarted with one confirmed transaction and preserved withdrawn
state, and operational health remained healthy in automatic mode. See
[the public evidence](deployments/gnosis/automatic-e2e.json).

All 40 automation tests pass on both Node 22 and Node 24.21.0. An additional 26
non-chain automation cases passed on the deployed Linux runtime. The browser
regression for configuration arriving after funding opens passed, and the live
funding test verified automatic selection and Notifications ready. The static
build and documentation checks pass. Backend source is `eff861c9c46d231629e9129da46736a56954c4c3`;
frontend source is `01651ae0e8cbf599ca573351ba01ee8e3910faaa`.

Additional repositories need the maintainer App and operator-enabled watching
(or compatible subscription-writing authentication). External alert delivery and
recurring off-host backup exports remain open operational work. This controlled
live acceptance is not an independent security audit.
