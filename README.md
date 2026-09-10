# issue.fund

Fund a public GitHub issue with xDAI, then credit the wallet designated in the merged PR title using GitHub's original, DKIM-signed merge and linked issue-closure emails. Automatic collection and server claim submission are live on Gnosis: the service receives both emails and pays claim gas; the contributor withdraws the credited reward. The contracts verify RSA-SHA256 signatures directly, with no ZK proving. Manual receipt submission remains available in the static React app.

**[Open issue.fund](https://issue.fund)** · [Protocol](PROTOCOL.md) · [Testing](TESTING.md) · [Gnosis deployment](GNOSIS.md)

The app is hosted publicly on GitHub Pages, with the **issue.fund** domain managed through Cloudflare DNS. The source repository is public. Gnosis uses native xDAI. Review the verification policy and contract limitations in the [technical guide](docs/reference/contracts.md).

## Documentation

The [documentation hub](https://issue.fund/#docs) lists all 16 pages for both audiences. Start with [maintainer onboarding](docs/maintainers/getting-started.md) or [contributor onboarding](docs/contributors/getting-started.md). The [complete documentation index](docs/README.md) includes funding, PR setup, merging, receipts, claims, withdrawals, refunds, privacy and troubleshooting.

Content lives in `shared/documentation.mjs`. Run `npm run docs:build` after edits to generate the matching Markdown guides; every build checks that they are in sync. [GitHub Pages and DNS deployment](CLOUDFLARE.md) covers static hosting.

## Claim fees

New V2 bounties deduct a fixed 1% success fee. The initial fee recipient and owner
is `0x86213f1cf0a501857B70Df35c1cb3C2EcF112844`. Connect that wallet and open
**Fee settings** to change future fee routing or propose an ownership transfer.
Existing credits remain with the wallet that earned them. V1 bounties retain their
original no-fee terms. See the [fee management guide](docs/reference/contracts.md).

## Use the app

1. **Start with an issue URL.** Choose Fund an issue and paste an open public GitHub issue URL. The app checks its repository automatically, without registration, bookmarks, or a GitHub connection. The optional Repositories directory is populated from existing bounties and supports browsing, searching, and paginating issues.
2. **Prepare collection and fund.** The live site defaults to automatic collection. Wait for **Notifications ready**: a maintainer installs the App, the operator enables collector watching, and genuine email delivery is confirmed. Review the repository, issue, default branch, gross/net reward and deadline before confirming funding. Additional bounties for the same issue remain separate rewards.
3. **Prepare the PR.** Choose **Prepare PR**, connect the intended payout wallet, and enter your work branch or public fork. Add a description and insert the project’s PR template or checklist. **Prepare GitHub PR** checks the issue and branch and fills the title markers, wallet and `Closes #ISSUE` line. Open the prefilled link, review it and create the PR on GitHub. Return to **Check existing PR** before merge; it reports mismatched terms and collector readiness. No GitHub OAuth in issue.fund is needed.
4. **Let the server claim.** Once the PR merge closes the linked issue, the server receives the two native event emails over Gmail IMAP, checks and pairs them, locks both completed conversations through the integration, and submits the claim. No email upload, browser claim or proof generation is needed. Follow progress on the bounty page.
5. **Withdraw.** When **Reward credited** appears, connect the wallet in the signed title and authorize withdrawal. That wallet still needs native xDAI for withdrawal gas and can choose another destination. Claiming alone does not transfer funds out of escrow. If there is no claim, the funder can reclaim after the deadline plus seven days.

New repositories still need the [maintainer setup](docs/maintainers/automatic-claims.md) and collector watching before merge. The current account token verifies an existing watch; it does not automatically subscribe to every newly encountered repository. Contact [turetzkyron@gmail.com](mailto:turetzkyron@gmail.com) for premium setup. The collector, mailbox, encrypted storage and relay run separately from the static GitHub Pages frontend; see the [operator guide](docs/operators/automation.md).

**Independent submission and censorship resistance:** anyone can subscribe to the public issue and PR before merge, receive the two original native event emails and submit them as evidence. The contract needs no collector permission, premium subscription or App installation. This also works for bounties funded in automatic mode. A different sender can pay claim gas, but cannot redirect the wallet authenticated in the PR title. If the service withholds its copies or goes offline, another receipt holder can use the static app, an independently hosted client or the escrow directly. GitHub still controls event truth and email delivery; valid supported originals, the claim deadline and Gnosis transaction inclusion remain necessary. These signed receipts are the proof; no ZK proof is generated.

**Manual route:** choose manual collection when funding if you will arrange delivery yourself, or subscribe independently alongside automatic collection for a fallback. After merge, download the original native merge and linked closure emails, upload both unchanged `.eml` files, check their signatures in the browser, review the payout wallet and submit. A comment, screenshot or manually closed issue is insufficient. See [Collect the email receipts](docs/contributors/collect-emails.md) and [Claim and withdraw](docs/contributors/claim-and-withdraw.md).

**Maintainers: establish a post-merge locking policy.** Automatically lock both the merged bounty PR and its linked completed issue before receipts are published, using the collector integration or your own automation. Closing an issue does not lock it. Exposed reply credentials may let someone comment as the notification holder, exposing the repository to impersonated activity and maintainers directly if their own receipts are used. Keep conversations locked and use an outside notification account; privileged accounts can bypass locks. [Maintainer policy and limitations](docs/maintainers/review-and-merge.md).

**Manual contributors: confirm that policy before merge**, then verify both actual locks and the receipt account's role before simulation/submission. The manual UI and contract do not enforce lock checks. Locks reduce exposure, remain reversible and do not establish complete protection; the live impersonation test matrix is still incomplete. [Disclosure and reply-token risk](docs/reference/privacy.md).

Signed headers and complete canonical bodies become public transaction data, including the receipt holder's email address and notification links. Automatic claims use the dedicated collector mailbox, whose exposure the operator accepted; the server encrypts stored receipts before submission. Manual files stay in page memory and are not uploaded to an app server, but simulation can disclose them to the RPC before wallet confirmation. See [Email privacy](docs/reference/privacy.md).

The wallet must be in the **PR title at merge time**. The observed native GitHub emails do not authenticate the source branch name, so an address only in the source branch is insufficient. GitHub-account ownership enrollment is unnecessary for this payout rule.

The [PR preparation guide](docs/contributors/prepare-pr.md) covers templates, forks, checks and copy fallbacks. The [implementation and design note](docs/design/claim-preparation.md) distinguishes the deployed prefilled flow from a possible future single-marker format. Existing escrows and their payout rules remain unchanged.

## Live automatic acceptance

On September 10, 2026, [V2 bounty #2](https://issue.fund/#bounty/100/0x1f5ce96dfa05d207ca8e59c6ab4b9f1895d24630/2) completed public-site funding, real GitHub issue #7 / PR #8 events, server collection and claim, and contributor withdrawal. The gross reward was 0.0001 xDAI, the contributor withdrew 0.000099 xDAI, and the fee recipient was credited 0.000001 xDAI. No email uploads or browser claim were used. Replay rejection and settlement after a collector/signer restart were verified. [Recorded evidence](deployments/gnosis/automatic-e2e.json) · [Passing full CI](https://github.com/RonTuretzky/issue.fund/actions/runs/34497029568).

The live reply-token security matrix remains separate from the operator's accepted exposure policy. External alert delivery and recurring off-host exports remain operational backlog items. This successful example does not enroll other repositories automatically.

## Run locally

Requirements: Node 22, npm, Foundry (`forge`, `anvil`).

```sh
npm ci --ignore-scripts
npm run chain            # terminal 1: Anvil, chain 31337, port 8547
npm run deploy:local     # terminal 2: deploy direct verifier and escrow
npm run dev              # terminal 2: http://127.0.0.1:5174
```

The development manifest is `.local/deployment.rsa.json`. Development services bind to loopback and use unlocked Anvil test wallets. The live static app requires none of these services.

```sh
npm test
npm run test:contracts
npm run test:chain       # Anvil must be running
npm run test:ui          # Anvil + local app must be running
npm run build:gnosis     # dist/, reads public/deployment.gnosis.json
```

Synthetic signing keys are used only in local cryptographic integration tests. Published Gnosis contracts pin the observed GitHub `pf2023` modulus. Genuine email fixtures and signing keys are not committed.

## Implementation

| File                                          | Responsibility                                                                                 |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `shared/dkim.mjs`                             | DKIM canonicalization, local RSA checks, native event parsing and pair preview                 |
| `contracts/RsaSha256.sol`                     | Complete PKCS#1 v1.5 encoding verification using modular exponentiation                        |
| `contracts/GithubDkimVerifier.sol`            | Immutable RSA key, signed-header policy and complete body-hash verification                    |
| `contracts/ReceiptPolicy.sol`                 | Authenticated merge/closure text, native `issue_event` footer, MIME boundary and title markers |
| `contracts/MergeBounty.sol`                   | Immutable native-token escrow, timing, replay protection, credits and refunds                  |
| `src/ClaimPanel.tsx`                          | Local file checks, disclosure notice, review and claim submission                              |
| `src/RepositoryHub.tsx`, `src/FundDialog.tsx` | Public repo/issue onboarding and funding                                                       |
| `src/static-api.ts`                           | Gnosis reads from a validated static deployment manifest                                       |

## Archived private claims

The complete previous ZK implementation is preserved on [`codex/archive-zk-proving`](https://github.com/RonTuretzky/issue.fund/tree/codex/archive-zk-proving). [Backlog issue #1](https://github.com/RonTuretzky/issue.fund/issues/1) records its circuits, proving artifacts, operational requirements, security work and restoration criteria. It is removed from the active application.

Legacy escrow `0xdf1f54c97c728f7101b797a6db2383bea2cdecc1` is a separate immutable deployment. Its funded bounty #2 and exact existing proving artifacts were preserved. Use the archived code and original manifest for legacy claims; new RSA receipts cannot settle that old escrow.
