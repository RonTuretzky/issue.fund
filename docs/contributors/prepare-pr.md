# Prepare your pull request

Open a prefilled GitHub PR, check its bounty details, and prepare for the merge.

[All documentation](../README.md) · [Read on the website](https://issue.fund/#docs/contributors/prepare-pr)

## Create a prefilled PR

This flow does not need GitHub OAuth in issue.fund and does not create or edit a PR on your behalf. You confirm the PR on GitHub. Creating a PR does not claim a reward or send a blockchain transaction.

1. Push your work branch to the public repository or your public fork. Open the funded bounty and choose Prepare PR.
2. Connect the wallet that should receive the reward. Review its complete address and the net reward after the claim fee; the funding wallet is not necessarily the contributor’s wallet.
3. Choose New PR, describe your fix in plain ASCII text, and enter the source repository. Use Load branches to choose a branch or type its exact name. The funded repository and target branch are already fixed.
4. Add your description and project checklist. If a repository PR template is listed, select it and choose Insert template. It is added to your text. Prefilling replaces GitHub’s default description, so keep the project’s required checklist.
5. Choose Prepare GitHub PR. The app checks the current issue, repository, source branch and fork relationship. It fills the bounty reference, payout address and issue-closing line for you.
6. Review the result and collection status, then choose Open prefilled PR on GitHub. GitHub opens in another tab with the title and description filled in. Review the target, linked issue and checklist, then create the PR in your normal GitHub session.
7. Return to Prepare PR, choose Check existing PR, and paste the new PR URL before asking the maintainer to merge.


## Check an existing PR

Choose Check existing PR and paste its GitHub URL. Connect the intended payout wallet and choose Check PR. The app checks the funded repository, target/default branch, open PR and issue, supported title, bounty reference, payout wallet, closing line and completion window.

Corrections appear beside the mismatched details. Use the copy controls to update the title or description on GitHub. Your existing description is preserved and a missing closing line is inserted above it. The app does not write to GitHub.

Collector status is shown separately: PR details match does not mean email delivery is ready. Resolve collector warnings or arrange manual notifications before merging. The GitHub API check is a preparation preview; only signed native event receipts can settle the bounty.

Changing the wallet or form clears the previous result. Reviews expire after five minutes. Recheck after edits and before merge; a later title edit cannot repair an already-issued merge email.


## Manual title copy

If you prefer to prepare the PR manually, connect the payout wallet and expand Copy the PR title manually on the bounty page. Copy the complete title and replace only the description of the fix. Copy the required text manually inside Prepare PR also provides the issue-closing line.

The placeholders below show the format only. Use the actual generated reference and address from your selected bounty.

```text
[bounty 0xYOUR_64_HEX_DIGIT_REFERENCE] [wallet 0xYOUR_40_HEX_DIGIT_ADDRESS] Describe your fix
```


## What each marker does

The long bounty reference is different from GitHub’s issue number. It selects this particular funded reward across chains and escrow versions. Closes #42 in the description tells GitHub which issue the PR resolves; the payout marker tells the contract which wallet to credit.

Prepare PR fills both markers and the closing line automatically. Both title markers remain required by the deployed contracts. You review and create or edit the PR on GitHub; the collector later handles receipts and the claim.

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

For automatic collection, confirm Notifications ready with the maintainer before merge, then follow [Follow an automatic claim](https://issue.fund/#docs/contributors/automatic-claims). The service receives the emails; you do not need to download them or submit a claim.

For manual collection, subscribe to both the issue and PR and enable email delivery before merge. Follow [Collect the email receipts](https://issue.fund/#docs/contributors/collect-emails).


## Templates, forks and recovery

- Branch suggestions show up to 100 names. Type any other pushed branch name; preparation checks that exact branch before creating the link.
- Public forks in the same repository network are supported. For a fork owned by the same account as the funded repository, use GitHub’s comparison controls to select the exact fork and copy the title/closing line manually.
- The template picker looks in the repository root, .github and docs, including their PULL_REQUEST_TEMPLATE folders. If a template cannot be loaded, browse repository files and paste its checklist. Organization-wide default templates are not loaded automatically.
- Long descriptions use Open comparison on GitHub plus Copy PR title and Copy PR description instead of an oversized link. The complete text is preserved. If clipboard access is blocked, select and copy the displayed text manually.
- If GitHub is unavailable or rate-limited, retry or use Copy the required text manually. Missing or unpushed source branches must be pushed first. Closed issues, changed repository terms and passed completion deadlines need attention before proceeding.
