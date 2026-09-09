# Documentation

Onboarding and reference guides for maintainers, funders, contributors and users. [Read the documentation website](https://issue.fund/#docs).

Generated from `shared/documentation.mjs` with `npm run docs:build`.

## Start here

Understand the payment flow.

- [How bounties work](overview.md) — From an open GitHub issue to a wallet payment, with no payout operator.

## Maintainers & funders

Choose an issue, fund the work, and review a contribution.

- [Maintainer onboarding](maintainers/getting-started.md) — Set up a public repository and a clear agreement with contributors.
- [Fund an issue](maintainers/fund-issue.md) — Check the target, choose the reward and deadline, and create the escrow.
- [Review and merge](maintainers/review-and-merge.md) — Make sure the accepted PR produces receipts that can settle the bounty.
- [Manage rewards and refunds](maintainers/manage-bounties.md) — Understand bounty states, expiry, and the funder’s withdrawal path.
- [Set up automatic claims](maintainers/automatic-claims.md) — Let the collector receive GitHub emails and submit claims for contributors.

## Contributors & users

Prepare your PR, collect receipts, and claim your reward.

- [Contributor onboarding](contributors/getting-started.md) — Choose a funded issue and set up your wallet and receipt delivery.
- [Prepare your pull request](contributors/prepare-pr.md) — Bind the PR to the right bounty, wallet, issue, and target branch.
- [Collect the email receipts](contributors/collect-emails.md) — Enable notifications and download the two original messages the contract accepts.
- [Claim and withdraw](contributors/claim-and-withdraw.md) — Check the receipts locally, submit a claim, and collect the credited reward.
- [Follow an automatic claim](contributors/automatic-claims.md) — Check collection progress, confirm the payout wallet, and withdraw your reward.

## Reference

Verification, privacy, troubleshooting, and developer setup.

- [How verification works](reference/verification.md) — What RSA/DKIM authenticates, and what the escrow checks before paying.
- [Email privacy](reference/privacy.md) — What stays in the page and what becomes public when you submit a claim.
- [Troubleshooting](reference/troubleshooting.md) — Recover from repository, receipt, wallet, and withdrawal problems.
- [Contracts and supported limits](reference/contracts.md) — Find the live contracts and understand the boundaries of the current payment rule.
- [Developer setup](reference/developers.md) — Run the app locally, test direct verification, and navigate the source.
