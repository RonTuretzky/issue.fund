# Troubleshooting

Recover from repository, receipt, wallet, and withdrawal problems.

[All documentation](../README.md) · [Read on the website](https://issue.fund/#docs/reference/troubleshooting)

## Repository and funding

| What you see | What to do |
| --- | --- |
| Repository cannot be added | Use a public, active repository with issues enabled and a supported default branch. Adding a repo never requires a GitHub connection here. |
| GitHub rate limit or connection error | Wait and retry. Anonymous API checks may be limited. Do not fund until the fresh issue review succeeds. |
| Issue is closed or URL is a PR | Choose an open issue URL ending in /issues/NUMBER. Check whether the issue moved or was already resolved. |
| Repository or branch changed during review | Run a fresh review and inspect the new terms before confirming. |
| Already has a bounty | Open the existing bounty. Additional bounties are separate escrows, not a top-up. |


## Receipt checking

| What you see | What to do |
| --- | --- |
| Original .eml required or file too large | Download the individual original message, keep it unchanged, and use a file under 100 KB. |
| Body hash or RSA signature is invalid | Re-download the original. Edited, re-encoded, or forwarded text may no longer authenticate. |
| No native-event footer / unsupported notification | Select the actual merge or linked issue-closure event. A comment, manual closure or changed GitHub template cannot substitute. |
| Wrong repository, issue, PR or branch | Return to the funded bounty and check both files. They must refer to the same closing PR and target. |
| Wrong wallet or bounty reference | Inspect the title authenticated at merge time. A later title edit does not rewrite the old notification. |
| Receipt outside the funding window | Both signed timestamps must fall between creation and the completion deadline. Grace adds submission time only. |
| Unsupported GitHub key | This deployment uses a pinned key. Another selector or rotated key requires a compatible deployment; retrying cannot change the existing verifier. |


## Transactions and balances

| What you see | What to do |
| --- | --- |
| No browser wallet | Open the site in a browser with an Ethereum-compatible wallet that supports Gnosis. |
| Wrong network | Use the switch-network control and confirm chain 100 in the wallet. |
| Not enough gas | The sending wallet needs native xDAI, including for withdrawal. |
| Transaction cancelled | Retry if desired. Claim simulation may already have disclosed the signed email bytes to the RPC. |
| Claim failed or bounty already settled | Check the explorer and refresh the bounty. A duplicate claim cannot pay again. |
| Paid, but no reward in the wallet | Connect the designated payout wallet and withdraw its credit. Claiming and withdrawing are separate transactions. |
| Reclaim disabled | Only the original funder can reclaim an unclaimed bounty, after the deadline plus seven days. |
| Withdrawal transfer failed | The credit is preserved. Its owner can authorize another nonzero destination. |


## Report a problem

Include the public bounty URL, transaction hash if one exists, and the visible error message. Remove email contents, addresses you do not intend to disclose, notification links and reply tokens. Never include private keys or wallet recovery phrases.

- [Open the source repository’s issue tracker](https://github.com/RonTuretzky/issue.fund/issues)
