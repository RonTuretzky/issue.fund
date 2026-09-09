# Follow an automatic claim

Check collection progress, confirm the payout wallet, and withdraw your reward.

[All documentation](../README.md) · [Read on the website](https://issue.fund/#docs/contributors/automatic-claims)

## Before you start

1. Open the bounty and confirm with the maintainer whether automatic receipt collection is ready. If it is not ready, arrange manual notifications before the merge.
2. Review the gross reward, success fee and contributor amount in Bounty details. The fee is deducted only after a valid claim; the amount credited to you is the displayed net reward.
3. Copy this bounty’s exact title markers into your PR, including the Gnosis payout wallet you control. Link the funded issue in the PR description and merge into the funded target branch.


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

The manual upload controls remain on an open bounty. Use the two original GitHub emails and confirm their payout wallet before submission. Automatic collection does not extend the bounty’s deadline or recover emails that were never delivered.

Submitting receipts publishes email data and notification links. A dedicated collector mailbox reduces exposure of your personal mailbox; it does not make receipt contents private. Read Email privacy before using your own receipts.

- [Collect receipts manually](https://issue.fund/#docs/contributors/collect-emails)
- [Email privacy](https://issue.fund/#docs/reference/privacy)
