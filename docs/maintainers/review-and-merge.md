# Review and merge

Make sure the accepted PR produces receipts that can settle the bounty.

[All documentation](../README.md) · [Read on the website](https://issue.fund/#docs/maintainers/review-and-merge)

## Review the contribution normally

Run your project’s tests and verify the issue’s acceptance criteria. The escrow checks signed GitHub events; it does not inspect code quality, test results, authorship, or whether the fix is useful. Your merge decision still matters.


## Before pressing Merge

- The bounty is still open and there is time for GitHub to issue both notifications before the completion deadline.
- The PR targets the exact branch on the bounty page, and that branch is still the repository’s default branch.
- The PR title contains exactly one complete bounty reference and one nonzero payout-wallet marker, copied from this bounty.
- The contributor has confirmed the full wallet address, including when a maintainer has permission to edit the title.
- The description links the same funded issue using Closes #ISSUE_NUMBER. Keep the issue open until the merge closes it.
- A participant is subscribed to both the issue and PR, with email delivery enabled. If that person performs the merge, check their own-activity notification settings too.


## Link the issue in the description

For an issue in the same repository, use the following pattern, replacing 42 with its actual issue number. The funded repository and merge receipt must match; do not substitute a cross-repository workflow.

```text
Closes #42
```

- [GitHub: linking a pull request to an issue](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue)

## After the merge

1. Confirm that GitHub reports the PR merged into the target branch.
2. Confirm that the funded issue was closed as completed through that PR.
3. Have the receipt holder download the specific native merge and linked closure messages, not a comment or the whole conversation.
4. The contributor can now follow Claim and withdraw. No additional signature or release action is needed from you.


## Avoid an unclaimable merge

Putting the wallet only in a branch name, comment, commit message, or PR description does not meet this payment rule. Manually closing the issue does not replace the linked closure event. Editing the PR title after merging cannot change the title authenticated by the original merge email.

Continue with [Collect the email receipts](https://issue.fund/#docs/contributors/collect-emails) or [Troubleshooting](https://issue.fund/#docs/reference/troubleshooting) if either event is missing.
