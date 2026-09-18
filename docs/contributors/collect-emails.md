# Collect the email receipts

Submit independently: subscribe before merge and preserve the two signed event messages.

[All documentation](../README.md) · [Read on the website](https://issue.fund/#docs/contributors/collect-emails)

## Anyone can collect and submit

You can choose this route from the start or keep it as an independent fallback alongside automatic collection. A contributor, sponsor or other subscriber can receive the required originals and relay them for the designated payout wallet. The email recipient, transaction sender and beneficiary do not need to be the same person.

You need no issue.fund registration, premium service or collector App installation. Subscribe on GitHub before the merge, preserve both native event emails, then [submit the claim](https://issue.fund/#docs/contributors/claim-and-withdraw) with a gas-funded wallet. The service cannot veto a valid direct claim, and another submitter cannot replace the wallet in the signed title.

The proof is the signed email evidence, not a newly generated ZK proof. Only valid, supported receipts within the bounty’s time limits can settle it. GitHub still controls whether it delivers the originals. See [Censorship-resistant claim submission](https://issue.fund/#docs/overview) for the limits.


## Using automatic collection?

If your bounty has automatic collection ready, the server receives and submits the emails for you. You may skip these download steps and [follow the automatic claim](https://issue.fund/#docs/contributors/automatic-claims), or subscribe independently before merge to retain your own originals. Automatic collection does not reserve the contract’s claim function for the service.


## Enable delivery before the merge

In GitHub’s notification settings, enable email for the conversations you participate in or watch. Subscribe to both the issue and PR, or configure repository watching for both Issues and Pull requests. Check the delivery address. If you perform the merge yourself, also check notifications for your own updates.

You need the email originals, not only an entry in GitHub’s web notification inbox.

- [Open GitHub notification settings](https://github.com/settings/notifications)
- [GitHub: configuring notifications](https://docs.github.com/en/subscriptions-and-notifications/get-started/configuring-notifications)

## Confirm the locking policy before using your own receipts

1. Before merge, ask the maintainer to confirm the repository policy and automation that will lock both the completed issue and merged PR. Review [Review and merge](https://issue.fund/#docs/maintainers/review-and-merge) together. A closed or merged badge is not a lock.
2. Choose an outside notification account without repository privileges and an email address whose disclosure you accept. A maintainer, collaborator or otherwise lock-exempt account should not rely on conversation locks to protect its reply credentials.
3. After completion and before any simulation or submission, open both GitHub conversations and confirm their lock events/current locked state. Confirm with the maintainer that the receipt account cannot bypass those locks and that the conversations will stay locked. An automation configuration or green PR check alone is insufficient.
4. If these precautions cannot be confirmed, do not treat personal receipt publication as safe. Arrange a dedicated outside collector and locking first, or use the automatic service when ready. Neither the manual form nor the contract enforces this check; it is a precaution for the person exposing the receipt.

> Publishing originals can expose reply credentials that may let someone comment as the receipt holder. Locking reduces this risk but does not erase public data or establish that impersonation is impossible. Read Email privacy before publishing.

- [Email privacy and impersonation risk](https://issue.fund/#docs/reference/privacy)

## Find these two events

I, N and BRANCH stand for the real issue number, PR number and funded target branch. The verifier also authenticates GitHub’s native event footer; copying this text into a comment cannot create a valid claim.

| Upload slot | Required native event |
| --- | --- |
| Merged PR email | The PR notification whose first event text is “Merged #N into BRANCH.” Its subject contains the payout wallet and bounty reference. |
| Issue closure email | The issue notification whose first event text is “Closed #I as completed via #N.” It names the same closing PR. |


## Download an original in Gmail

1. Open the conversation and expand the specific merge or closure message. A thread may contain several unrelated notifications.
2. Open the three-dot More menu belonging to that message, not the whole conversation toolbar.
3. Choose Download message and keep the .eml file unchanged.
4. Repeat for the other event. Give the two files recognizable names if you like; do not edit their contents.

- [Google: download email messages](https://support.google.com/mail/answer/9261412?hl=en)

## Other email clients

Use the client’s original-message or raw-source export that preserves the complete RFC 822/MIME message as an .eml file. An HTML export, PDF, screenshot, copied text or rewritten forwarded message will not work. Keep each file under 100 KB. The local check will tell you whether the original signature and event format are supported.


## Missing one of the emails?

Check spam, the configured notification address, and whether that exact event occurred. A manually closed issue does not produce the required “completed via PR” receipt. If another subscribed participant has the original pair, they can submit a valid claim for the designated wallet after considering that their signed email data will be public.

Subscribing after the merge does not establish that you will receive the earlier originals. Do not fabricate or edit a receipt. See [Troubleshooting](https://issue.fund/#docs/reference/troubleshooting), then [Claim and withdraw](https://issue.fund/#docs/contributors/claim-and-withdraw).
