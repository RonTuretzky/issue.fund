# Contracts and supported limits

Find the live contracts and understand the boundaries of the current payment rule.

[All documentation](../README.md) · [Read on the website](https://issue.fund/#docs/reference/contracts)

## Gnosis deployment

The public static app uses native xDAI on Gnosis, chain ID 100. The deployment manifest records the verifier, escrow, ABI and pinned public key. Contract source verification confirms published source correspondence; it is not a security audit.

- Network: Gnosis (100), native xDAI
- Escrow: [0x1f5cE96dFa05D207Ca8E59C6ab4B9F1895D24630](https://gnosisscan.io/address/0x1f5cE96dFa05D207Ca8E59C6ab4B9F1895D24630?tab=contract)
- RSA/DKIM verifier: [0xc2404198b7519c915817826586ec3892332a27cf](https://gnosisscan.io/address/0xc2404198b7519c915817826586ec3892332a27cf?tab=contract)

- [Download the current deployment manifest](https://issue.fund/deployment.gnosis.json)
- [Source and deployment records](https://github.com/RonTuretzky/issue.fund/tree/codex/automation-production/deployments/gnosis)

## Claim fees and changing the fee recipient

V2 deducts a fixed success fee when a valid claim settles. The funding form shows both the fee and the contributor’s net reward. Refunds return the full reward, and V1 bounties retain their original no-fee terms.

The V2 owner can change the wallet credited with fees from future claims. The owner cannot change the fee percentage, redirect contributor rewards, withdraw other wallets’ credits, replace the verifier or move active bounty funds. Previously earned fees remain credited to the old recipient.

1. Connect the current owner wallet on Gnosis. Open Fee settings below the wallet balance area on the bounty or repository page.
2. Enter New fee recipient, select Update fee recipient and confirm the transaction. The site reads the new address directly from the contract; no website redeployment is needed.
3. To transfer control as well, enter New owner wallet and select Propose owner transfer. Connect that new wallet and select Accept ownership. The current owner can cancel a pending transfer before acceptance.
4. To withdraw earned fees, connect the wallet that earned them and use Withdraw xDAI. Changing the fee recipient does not move old credits or transfer ownership.


## Supported receipt format

- GitHub notifications signed for github.com with selector pf2023, RSA-SHA256 and relaxed/relaxed canonicalization.
- The observed native multipart merge and completed-via-PR issue-closure templates. The signed subject, event footer and MIME boundaries are checked strictly.
- One wallet marker and one bounty reference in the PR title, with the same repository and closing PR in the two receipts.
- Original upload size up to 100 KB per file; canonical headers up to 8192 bytes and full canonical body up to 65536 bytes.
- Public-repository onboarding, supported ASCII repository/branch names and a default branch of at most 64 characters. The live UI currently lists the newest 100 bounties.


## Key and repository identity

The deployment pins the observed GitHub RSA-1024 public key with exponent 65537. RSA-1024 is weaker than modern 2048-bit RSA. There is no key rotation or revocation mechanism in this escrow. A GitHub key or template change can prevent new receipts from qualifying and may require another deployment.

Receipts bind the case-sensitive owner/repository name, not GitHub’s permanent numeric repository ID. Funding preflight checks identity before payment, but cannot eliminate rename or name-reuse risk during the bounty. Coordinate repository changes before funding work.


## Review status and transaction cost

No independent security audit has been completed. Automated tests and a real public-GitHub-to-Gnosis claim and withdrawal have passed; those checks do not guarantee the absence of defects. Review the contract and protocol before committing funds.

Verification gas depends on message size. The recorded two-email Gnosis claim used 9,283,775 gas. Use the current wallet estimate to evaluate the transaction fee; that gas count is not a fixed xDAI price.

- [Verification record and test scope](https://github.com/RonTuretzky/issue.fund/blob/codex/automation-production/VERIFICATION.md)
- [Recorded direct-DKIM Gnosis claim](https://gnosisscan.io/tx/0xdc00944624435a7f48e38666a3598df0768bc6cac0b7cfd0547a146281b0c053)

## Previous deployments

Existing funds stay in the immutable escrow where they were created. The previous ZK escrow is separate from this direct-DKIM deployment and requires its archived interface and original artifacts. A new deployment does not migrate or unlock old bounties.

- [Archived ZK implementation](https://github.com/RonTuretzky/issue.fund/tree/codex/archive-zk-proving)
- [Private-claim backlog and legacy requirements](https://github.com/RonTuretzky/issue.fund/issues/1)
