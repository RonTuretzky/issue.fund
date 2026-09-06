# Prepare your pull request

Bind the PR to the right bounty, wallet, issue, and target branch.

[All documentation](../README.md) · [Read on the website](https://issue.fund/#docs/contributors/prepare-pr)

## Copy the title from the bounty page

Open the bounty, connect your payout wallet, and use Copy beside YOUR PR TITLE. Keep exactly one of each marker. Replace only the human-readable description of the fix.

The following shows the shape of the title. These placeholders are not valid values; copy the real reference and address from your bounty.

```text
[bounty 0xYOUR_64_HEX_DIGIT_REFERENCE] [wallet 0xYOUR_40_HEX_DIGIT_ADDRESS] Describe your fix
```


## What each marker does

| Marker | Purpose |
| --- | --- |
| [bounty 0x…] | Binds the receipt to this chain, escrow contract and bounty number. Another bounty needs another reference. |
| [wallet 0x…] | Designates the address that receives credit after a valid claim. It must be a nonzero address you can use. |


## Link the issue and target the branch

Put a closing keyword in the PR description, using the actual funded issue number. Target the branch shown on the bounty; the current flow checks the default branch when funding. Ask the maintainer to leave the issue open until the PR merge closes it.

```text
Closes #42
```

- [GitHub: closing issues through a pull request](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue)

## Final check before review

- Check every character of the wallet address and the complete bounty reference.
- Use plain ASCII text in the title and preserve the marker spelling, brackets and spaces. Encoded or unusually formatted subjects may not match the supported email template.
- Do not use multiple wallet or bounty markers. A single receipt cannot claim several separately funded bounties.
- Do not rely on a source branch, comment, PR description or commit message to carry the payout address.
- Finish early enough for both email events to be signed before the deadline. The seven-day grace period only extends claim submission.


## Arrange receipt delivery now

Subscribe to the issue and PR and make sure GitHub delivers notifications by email. Someone who will keep the original files must receive both events. Follow [Collect the email receipts](https://issue.fund/#docs/contributors/collect-emails) before the merge, not after.
