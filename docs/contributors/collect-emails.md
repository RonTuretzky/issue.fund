# Collect the email receipts

Enable notifications and download the two original messages the contract accepts.

[All documentation](../README.md) · [Read on the website](https://issue.fund/#docs/contributors/collect-emails)

## Enable delivery before the merge

In GitHub’s notification settings, enable email for the conversations you participate in or watch. Subscribe to both the issue and PR, or configure repository watching for both Issues and Pull requests. Check the delivery address. If you perform the merge yourself, also check notifications for your own updates.

You need the email originals, not only an entry in GitHub’s web notification inbox.

- [Open GitHub notification settings](https://github.com/settings/notifications)
- [GitHub: configuring notifications](https://docs.github.com/en/subscriptions-and-notifications/get-started/configuring-notifications)

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
