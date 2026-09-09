# Test the direct implementation

Run `npm ci --ignore-scripts` and `forge build`. Node 22 and Foundry are required. There are no proving artifacts to download.

| Command                    | Coverage                                                                                                                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`                 | 16 tests: public GitHub preflight plus DKIM canonicalization, independent RSA signing, mutation rejection and pair bindings                                                           |
| `npm run test:contracts`   | 35 Foundry tests, including 128 fuzz cases: RSA verifier, signed-comment rejection, full-body and header policy, escrow settlement and withdrawal invariants                          |
| `npm run test:chain`       | Actual RSA verifier deployment, relayed claim, exact withdrawal, negative claims, RSA-2048 support; optional local checks against genuine original GitHub emails                      |
| `npm run test:ui`          | 24 browser tests: repo/issue onboarding, payment validation, wallet failures, receipt checks, disclosure gating, actual local-chain claim/withdrawal, accessibility and mobile layout |
| `npm run test:public-flow` | Opt-in real public GitHub lookup → funding → expiry refund → withdrawal on Anvil                                                                                                      |
| `npm run build:gnosis`     | TypeScript check and static production build                                                                                                                                          |

Start `npm run chain`, run `npm run deploy:local`, and start `npm run dev` before chain/browser tests. Stateful tests run serially, require chain 31337, snapshot/revert their changes and restore wall-clock time. Do not run separate stateful suites simultaneously against the same Anvil instance.

`tests/fixtures/rsa-vectors.json` contains **synthetic** public test receipts signed with a disposable test key. It contains no genuine mail, recipient or private signing key. `npm run test:vectors` regenerates the fixtures and discards its private key. Dynamic chain and browser tests generate their own keys only in memory and deploy the real verifier against those test keys. Live Gnosis pins the genuine GitHub key instead.

Optional genuine-mail tests read `.local/gnosis-merge.eml` and `.local/gnosis-closure.eml` and send them only to local Anvil. Files are not committed. These historical fixtures validate actual GitHub RSA and MIME compatibility; they do not claim a new bounty.

The browser integration verifies that email-bearing requests are absent during “Check receipts,” that disclosure consent gates claim simulation/submission, that changing a file clears consent and review, that relaying cannot redirect the reward, and that the beneficiary can withdraw the exact credit. It also checks the claim review at mobile width and with axe WCAG rules.

For an explicitly authorized tiny Gnosis test, prepare a disposable **public** repository using `scripts/github-gnosis-fixture.mjs`, serve `npm run build:gnosis` on port 5175, and run `node scripts/run-gnosis-e2e.mjs fund`. That helper reads the signer through hidden terminal input or a secret environment variable. Merge only after funding, obtain fresh `.local/rsa-gnosis-merge.eml` and `.local/rsa-gnosis-closure.eml`, then run the helper with `claim`. Live tests are gated behind `RUN_GNOSIS_E2E=1`, limit transaction destinations and amounts, and disable traces. Direct claims intentionally publish the signed email data.

CI uses Breadchain's pinned Etherform contract workflow and a separate Node/browser job. It runs full local RSA integration without mailbox access, real money, or private artifacts. Original emails, private keys, traces and local transaction state are ignored by Git.

## Automated collector and V2 deployment

`npm run test:automation` exercises collector admission, delivery policy, receipt
persistence, disclosure gating, relay recovery, fee settlement, retention and
backup/restore. `npm run test:deployment` starts an isolated Anvil instance and
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
