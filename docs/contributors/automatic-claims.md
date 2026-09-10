# Follow an automatic claim

Check collection progress, confirm the payout wallet, and withdraw your reward.

[All documentation](../README.md) · [Read on the website](https://issue.fund/#docs/contributors/automatic-claims)

## Live now: no email uploads

Automatic collection and claim submission are running on Gnosis. Once the maintainer integration, collector watching and email delivery are ready, the service handles both GitHub receipts and pays claim gas. Your browser can be closed while the server processes the claim.

You still prepare the PR title and issue link before merge, then authorize withdrawal from the payout wallet once the reward is credited. Automatic claiming does not automatically send the reward out of escrow.

- [Completed automatic claim and withdrawal](https://issue.fund/#bounty/100/0x1f5ce96dfa05d207ca8e59c6ab4b9f1895d24630/2)

## Before you start

1. Open the bounty and confirm with the maintainer whether automatic receipt collection is ready. If it is not ready, arrange manual notifications before the merge.
2. Review the gross reward, success fee and contributor amount in Bounty details. The fee is deducted only after a valid claim; the amount credited to you is the displayed net reward.
3. Use Prepare PR with the payout wallet you control. It fills the title markers and closing line. Create the PR on GitHub, then use Check existing PR before the maintainer merges into the funded target branch.


## Understand the status

| Status | What happens next |
| --- | --- |
| Waiting for GitHub emails | The collector needs the native merged-PR and linked issue-closure emails. |
| Receipts collected | The relay checks eligibility, both conversation locks, and gas limits. |
| Claim submitted | A transaction is pending confirmation. This is not yet a wallet payment. |
| Reward credited | Connect the payout wallet and withdraw its available escrow balance. |
| Withdrawal confirmed | The credited wallet withdrew after the claim. |
| Attention needed | Read the recovery message. Coordinate with the maintainer/operator or use original receipts for a manual claim before the claim window closes. |


## Withdraw from the correct escrow

Your wallet may have balances in more than one escrow version. The withdrawal dialog lists them separately; each balance needs its own transaction. The original V1 balances retain their original no-fee terms.

A relayer pays claim gas when it submits for you. Your wallet still needs native xDAI for withdrawal gas. Anyone can relay a valid claim, but they cannot change the signed beneficiary.


## If automation is unavailable

The manual upload controls remain on an open bounty, including one funded in automatic mode. Any holder of valid original receipts can submit without the service’s permission. Subscribe independently before merge if you want a fallback that does not depend on the service releasing its copies. Automatic collection does not extend the deadline or recover emails that were never delivered.

Before using your own originals, confirm the maintainer’s locking policy, both actual post-merge locks and the receipt account’s role. Follow [Collect the email receipts](https://issue.fund/#docs/contributors/collect-emails); the manual claim form does not perform these checks.

Submitting receipts publishes email data and notification links. A dedicated collector mailbox reduces exposure of your personal mailbox; it does not make receipt contents private. Read Email privacy before using your own receipts.

- [Collect receipts manually](https://issue.fund/#docs/contributors/collect-emails)
- [Email privacy](https://issue.fund/#docs/reference/privacy)
