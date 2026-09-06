# issue.fund

Fund a public GitHub issue with xDAI, then pay the wallet designated in the merged PR title using GitHub's original, DKIM-signed merge and linked issue-closure emails. The contracts verify RSA-SHA256 signatures directly. The static React app prepares the signed data and checks it with browser WebCrypto before submission.

**[Open issue.fund](https://issue.fund)** · [Protocol](PROTOCOL.md) · [Testing](TESTING.md) · [Gnosis deployment](GNOSIS.md)

The app is hosted publicly on GitHub Pages, with the **issue.fund** domain managed through Cloudflare DNS. The source repository is public. Gnosis uses native xDAI. Review the verification policy and contract limitations in the [technical guide](docs/reference/contracts.md).

## Documentation

The [documentation hub](https://issue.fund/#docs) lists all 14 pages for both audiences. Start with [maintainer onboarding](docs/maintainers/getting-started.md) or [contributor onboarding](docs/contributors/getting-started.md). The [complete documentation index](docs/README.md) includes funding, PR setup, merging, receipts, claims, withdrawals, refunds, privacy and troubleshooting.

Content lives in `shared/documentation.mjs`. Run `npm run docs:build` after edits to generate the matching Markdown guides; every build checks that they are in sync. [GitHub Pages and DNS deployment](CLOUDFLARE.md) covers static hosting.

## Use the app

1. **Start with an issue URL.** Choose Fund an issue and paste an open public GitHub issue URL. The app checks its repository automatically, without registration, bookmarks, or a GitHub connection. The optional Repositories directory is populated from existing bounties and supports browsing, searching, and paginating issues.
2. **Fund an open issue.** Review the canonical repository, issue, default branch, amount and completion deadline. A fresh public-API check runs before the wallet request. Additional funding for an already listed issue requires an explicit duplicate-bounty acknowledgement.
3. **Prepare the PR.** Copy the exact title markers `[wallet 0x…] [bounty 0x…]` from the bounty. Add `Closes #ISSUE` to the PR body and merge into the funded default branch. Subscribe to both the issue and PR, and enable email notifications before merging.
4. **Download two originals.** Use your mail provider's “Show original” / “Download original” for the native merged-PR email and the native issue-closed-via-PR email. A forwarded email, screenshot, comment, or manually closed issue is insufficient.
5. **Check and claim.** Upload both `.eml` files. Signature checking happens in the browser. Review the payout wallet, acknowledge the single disclosure notice, and submit. The contract independently checks both signatures, full body hashes, native event footers and bounty terms.
6. **Withdraw.** Anyone may submit a valid claim, but only the wallet in the signed title receives credit and can withdraw it. The credited wallet can choose another withdrawal destination. If there is no claim, the funder can reclaim after the completion deadline plus seven days.

The notice reads: “Submitting makes these emails public, including your email address and notification links.” Signed headers and complete canonical bodies are transaction data; they may reach a public RPC during simulation even if you later cancel in your wallet. Files remain in page memory until submission and are not uploaded to an app server.

The wallet must be in the **PR title at merge time**. The observed native GitHub emails do not authenticate the source branch name, so an address only in the source branch is insufficient. GitHub-account ownership enrollment is unnecessary for this payout rule.

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
