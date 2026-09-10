# Test the direct implementation

Run `npm ci --ignore-scripts` and `forge build`. Node 22 and Foundry are required. There are no proving artifacts to download.

| Command                    | Coverage                                                                                                                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`                 | 24 tests: PR prefill/validation and public GitHub preflight plus DKIM canonicalization, independent RSA signing, mutation rejection and pair bindings                                                           |
| `npm run test:contracts`   | 54 Foundry tests, with 128 inputs per fuzz case: RSA verifier, signed-comment rejection, full-body and header policy, escrow settlement, V2 fees and withdrawal invariants             |
| `npm run test:chain`       | Actual RSA verifier deployment, relayed claim, exact withdrawal, negative claims, RSA-2048 support; optional local checks against genuine original GitHub emails                      |
| `npm run test:ui`          | 43 browser tests: PR prefill/checking, issue-first funding, wallet failures, receipts, disclosure gating, automatic/manual setup, V1/V2 balances, local-chain claim/withdrawal, accessibility and mobile layout |
| `npm run test:public-flow` | Opt-in real public GitHub lookup → funding → expiry refund → withdrawal on Anvil                                                                                                      |
| `npm run test:automation` | 40 tests: collector intake/readiness, explicit exposure policy, encrypted storage, signer limits, relay recovery, indexing and backups |
| `npm run build:gnosis`     | TypeScript check and static production build                                                                                                                                          |

Start `npm run chain`, run `npm run deploy:local`, and start `npm run dev` before chain/browser tests. Stateful tests run serially, require chain 31337, snapshot/revert their changes and restore wall-clock time. Do not run separate stateful suites simultaneously against the same Anvil instance.

`tests/fixtures/rsa-vectors.json` contains **synthetic** public test receipts signed with a disposable test key. It contains no genuine mail, recipient or private signing key. `npm run test:vectors` regenerates the fixtures and discards its private key. Dynamic chain and browser tests generate their own keys only in memory and deploy the real verifier against those test keys. Live Gnosis pins the genuine GitHub key instead.

Optional genuine-mail tests read `.local/gnosis-merge.eml` and `.local/gnosis-closure.eml` and send them only to local Anvil. Files are not committed. These historical fixtures validate actual GitHub RSA and MIME compatibility; they do not claim a new bounty.

The browser integration verifies that email-bearing requests are absent during “Check receipts,” that disclosure consent gates claim simulation/submission, that changing a file clears consent and review, that relaying cannot redirect the reward, and that the beneficiary can withdraw the exact credit. It also checks the claim review at mobile width and with axe WCAG rules.

For an explicitly authorized tiny Gnosis V2 test, use a disposable **public** repository and a fresh ignored fixture path. Confirm the receiving GitHub account watches the repository and email notifications are enabled before creating the issue. These opt-in tests spend real xDAI; ordinary CI never runs them.

```sh
export MERGEBOUNTY_TEST_REPO=OWNER/DISPOSABLE_PUBLIC_REPO
export GNOSIS_FIXTURE_FILE=.local/my-v2-fixture.json
export GNOSIS_EVIDENCE_PREFIX=.local/my-v2-e2e
export GNOSIS_E2E_URL=https://issue.fund
node scripts/github-gnosis-fixture.mjs prepare
node scripts/run-gnosis-e2e.mjs fund
node scripts/github-gnosis-fixture.mjs merge
# Save the two new original native-event .eml files privately.
# Set mergeEmail and closureEmail paths in the fixture JSON before claiming.
node scripts/run-gnosis-e2e.mjs claim
```

The default reward is 0.0001 xDAI; the optional fixture `rewardXdai` is capped at 0.001 by the wallet harness. Funding is checked against the exact repository, issue, branch, expected escrow, signer, next bounty ID and seven-day deadline. Claim and withdrawal destinations are restricted, gas is estimated before signing, and the estimated gas budget is capped. Signing stays in Node memory through hidden terminal input or a secret environment variable. The browser receives no private key. Traces and automatic screenshots are disabled; explicit receipt-free result screenshots and transaction hashes go under the chosen evidence prefix.

Merge only after funding. Preserve original bytes; do not forward or redact signed mail. For an outside collector, verify its lack of repository privileges and lock both closed conversations before publishing its receipts. This precheck alone is not proof that all replay/lock safety cases pass. The test verifies local receipt review, consent gating, real on-chain RSA settlement, exact V2 net and fee credits/events, replay rejection, and beneficiary withdrawal accounting. Treasury withdrawal is a separate owner-wallet action. A resumed funding test reads the existing bounty before sending anything; a paid claim test stops rather than silently starting another bounty. Preserve its transaction journal after any interrupted run.

September 10's public-site V2 results are recorded in [GNOSIS.md](GNOSIS.md) and [v2-e2e.json](deployments/gnosis/v2-e2e.json).

CI runs the full Foundry, Node and browser suites, including local RSA integration, without mailbox access, real money, or private artifacts. Original emails, private keys, traces and local transaction state are ignored by Git. The toolchain setup is described below.

## Automated collector and V2 deployment

`npm run test:automation` exercises collector admission, delivery policy, receipt
persistence, disclosure gating, relay recovery, fee settlement, retention and
backup/restore. Indexer regression tests also cover bounded work, durable backlog
and sweep recovery, RPC failure isolation, settlement reorgs and atomic event
checkpoints. `npm run test:deployment` starts an isolated Anvil instance and
checks V2 deployment planning, durable recovery after an ambiguous broadcast,
immutable fee/runtime verification and preserved V1 funding/links. It also rejects
changed checkpoint terms, substituted signed transactions and the wrong deployer.
Both commands run in CI with Node 24.21.0, matching the deployed backend runtime.

These tests generate synthetic signatures only on isolated chains. Passing them
does not complete genuine GitHub-mail/Gnosis acceptance or authorize automatic
receipt disclosure. CI has no deployment or mailbox secrets.

The pinned Etherform CI wrapper's setup action invokes the current `foundryup`
binary through `bash`, which fails before tests start. CI therefore uses the
official Foundry action pinned to
`908c540300062bd5a7e473851cdb4282204cee09` and runs the complete `forge test -vv`
suite directly. This changes tool installation, not contract test coverage. The
legacy V1 Etherform deployment workflow remains separate from the V2 deployment
commands documented in GNOSIS.md.

## Live server submission

For the automatic variant, use a fresh fixture with `automatic: true`, the actual
`relayer` address and the treasury's `feeCreditBefore` snapshot. Wait for the
configured service to report Notifications ready. Fund through the same `fund`
command and merge with the same helper, then run:

```sh
node scripts/run-gnosis-e2e.mjs relay-withdraw
```

This waits for the public collector API to report a confirmed credit, verifies
that the transaction came from the configured relay, checks exact beneficiary and
fee credits/events and replay rejection, and withdraws through the public site.
It never submits a browser claim or uploads emails. The private transaction journal
must contain only funding and withdrawal. The live record is
[automatic-e2e.json](deployments/gnosis/automatic-e2e.json).

## PR preparation

`tests/pr.test.mjs` covers generated title/body bindings, URL encoding, fork/source checks, quoted closing lines, malformed markers, template preservation and public API failures. `tests/browser/prepare-pr.spec.ts` covers wallet connection and changes, template insertion, prefilled popup handoff, existing PR corrections, late response rejection, copy fallback, keyboard focus and mobile accessibility. These tests make no GitHub writes or blockchain transactions.
