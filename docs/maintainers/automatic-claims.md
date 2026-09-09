# Set up automatic claims

Let the collector receive GitHub emails and submit claims for contributors.

[All documentation](../README.md) · [Read on the website](https://issue.fund/#docs/maintainers/automatic-claims)

## Choose automatic collection

When automatic collection is offered in Fund an issue, paste an issue URL and choose Automatically through the collector. Funders and contributors do not connect a GitHub account to issue.fund. A maintainer separately enables the repository integration.

The setup panel reports Preparing notifications, Notifications ready, or Attention needed. Fund with automatic collection only after Notifications ready. You can explicitly choose manual collection instead; prepare your own email delivery before the merge.


## Enable the repository integration

1. A repository maintainer follows Maintainer: enable collector from the setup panel and installs the collector’s GitHub App on the selected public repository.
2. The App needs metadata read, issues write and pull requests write permissions. It checks the collection account’s repository role and locks completed bounty conversations. It does not run contributor code or decide what should be merged.
3. Keep the dedicated collection account outside the repository’s collaborators and privileged organization roles. A lock cannot protect a reply credential belonging to an account that is exempt from it.
4. Wait for a real GitHub notification to reach the mailbox. If no normal activity is expected, coordinate a harmless setup notification with the service operator. A subscription API response alone does not establish email delivery.
5. Review the displayed claim fee, contributor’s net reward and deadline, then fund. The service rechecks readiness before wallet confirmation.


## After reviewing a contribution

Review and merge normally, preserving the exact bounty reference and payout wallet in the PR title and linking the funded issue. The collector needs both original native event emails.

Before submitting the collected receipts, the integration locks both the completed issue and PR and checks the collector’s role. Keep these conversations locked: unlocking them or later granting the collector privileges can make already-public reply credentials usable again.

A successful claim credits the wallet in the signed PR title. The contributor still authorizes a separate withdrawal transaction.


## If the collector needs attention

- Do not merge until email delivery is prepared if you expect an automatic claim. Late subscription cannot recover historical original emails.
- Mailbox outages, missing installation permissions, gas limits and missing receipts appear in the bounty’s automatic-claim status. The reward remains governed by its on-chain completion deadline and seven-day claim window.
- Manual and independent receipt submissions remain possible. Read Email privacy before publishing receipts from a personal account.

- [Email privacy](https://issue.fund/#docs/reference/privacy)
- [Contributor: follow an automatic claim](https://issue.fund/#docs/contributors/automatic-claims)
- [Contact the service operator](mailto:turetzkyron@gmail.com)
