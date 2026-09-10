# Review and merge

Make sure the accepted PR produces receipts that can settle the bounty.

[All documentation](../README.md) · [Read on the website](https://issue.fund/#docs/maintainers/review-and-merge)

## Review the contribution normally

Run your project’s tests and verify the issue’s acceptance criteria. The escrow checks signed GitHub events; it does not inspect code quality, test results, authorship, or whether the fix is useful. Your merge decision still matters.


## Before pressing Merge

- Ask the contributor to run Check existing PR from the bounty’s Prepare PR flow. Treat its results as a preparation preview, then review the live title, wallet and linked issue on GitHub.
- The bounty is still open and there is time for GitHub to issue both notifications before the completion deadline.
- The PR targets the exact branch on the bounty page, and that branch is still the repository’s default branch.
- The PR title contains exactly one complete bounty reference and one nonzero payout-wallet marker, copied from this bounty.
- The contributor has confirmed the full wallet address, including when a maintainer has permission to edit the title.
- The description links the same funded issue using Closes #ISSUE_NUMBER. Keep the issue open until the merge closes it.
- For automatic claims, collector readiness is confirmed before merge. For manual claims, a participant is subscribed to both the issue and PR with email delivery enabled, including their own activity if they perform the merge.
- The receipt holder has confirmed the repository’s post-merge locking policy. Both the merged PR and linked closed issue must be locked before publishing receipts; use an outside notification account whose role does not bypass the locks.


## Link the issue in the description

For an issue in the same repository, use the following pattern, replacing 42 with its actual issue number. The funded repository and merge receipt must match; do not substitute a cross-repository workflow.

```text
Closes #42
```

- [GitHub: linking a pull request to an issue](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue)

## Make post-merge locking a repository policy

Configure maintainer-controlled automation to lock the merged bounty PR and its linked completed issue promptly after completion, before anyone simulates or submits a receipt claim. The issue.fund collector integration performs and rechecks both locks before its own submission. A manual route needs your own workflow/App or a maintainer to lock and verify both conversations before publication.

Document this policy in your contribution instructions and monitor failed runs. This is a policy implemented by automation, not a setting applied merely by funding an issue or a branch-protection rule. A merged or closed state does not mean locked. A workflow must cover both conversations; locking only the PR leaves the issue exposed.

Without these locks, published reply credentials may enable comments under the notification holder’s identity. This exposes the repository to impersonated activity and exposes maintainers directly if their own notifications are submitted. Use an outside collection account; do not rely on locks for an account with repository privileges.

Keep both conversations locked after settlement. Unlocking them or granting the receipt holder privileged access can revive the risk while the public credentials remain available. Locking reduces exposure; it neither removes the on-chain data nor guarantees that every email reply path is blocked. The live email-impersonation test matrix has not been completed.

Locks are an operational precaution, not an on-chain claim condition. The contract cannot read GitHub’s current lock state and does not require the service’s approval. This preserves independent submission while leaving receipt disclosure choices with the holder.

- [GitHub: locking conversations and privileged accounts](https://docs.github.com/en/communities/moderating-comments-and-conversations/locking-conversations)
- [GitHub API: lock an issue or PR conversation](https://docs.github.com/en/rest/issues/issues#lock-an-issue)
- [GitHub Actions: events for repository automation](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)

## After the merge

1. Confirm that GitHub reports the PR merged into the target branch.
2. Confirm that the funded issue was closed as completed through that PR.
3. Confirm both conversations show locked before any receipt publication. For manual claims, communicate this to the receipt holder and verify their account is not exempt from the locks. Resolve failed locking automation first.
4. For automatic claims, follow the bounty status while the server collects the native events and submits the claim. For manual claims, have the receipt holder download the specific merge and linked closure messages.
5. Once Reward credited appears, the contributor withdraws. The automatic integration locks the completed issue and PR before submission; no separate maintainer payment release is needed.


## Avoid an unclaimable merge

Putting the wallet only in a branch name, comment, commit message, or PR description does not meet this payment rule. Manually closing the issue does not replace the linked closure event. Editing the PR title after merging cannot change the title authenticated by the original merge email.

Continue with [Collect the email receipts](https://issue.fund/#docs/contributors/collect-emails) or [Troubleshooting](https://issue.fund/#docs/reference/troubleshooting) if either event is missing.
