# Manage rewards and refunds

Understand bounty states, expiry, and the funder’s withdrawal path.

[All documentation](../README.md) · [Read on the website](https://issue.fund/#docs/maintainers/manage-bounties)

## Read the bounty state

| State | What you can do |
| --- | --- |
| Open | Complete and merge the work; receipts must be signed by the completion deadline. |
| Claim period | Submit an eligible pair already signed within the completion window. This does not extend the work deadline. |
| Refundable | The deadline and seven-day grace period have ended. The original funder can reclaim. |
| Paid | A valid claim credited the designated wallet. That wallet can withdraw its pending credit. |
| Refunded | The funder reclaimed the reward into their credit. The funder can withdraw it. |


## Reclaim an expired bounty

1. Connect the same wallet that funded the bounty and switch to its network.
2. Open the bounty after the completion deadline plus seven days.
3. Choose Reclaim expired bounty and confirm the transaction.
4. When your returned amount appears as ready to withdraw, choose Withdraw xDAI.
5. Check the destination address and confirm the withdrawal transaction.


## Who controls refunds

Only the original funding wallet can reclaim an unclaimed bounty. Repo ownership does not grant refund rights. A paid bounty cannot be refunded, and there is no early-cancellation or administrator-withdrawal path. A valid claim submitted by the end of the grace period takes precedence over a later refund attempt.


## Keep track of your work

Use Mine after connecting your wallet, or keep the bounty URL with the issue. The app currently loads the newest 100 bounties. Explorer events provide the full contract history; older bounties may require direct contract interaction until full-history browsing is added.

A GitHub API outage can block new funding checks without changing existing escrow state. A successful wallet transaction remains on-chain even if you close the page. See [Contracts and supported limits](https://issue.fund/#docs/reference/contracts) for addresses.
