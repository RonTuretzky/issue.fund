# Email privacy

How automatic and manual claims handle email data, and what becomes public.

[All documentation](../README.md) · [Read on the website](https://issue.fund/#docs/reference/privacy)

## Automatic collection

The dedicated service mailbox receives the original GitHub notifications. The server stores receipts encrypted before submission, validates them and relays the claim. Contributors do not need to expose a personal notification mailbox to use this route.

The service’s signed headers and complete canonical bodies still become public transaction data, including its mailbox address and notification links. The operator has accepted exposure of the dedicated collection account. The integration checks the account’s role and locks both completed conversations; those locks are reversible, and this acceptance is not a claim that reply-token impersonation has been eliminated.


## During Check receipts

For manual claims, selected files are read in your browser and checked with WebCrypto. The app does not upload them to a proving service or receipt-processing server. It does not save them to browser storage; leaving or reloading the bounty clears the selected files. Normal public GitHub and blockchain reads do not require your email contents.


## During claim submission

Direct DKIM verification requires the signed headers and complete canonical email bodies. These are included in the claim transaction, together with the signatures. They can contain your email address, other signed recipient fields, notification links and reply-to addresses.

For a manual claim, after you accept the disclosure and choose Submit claim, simulation can send the data to the configured RPC provider before your wallet confirms. Cancelling does not undo that disclosure. Automatic claims publish the collector’s receipts under the operator’s acceptance policy. Once included on-chain, either transaction’s data is public and cannot be deleted through this app.

> Submitting makes these emails public, including your email address and notification links.


## Notification links and reply addresses

GitHub’s reply-to address identifies both a conversation and the account whose name appears on an emailed comment. Publishing it may let someone use that credential to post as the notification recipient in that conversation. Treat this as an impersonation risk, not merely disclosure of an email address. We have not completed the live reply-token/forged-sender test matrix and do not claim every attempted reply succeeds or is blocked.

This concerns comments attributed to the receipt holder; the contract still binds payout to the signed wallet. GitHub says notification unsubscribe links require the relevant signed-in account, so they do not have the same documented behavior as reply credentials. GitHub also says reply addresses remain valid until a password reset; closing an issue does not itself revoke them.

- [GitHub: replying to email notifications](https://docs.github.com/en/subscriptions-and-notifications/get-started/configuring-notifications#replying-to-email-notifications)

## What locking can and cannot protect

Maintainers should adopt the [post-merge locking policy](https://issue.fund/#docs/maintainers/review-and-merge) for both the completed issue and merged PR, before receipts are simulated or published. Manual contributors must confirm that policy before merge, then confirm actual locks and the receipt holder’s account role before submission. Prepare PR, Check receipts and the contract do not check those locks.

GitHub lets repository owners, collaborators and people with write access comment in locked conversations. Use a dedicated outside notification account and confirm it is not exempt. Publishing a privileged maintainer’s receipts can expose their comment identity even while the conversations are locked.

Keep the conversations locked. A later unlock or role change can make exposed credentials usable again. Locks are reversible GitHub controls; they do not remove immutable receipt data or establish complete protection against email impersonation. The automatic service checks locks and account roles for its collector before submission, under its operator’s accepted exposure policy. Independent submissions remain possible without that service.

- [GitHub: who can comment in locked conversations](https://docs.github.com/en/communities/moderating-comments-and-conversations/locking-conversations)

## Choose the receipt holder deliberately

Before subscribing, use a notification address whose eventual disclosure you accept. If someone else supplies the originals, explain that their signed email data will be published. Changing a filename is fine; editing an address, deleting a link or redacting a body breaks the authenticated data.

Do not paste originals, reply addresses, notification tokens or claim calldata into a public support issue. Share an error message with sensitive data removed. Private or selectively redacted claims are not part of the current direct-verification flow.


## Wallet privacy

Bounty funding, designated payout wallets, credits, withdrawals and transaction amounts are also public on Gnosis. You do not provide a wallet private key to this app. Only approve transactions through your own wallet.
