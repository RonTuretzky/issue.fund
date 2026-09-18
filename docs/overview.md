# How bounties work

From an open GitHub issue to a wallet payment, with no payout operator.

[All documentation](README.md) · [Read on the website](https://issue.fund/#docs/overview)

## One issue. A funded reward. Two signed receipts.

A bounty holds a reward for a public GitHub issue in a smart contract. A maintainer reviews the contribution and merges the pull request. For a bounty with automatic collection ready, the server receives GitHub’s original merge and linked issue-closure emails, submits the claim, and pays its gas. The contributor then withdraws the credited reward. Manual receipt submission is also available.

The contract checks GitHub’s RSA/DKIM email signatures directly. There is no proof-generation step, proving service, GitHub login in this app, or approval from a payout operator. GitHub still supplies the evidence about what was merged.


## Censorship-resistant claim submission

The automatic collector is optional. Anyone can subscribe to the public issue and PR before merge, receive the original signed event emails and submit that evidence themselves. No issue.fund account, premium subscription, App installation or operator permission is required for a direct claim. Another sender can pay claim gas, but the reward still goes to the wallet authenticated in the merged PR title.

This resists censorship by the collection service: if it refuses, delays or stops operating, another receipt holder can submit through the static app, an independent interface or the escrow contract directly. The receipts are the proof; this deployment verifies RSA/DKIM signatures without generating a ZK proof.

It is not absolute censorship resistance. GitHub controls notification delivery and signed event truth, maintainers control merging, and a claim still needs valid originals, the supported key and format, timely submission and inclusion on Gnosis. Subscribe before the events; a late subscription cannot recreate missing originals.

Follow [Collect the email receipts](https://issue.fund/#docs/contributors/collect-emails) and [Claim and withdraw](https://issue.fund/#docs/contributors/claim-and-withdraw). Before publishing personal receipts, confirm the repository’s locking policy and read [Email privacy](https://issue.fund/#docs/reference/privacy).


## The complete flow

1. Fund: paste an open public issue URL, wait for Notifications ready in automatic mode, and deposit the reward in xDAI on Gnosis. Choose manual collection explicitly if you will arrange your own receipts.
2. Prepare: the contributor opens Prepare PR, connects the payout wallet and selects the work branch. The app fills the title markers and issue-closing line, then opens GitHub for review and PR creation.
3. Merge: the maintainer reviews the code and merges into the funded target branch before the deadline, closing the linked issue.
4. Claim: the server collects and checks both event emails, locks the completed issue and PR through the maintainer integration, and submits the claim. No contributor email upload or claim transaction is needed in the automatic flow.
5. Withdraw: when Reward credited appears, the wallet in the authenticated PR title withdraws its net reward. This still needs a wallet confirmation and withdrawal gas.


## Automatic claims are live

The live Gnosis test on September 10, 2026 completed funding, a real GitHub PR merge and linked issue closure, server email collection, automatic claim submission, and contributor withdrawal. No email files were uploaded and no claim was sent from the browser.

The test funded 0.0001 xDAI. The contributor withdrew 0.000099 xDAI and the fee recipient was credited 0.000001 xDAI. This confirms the configured example flow; each additional repository still needs notification setup.

- [View the completed automatic bounty](https://issue.fund/#bounty/100/0x1f5ce96dfa05d207ca8e59c6ab4b9f1895d24630/2)
- [Maintainer: set up automatic claims](https://issue.fund/#docs/maintainers/automatic-claims)
- [Contributor: follow an automatic claim](https://issue.fund/#docs/contributors/automatic-claims)

## Choose your path

Maintainers decide whether a contribution solves the issue. Funders supply the reward; a funder does not have to own the repository. Start with [Maintainer onboarding](https://issue.fund/#docs/maintainers/getting-started).

Contributors do the work and designate a payout wallet. Anyone holding a valid pair of receipts may submit the claim, but cannot change who gets paid. Start with [Contributor onboarding](https://issue.fund/#docs/contributors/getting-started).


## What you need

- A public GitHub repository with issues enabled, and an open issue.
- A Gnosis-compatible browser wallet. Rewards and transaction fees use native xDAI.
- For automatic collection: the maintainer App, collector watching, and confirmed email delivery before the merge. Additional repositories need setup; installing the App alone does not mean Notifications ready.
- For manual collection: access to both original GitHub event emails. Set up notifications before the merge.
- Claiming publishes signed email data. Automatic claims use the service mailbox; manual claims expose the receipt holder’s address. Read [Email privacy](https://issue.fund/#docs/reference/privacy).


## When the clock runs out

Both emails must be signed during the funded completion window. A further seven days allows submission of a claim for work completed in that window. After that, the original funder can reclaim an unclaimed reward. See [Manage rewards and refunds](https://issue.fund/#docs/maintainers/manage-bounties).
