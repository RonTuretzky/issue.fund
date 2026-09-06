# How bounties work

From an open GitHub issue to a wallet payment, with no payout operator.

[All documentation](README.md) · [Read on the website](https://issue.fund/#docs/overview)

## One issue. A funded reward. Two signed receipts.

A bounty holds a reward for a public GitHub issue in a smart contract. A maintainer reviews the contribution and merges the pull request. The contributor uses GitHub’s original merge and linked issue-closure emails to claim the reward.

The contract checks GitHub’s RSA/DKIM email signatures directly. There is no proof-generation step, proving service, GitHub login in this app, or approval from a payout operator. GitHub still supplies the evidence about what was merged.


## The complete flow

1. Fund: choose an open issue in a public repository and deposit a reward in xDAI on Gnosis.
2. Prepare: the contributor adds the bounty reference and payout wallet to the PR title, links the issue, and arranges email notifications.
3. Merge: the maintainer reviews the code and merges into the funded target branch before the deadline.
4. Claim: upload the two original event emails, check the payout wallet, acknowledge their public disclosure, and submit the claim.
5. Withdraw: the wallet in the authenticated PR title withdraws its credited reward.


## Choose your path

Maintainers decide whether a contribution solves the issue. Funders supply the reward; a funder does not have to own the repository. Start with [Maintainer onboarding](https://issue.fund/#docs/maintainers/getting-started).

Contributors do the work and designate a payout wallet. Anyone holding a valid pair of receipts may submit the claim, but cannot change who gets paid. Start with [Contributor onboarding](https://issue.fund/#docs/contributors/getting-started).


## What you need

- A public GitHub repository with issues enabled, and an open issue.
- A Gnosis-compatible browser wallet. Rewards and transaction fees use native xDAI; sending ETH on another network does not fund this escrow.
- A way to receive and download the original GitHub email notifications. Set this up before the merge.
- Agreement to publish the signed email data when claiming. Read [Email privacy](https://issue.fund/#docs/reference/privacy) before choosing which mailbox will receive it.


## When the clock runs out

Both emails must be signed during the funded completion window. A further seven days allows submission of a claim for work completed in that window. After that, the original funder can reclaim an unclaimed reward. See [Manage rewards and refunds](https://issue.fund/#docs/maintainers/manage-bounties).
