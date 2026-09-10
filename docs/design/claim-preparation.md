# Simplifying contribution and claim preparation

Design assessment, September 10, 2026. These are proposed improvements; the current application still uses the two title markers and a separate issue-closing line.

## Current behavior

The bounty page already knows the issue, chain, escrow and bounty number. Connecting a payout wallet fills its address into a complete title template, and Copy copies both markers together. Contributors do not need to record or type either value. They still paste the title into GitHub and add `Closes #ISSUE` to the description.

Automatic collection removes the email download, upload and claim transaction. It does not currently prepare or edit the PR. Withdrawal still requires the beneficiary's transaction.

The long `[bounty 0x…]` value is not the GitHub issue number. `MergeBountyV2.referenceFor` hashes the chain ID, escrow address and bounty number. The signed closure event identifies the issue and closing PR; the title reference selects one particular funded reward, including when there are multiple bounties for the same issue. The `[wallet 0x…]` marker designates its beneficiary.

## Recommended first change: Prepare PR

Keep the existing contracts and automate composition:

1. Open a bounty and connect the intended payout wallet. Show its complete address and net reward for confirmation; do not assume the funding wallet is the contributor's wallet.
2. Enter a short description and select the pushed source branch or fork. The bounty supplies the target branch and issue.
3. Open GitHub with the complete title and `Closes #ISSUE` description prefilled. The contributor reviews and submits the PR using their normal GitHub session; issue.fund needs no GitHub OAuth for this handoff.
4. Accept an existing PR URL as an alternative. Show the exact title and closing line to copy while preserving the existing description. Do not promise that a create-PR URL edits an existing PR.
5. Check the submitted PR's repository, target branch, title markers, payout wallet, issue-closing line, current merge state and collector readiness. Present specific corrections before merge. A GitHub API check helps prepare valid receipts; it does not replace the signed event evidence or guarantee delivery later.

GitHub documents compare-URL query parameters for `quick_pull`, `title` and `body`: [Using query parameters to create a pull request](https://docs.github.com/en/pull-requests/reference/using-query-parameters-to-create-a-pull-request). Implement URL encoding, fork comparison, size/error handling and a copy fallback. Existing repository templates must remain available rather than being silently discarded.

The App could later add a pre-merge check or update an existing PR with authorized edits. A server must not let an arbitrary caller set or replace someone else's payout address simply by knowing a PR URL. Use an authorized contributor or maintainer action, bind it to the intended wallet and bounty, and visibly show the result. PR-title updates are supported by GitHub's [pull request API](https://docs.github.com/en/rest/pulls/pulls#update-a-pull-request), but the current collector does not implement this workflow.

## A single marker in a future contract version

If shorter PR titles matter, replace the two markers with one commitment to the same data. For example, the site could generate a full-length hash of `(chain ID, escrow, bounty ID, payout wallet)`. The signed merge title contains that commitment; the claim supplies the wallet, and the contract recomputes and checks the commitment before crediting it. No mutable off-chain mapping or account-ownership proof is required for that design.

This removes the visible address and separate bounty reference from the title, but the replacement hash is still opaque. A truly short, human-readable code would need a separately designed on-chain binding or a reviewed commitment length/collision policy; a server-only lookup would make the server authoritative for the recipient. Neither design is implemented or security-reviewed yet.

A new verifier/escrow deployment and matching collector/frontend parsing would be required. Preserve old escrows and use their existing marker rules for already funded bounties. Cover payout substitution, wrong chain/escrow/bounty, duplicate issue bounties, replay and authentic GitHub notification formatting before rollout.

Simply dropping the bounty reference could be a different product rule—one accepted PR pays every eligible bounty for its issue—but would change the current one-receipt/one-bounty semantics. It should be an explicit design decision, not a parser shortcut.

## Limits of moving the data elsewhere

The deployed verifier authenticates the title in the native merge email. Its accepted events do not provide the PR description or source branch as an authenticated payout field. Moving the wallet to either location, or looking it up from the GitHub API or a username, would not satisfy the current contract.

Prefilling the existing required data is the smallest change that removes manual bookkeeping without changing the payout rules. A sponsored withdrawal or direct transfer is a separate improvement; the current pull-payment design preserves credit if a recipient cannot accept a transfer.
