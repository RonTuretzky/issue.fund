# Receipt policy

Which GitHub emails qualify for payment, who gets paid, and why a claim can fail.

[All documentation](../README.md) · [Read on the website](https://issue.fund/#docs/reference/receipt-policy)

## The payment rule in one sentence

Pay the wallet named in the PR title when two original, signed GitHub emails show that the PR merged into the funded branch and completed the funded issue. The bounty must still be open, and both events must have been signed within its funded time window.


## The two emails you need

The numbers here are examples. Use Prepare PR on the bounty page: it fills the wallet and bounty markers into the title and the closing instruction into the description. The contract later checks the actual notification emails, not the text you typed into a comment.

The title contains one [wallet 0x…] marker and one [bounty 0x…] marker. These abbreviated examples are not pasteable values; Prepare PR supplies the full address and reference. The reference selects one reward on one chain and escrow, so two rewards for the same issue cannot be confused.

| Receipt | What GitHub must say | What it establishes |
| --- | --- | --- |
| PR merge email | Merged #43 into main. | PR #43 merged into the required branch. Its signed title supplies the payout wallet and bounty reference. |
| Issue completion email | Closed #42 as completed via #43. | Issue #42 was completed by that same PR #43. |


## What must match before payment

1. Authenticity: both emails must verify against this deployment’s pinned GitHub signing key. The signed headers and full email body must be intact.
2. Event type: one email must be GitHub’s own merge notification, and the other its linked issue-completion notification. A contributor’s comment describing a merge does not qualify.
3. Same work: both emails must name the funded repository and the same PR. The closure must name the funded issue; the merge must name the funded destination branch.
4. Same reward: the merge-time title must contain exactly one valid wallet marker and one bounty marker. The wallet cannot be zero or the escrow itself. The bounty marker must match this funded reward.
5. Timing: each email’s authenticated signing time must be on or after funding and on or before the bounty deadline, and cannot be in the future. Any DKIM expiry must still be valid.
6. Settlement: submit while the bounty is open and no later than seven days after its deadline. The grace period allows late submission, not late completion. A paid or refunded bounty cannot pay again.
7. Credit: successful settlement credits the title’s wallet after the fixed success fee. That wallet then withdraws; the person submitting the emails cannot choose a different beneficiary.


## Examples that do not qualify

| Example | Why it fails |
| --- | --- |
| Only a merge email | There is no authenticated link showing that the funded issue was completed. |
| An issue closed manually without “as completed via #43” | The issue event does not identify a closing PR. |
| A comment quoting “Merged #43 into main.” | A comment is not a native merge event, even if GitHub signs its notification email. |
| PR #43 merged, but the closure names PR #44 | The two receipts describe different work. |
| A title with duplicate wallet or bounty markers | Ambiguous payment instructions are rejected. |
| Correct emails for an event before funding or after the deadline | The signing times fall outside the funded window. |
| Edited or redacted original emails | Changing authenticated bytes breaks verification. |


## Why the email format is checked so closely

GitHub signs notification emails for ordinary comments as well as real events. A valid signature alone cannot distinguish the two. ReceiptPolicy checks the event sentence at the start of the plain-text section, followed immediately by GitHub’s native event footer. The footer’s URL and Message ID must agree on the thread and event number.

MIME is the format that packages the plain-text and HTML versions of an email. The policy checks their separators and the ending so someone cannot hide a fake event inside an extra section. This deliberately supports a narrow GitHub template; a genuine email in a different format can be rejected. GithubDkimVerifier separately checks the signature, body hash, signed subject and DKIM tags.

- [Read the annotated ReceiptPolicy.sol](https://github.com/RonTuretzky/issue.fund/blob/codex/automation-production/contracts/ReceiptPolicy.sol)
- [Supported key and email formats](https://issue.fund/#docs/reference/contracts)

## Anyone can collect and submit

There is no on-chain allowlist of email recipients or claim submitters. Subscribe to the issue and PR before merge to receive your own originals, then submit through the manual flow or directly to the escrow. This preserves a path around an unavailable or censoring collector. GitHub remains the source of event truth, and chain inclusion and the claim deadline still apply.

The collector normally submits its own receipts and pays claim gas. It has no power to change the wallet in a valid signed title. You do not need a separate proof that the wallet owns a GitHub account.

- [Collect the email receipts yourself](https://issue.fund/#docs/contributors/collect-emails)
- [Submit a claim and withdraw](https://issue.fund/#docs/contributors/claim-and-withdraw)

## Public emails and impersonation

A claim publishes signed email contents, including recipient addresses and reply credentials. Someone may use an exposed reply address to post as the notification recipient. Maintainers should automatically lock both the completed issue and merged PR before disclosure; closure alone is not a lock. Manual contributors should confirm that policy before merge, then confirm the actual locks and that the receipt account cannot bypass them.

Conversation locks and the receipt account’s GitHub role are service checks, not facts proven by this contract. Use the dedicated outside collector account where possible. The contract also does not prove code quality or that a contributor owns a GitHub username.

- [Read the full privacy and locking guidance](https://issue.fund/#docs/reference/privacy)
- [Maintainer review and merge guide](https://issue.fund/#docs/maintainers/review-and-merge)
