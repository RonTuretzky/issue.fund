# Claim and withdraw

Follow an automatic claim or submit receipts manually, then withdraw the credited reward.

[All documentation](../README.md) · [Read on the website](https://issue.fund/#docs/contributors/claim-and-withdraw)

## Automatic claim: wait for credit, then withdraw

For a bounty with automatic collection ready, the server receives the original emails, checks them, locks the completed conversations and submits the claim on Gnosis. It pays claim gas. You do not upload emails, generate a proof or confirm a claim transaction.

Watch the bounty’s automatic-claim status. When Reward credited appears, connect the payout wallet and follow Withdraw the credit below. If the status needs attention, read the recovery message or contact the operator. The following receipt-checking and submission steps apply to manual claims.

- [Automatic claim statuses and recovery](https://issue.fund/#docs/contributors/automatic-claims)

## Submit independently, even if the service is unavailable

Anyone holding the valid originals can submit a claim for an open bounty, including one funded with automatic collection selected. No operator approval or maintainer payout authorization is required. The original signed payout wallet receives credit; the transaction sender only pays claim gas.

The receipt upload controls remain on the bounty page. If issue.fund itself is unavailable, the public source can be hosted independently or another client can call claim(id, merged, closed) on the correct escrow with the canonical receipts. Use the exact chain, contract and bounty ID from the funded reward; review [Contracts and supported limits](https://issue.fund/#docs/reference/contracts) and the [developer guide](https://issue.fund/#docs/reference/developers).

Before submitting your own receipts, follow the [collection and lock-confirmation steps](https://issue.fund/#docs/contributors/collect-emails). Confirm both locks after merge and before simulation, check the receipt holder’s account role and understand the reply-token risk. The manual UI and contract do not verify GitHub locks; these precautions do not create a permission requirement for the on-chain claim.


## Check the pair locally

1. Open the correct bounty and select the original Merged PR email and Issue closure email.
2. Choose Check receipts. The browser checks the existing RSA signatures and whether the events match this bounty; there is no proof generation or service to connect.
3. Review the closing PR and the complete payout wallet shown in Signatures and bounty match.
4. If you change either file, check the pair again. The previous review and disclosure acknowledgement are cleared.


## Submit the claim

Connect a Gnosis wallet with xDAI for gas. It may be a different wallet from the payout address; the review explains when you are relaying for someone else. Acknowledge the email-disclosure notice, then choose Submit claim and confirm the wallet transaction.

The full signed headers and canonical bodies are sent for transaction simulation and submission. The on-chain verifier checks them independently. The UI’s successful local check is a preview; the contract decides whether the claim is valid.

> Submission exposes email addresses and reply credentials, potentially allowing comments as the receipt holder. Confirm both conversation locks and account-role precautions before simulation. Public receipt data cannot be withdrawn.


## Withdraw the credit

1. Wait until the bounty shows Paid. Settlement creates a credit; it does not immediately send the reward to your wallet.
2. Connect the payout wallet from the signed title. Its pending balance appears as ready to withdraw.
3. Choose Withdraw xDAI and inspect the full destination address. Only the credited wallet can authorize a different destination.
4. Confirm the withdrawal in that wallet and wait for confirmation. A successful withdrawal clears that wallet’s current credit balance.


## Retry safely

If a wallet request is rejected, retry from the review. If a transaction was sent, check its status before retrying. A repeated claim cannot pay an already-settled bounty again. If a withdrawal destination rejects the transfer, the credit remains available to its owner.

Keep the original files until settlement is confirmed. Uploads are held in page memory, so reloading or leaving the bounty clears them. For rejected receipts or a missing balance, see [Troubleshooting](https://issue.fund/#docs/reference/troubleshooting).
