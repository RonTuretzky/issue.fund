# Email privacy

What stays in the page and what becomes public when you submit a claim.

[All documentation](../README.md) · [Read on the website](https://issue.fund/#docs/reference/privacy)

## During Check receipts

For manual claims, selected files are read in your browser and checked with WebCrypto. The app does not upload them to a proving service or receipt-processing server. It does not save them to browser storage; leaving or reloading the bounty clears the selected files. Normal public GitHub and blockchain reads do not require your email contents.


## During claim submission

Direct DKIM verification requires the signed headers and complete canonical email bodies. These are included in the claim transaction, together with the signatures. They can contain your email address, other signed recipient fields, notification links and reply-to addresses.

After you accept the disclosure and choose Submit claim, simulation can send this data to the configured RPC provider before your wallet confirms. Cancelling in the wallet does not undo that earlier disclosure. Once included on-chain, the transaction data is public and cannot be deleted through this app.

> Submitting makes these emails public, including your email address and notification links.


## Notification links and reply addresses

Treat values embedded in notification emails as sensitive. GitHub documents reply-to addresses that identify an account and thread, and notes that unsubscribe links require the relevant signed-in account. Do not assume every token has the same permissions, or that publishing it is harmless.

- [GitHub: replying to email notifications](https://docs.github.com/en/subscriptions-and-notifications/get-started/configuring-notifications#replying-to-email-notifications)

## Choose the receipt holder deliberately

Before subscribing, use a notification address whose eventual disclosure you accept. If someone else supplies the originals, explain that their signed email data will be published. Changing a filename is fine; editing an address, deleting a link or redacting a body breaks the authenticated data.

Do not paste originals, reply addresses, notification tokens or claim calldata into a public support issue. Share an error message with sensitive data removed. Private or selectively redacted claims are not part of the current direct-verification flow.


## Wallet privacy

Bounty funding, designated payout wallets, credits, withdrawals and transaction amounts are also public on Gnosis. You do not provide a wallet private key to this app. Only approve transactions through your own wallet.
