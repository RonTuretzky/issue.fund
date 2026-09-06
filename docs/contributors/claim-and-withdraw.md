# Claim and withdraw

Check the receipts locally, submit a claim, and collect the credited reward.

[All documentation](../README.md) · [Read on the website](https://issue.fund/#docs/contributors/claim-and-withdraw)

## Check the pair locally

1. Open the correct bounty and select the original Merged PR email and Issue closure email.
2. Choose Check receipts. The browser checks the existing RSA signatures and whether the events match this bounty; there is no proof generation or service to connect.
3. Review the closing PR and the complete payout wallet shown in Signatures and bounty match.
4. If you change either file, check the pair again. The previous review and disclosure acknowledgement are cleared.


## Submit the claim

Connect a Gnosis wallet with xDAI for gas. It may be a different wallet from the payout address; the review explains when you are relaying for someone else. Acknowledge the email-disclosure notice, then choose Submit claim and confirm the wallet transaction.

The full signed headers and canonical bodies are sent for transaction simulation and submission. The on-chain verifier checks them independently. The UI’s successful local check is a preview; the contract decides whether the claim is valid.

> Submitting makes these emails public, including your email address and notification links.


## Withdraw the credit

1. Wait until the bounty shows Paid. Settlement creates a credit; it does not immediately send the reward to your wallet.
2. Connect the payout wallet from the signed title. Its pending balance appears as ready to withdraw.
3. Choose Withdraw xDAI and inspect the full destination address. Only the credited wallet can authorize a different destination.
4. Confirm the withdrawal in that wallet and wait for confirmation. A successful withdrawal clears that wallet’s current credit balance.


## Retry safely

If a wallet request is rejected, retry from the review. If a transaction was sent, check its status before retrying. A repeated claim cannot pay an already-settled bounty again. If a withdrawal destination rejects the transfer, the credit remains available to its owner.

Keep the original files until settlement is confirmed. Uploads are held in page memory, so reloading or leaving the bounty clears them. For rejected receipts or a missing balance, see [Troubleshooting](https://issue.fund/#docs/reference/troubleshooting).
