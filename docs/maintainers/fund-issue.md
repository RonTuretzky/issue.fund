# Fund an issue

Check the target, choose the reward and deadline, and create the escrow.

[All documentation](../README.md) · [Read on the website](https://issue.fund/#docs/maintainers/fund-issue)

## Connect the funding wallet

Use Connect wallet and select Browser wallet. If prompted, switch to Gnosis (chain ID 100). Keep enough native xDAI for the reward and gas. Connecting does not itself move funds; funding requires a transaction confirmation.


## Review and fund

1. Open Fund an issue or select an issue from Repositories. Paste an issue URL such as https://github.com/owner/repo/issues/42.
2. Choose Review issue. Check the canonical repository name, issue title and number, and target branch. A pull-request URL or closed issue cannot be funded through this flow.
3. Enter the reward in xDAI and choose 7, 14, 30, or 90 days to complete the work.
4. Read the escrow terms and acknowledge that you will arrange the required email notifications.
5. Choose Fund bounty. The app checks GitHub again before asking your wallet to confirm. Wait for the transaction to succeed, then share the new bounty page.


## Premium automation for maintainers

Let contributors focus on the code. We can set up a premium service to collect and submit the required GitHub emails for your project, so contributors don’t have to upload them. Get in touch to discuss setup.

- [Contact turetzkyron@gmail.com](mailto:turetzkyron@gmail.com?subject=issue.fund%20premium%20automation)

## Terms fixed by the transaction

| Term | What it means |
| --- | --- |
| Repository and issue | Only receipts for the funded repository name and issue can settle this bounty. |
| Target branch | The checked default branch is fixed at funding. Coordinate before changing it on GitHub. |
| Reward and deadline | They cannot be edited or withdrawn early after funding. |
| Claim grace period | Seven days after the completion deadline, for submitting receipts signed within the completion window. |
| Platform fee | The escrow takes no platform fee. Wallet transactions still use gas. |


## Existing bounties and additional funding

Creating another bounty does not top up an existing reward. Each bounty has a different reference, and the supported PR title has exactly one reference. One merged-PR receipt cannot settle several separate bounties. Review any duplicate warning before committing more funds.


## If funding is interrupted

If you reject the wallet request, the form remains available to retry. If you submitted a transaction, check its wallet or explorer status before funding again. An issue closed, renamed, replaced, or moved to another default branch during review requires a fresh preflight.

Once funded, continue to [Review and merge](https://issue.fund/#docs/maintainers/review-and-merge). For expiry, see [Manage rewards and refunds](https://issue.fund/#docs/maintainers/manage-bounties).
