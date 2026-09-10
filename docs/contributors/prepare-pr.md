# Prepare your pull request

Bind the PR to the right bounty, wallet, issue, and target branch.

[All documentation](../README.md) · [Read on the website](https://issue.fund/#docs/contributors/prepare-pr)

## Copy the title from the bounty page

Open the bounty and connect the wallet that should receive the reward. The app fills in both the bounty reference and that wallet’s full address. Use Copy beside YOUR PR TITLE and paste the complete title into GitHub. You do not need to write down or retype either value. Keep exactly one of each marker and replace only the description of the fix.

The following shows the shape of the title. These placeholders are not valid values; copy the real reference and address from your bounty.

```text
[bounty 0xYOUR_64_HEX_DIGIT_REFERENCE] [wallet 0xYOUR_40_HEX_DIGIT_ADDRESS] Describe your fix
```


## What each marker does

The long bounty reference is different from GitHub’s issue number. It selects this particular funded reward across chains and escrow versions. Closes #42 in the description tells GitHub which issue the PR resolves; the payout marker tells the contract which wallet to credit.

Both title markers are still required by the deployed contracts, including for automatic claims. The collector automates receipt handling and submission; it does not currently create or edit your PR title. If Copy shows YOUR_WALLET_ADDRESS, connect the intended payout wallet before copying.

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
