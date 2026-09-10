# Maintainer onboarding

Set up a public repository and a clear agreement with contributors.

[All documentation](../README.md) · [Read on the website](https://issue.fund/#docs/maintainers/getting-started)

## Your role

You review code and decide what to merge using your normal GitHub process. Automatic collection is live and uses a maintainer-installed GitHub App, a dedicated notification account and a server relay. Manual receipt claims need no App. Neither path needs signing-key registration or separate maintainer payout approval; the merged PR and linked issue event remain the payment evidence.

A funder may be a maintainer, contributor, or sponsor. Start with an issue URL; no repository registration or GitHub connection is required.


## Premium automation for maintainers

Automatic email collection and claim submission are live. We can configure the premium service for your public repository so contributors don’t have to upload emails. Get in touch to arrange the maintainer App and collector notifications before work is merged.

- [Contact turetzkyron@gmail.com](mailto:turetzkyron@gmail.com?subject=issue.fund%20premium%20automation)

## Before funding

- Write clear acceptance criteria in an open GitHub issue: expected behavior, scope, and how you will review the fix.
- Keep the repository public, with issues enabled, and use its default branch as the merge target. Archived or disabled repositories are not accepted by onboarding.
- Agree with the contributor on a completion deadline and payout wallet. Confirm whether the service will collect the emails or a participant will supply them manually.
- Set a repository policy to automatically lock both the completed issue and merged PR before receipts are published. Use the collector integration or maintainer-controlled automation; closing an issue is not a conversation lock. Publish the policy for manual contributors to confirm before merge.
- Read [Email privacy](https://issue.fund/#docs/reference/privacy). For automatic claims, follow [Set up automatic claims](https://issue.fund/#docs/maintainers/automatic-claims) and wait for Notifications ready before anyone merges.


## Protect notification holders and the repository

Publishing receipts exposes reply credentials as well as email addresses. Someone may use an exposed reply address to post comments attributed to its notification recipient. If completed bounty conversations stay unlocked, the repository and receipt holders remain exposed to this impersonation risk, including a maintainer whose own receipt is used.

Follow the [post-merge locking policy](https://issue.fund/#docs/maintainers/review-and-merge). Use a dedicated notification account without repository privileges; maintainer or collaborator receipts are a poor choice because privileged accounts can bypass conversation locks. The contract does not enforce locks or account roles, and the manual claim form does not confirm them for you.

> Before inviting manual claims, arrange automatic locking and explain the remaining reply-token exposure. A merged PR or closed issue is not enough.


## Start with an issue

1. Choose an open issue on GitHub, or create one there using the repository’s issue templates.
2. Open Fund an issue and paste the issue URL. The app checks the public repository, issue, and default branch automatically.
3. Choose automatic collection and complete the readiness checks, or explicitly select manual collection. Review the reward, fee and deadline, then confirm funding in your wallet.
4. The repository appears in Repositories once it has a bounty. This optional directory lets anyone browse and search its issues; there are no browser bookmarks to manage.

- [Explore bounties](https://issue.fund/#)

## Publish the contribution instructions

Share the bounty’s URL and collection mode with contributors. Ask them to use Prepare PR to fill the payout wallet, bounty reference and issue-closing line, then check the PR before review. You still review the code, wallet and linked issue on GitHub. With automatic collection ready, the server handles the receipts and claim; contributors authorize withdrawal after credit.

Continue with [Fund an issue](https://issue.fund/#docs/maintainers/fund-issue), then use [Review and merge](https://issue.fund/#docs/maintainers/review-and-merge) before completing a contribution.
