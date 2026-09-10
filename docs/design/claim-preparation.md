# Simplifying contribution and claim preparation

Implementation and design assessment, September 10, 2026. The prefilled PR flow and existing-PR checker are implemented. A single commitment marker remains a future proposal; the deployed contracts still require both title markers.

## Current behavior

The bounty page knows the issue, chain, escrow and bounty number. **Prepare PR** fills the connected payout wallet, bounty reference and issue-closing line, validates the selected public source branch or fork, and opens GitHub with a prefilled title and description. Contributors review and create the PR on GitHub. Manual copy controls remain available.

Automatic collection removes the email download, upload and claim transaction. The static frontend prepares the PR; neither it nor the collector creates or edits the PR on the user's behalf. Withdrawal still requires the beneficiary's transaction.

The long `[bounty 0x…]` value is not the GitHub issue number. `MergeBountyV2.referenceFor` hashes the chain ID, escrow address and bounty number. The signed closure event identifies the issue and closing PR; the title reference selects one particular funded reward, including when there are multiple bounties for the same issue. The `[wallet 0x…]` marker designates its beneficiary.

## Implemented: Prepare PR

The existing contracts remain in place. `src/PreparePr.tsx` uses the public read-only client in `shared/pr.mjs` to provide this flow:

1. Open a bounty and connect the intended payout wallet. Show its complete address and net reward for confirmation; do not assume the funding wallet is the contributor's wallet.
2. Enter a short description and select the pushed source branch or fork. The bounty supplies the target branch and issue.
3. Open GitHub with the complete title and `Closes #ISSUE` description prefilled. The contributor reviews and submits the PR using their normal GitHub session; issue.fund needs no GitHub OAuth for this handoff.
4. Accept an existing PR URL as an alternative. Show the exact title and closing line to copy while preserving the existing description. Do not promise that a create-PR URL edits an existing PR.
5. Check the submitted PR's repository, target branch, title markers, payout wallet, issue-closing line, current merge state and collector readiness. Present specific corrections before merge. A GitHub API check helps prepare valid receipts; it does not replace the signed event evidence or guarantee delivery later.

GitHub documents compare-URL query parameters for `quick_pull`, `title` and `body`: [Using query parameters to create a pull request](https://docs.github.com/en/pull-requests/reference/using-query-parameters-to-create-a-pull-request). The implementation encodes the generated fields, validates public fork relationships and source branches, and preserves long descriptions with a compare-link/copy fallback. Same-owner forks use manual GitHub selection because owner-qualified links are ambiguous in that case.

The template picker reads repository-root, `.github` and `docs` templates and their `PULL_REQUEST_TEMPLATE` folders. Inserting a template preserves typed text. Organization-wide default templates are not automatically fetched; the form explicitly explains that prefilling replaces GitHub's default description. Users can paste a checklist or browse repository files when discovery fails. A missing closing line is inserted above the body, including when the supplied body contains an unclosed Markdown fence or HTML comment.

The checker rejects wrong/duplicate/incomplete title markers, the wrong payout wallet, repository or target, closed PRs/issues and elapsed completion windows. It treats closing keywords inside comments, code or quotes as examples, not a usable issue link. Collector readiness is displayed separately from PR metadata. Wallet/form changes invalidate results and pending responses; reviews expire after five minutes. Public API reads remain a preparation preview, not settlement evidence.

The App could later add a pre-merge check or update an existing PR with authorized edits. A server must not let an arbitrary caller set or replace someone else's payout address simply by knowing a PR URL. Use an authorized contributor or maintainer action, bind it to the intended wallet and bounty, and visibly show the result. PR-title updates are supported by GitHub's [pull request API](https://docs.github.com/en/rest/pulls/pulls#update-a-pull-request), but the current collector does not implement this workflow.

## A single marker in a future contract version

If shorter PR titles matter, replace the two markers with one commitment to the same data. For example, the site could generate a full-length hash of `(chain ID, escrow, bounty ID, payout wallet)`. The signed merge title contains that commitment; the claim supplies the wallet, and the contract recomputes and checks the commitment before crediting it. No mutable off-chain mapping or account-ownership proof is required for that design.

This removes the visible address and separate bounty reference from the title, but the replacement hash is still opaque. A truly short, human-readable code would need a separately designed on-chain binding or a reviewed commitment length/collision policy; a server-only lookup would make the server authoritative for the recipient. Neither design is implemented or security-reviewed yet.

A new verifier/escrow deployment and matching collector/frontend parsing would be required. Preserve old escrows and use their existing marker rules for already funded bounties. Cover payout substitution, wrong chain/escrow/bounty, duplicate issue bounties, replay and authentic GitHub notification formatting before rollout.

Simply dropping the bounty reference could be a different product rule—one accepted PR pays every eligible bounty for its issue—but would change the current one-receipt/one-bounty semantics. It should be an explicit design decision, not a parser shortcut.

## Limits of moving the data elsewhere

The deployed verifier authenticates the title in the native merge email. Its accepted events do not provide the PR description or source branch as an authenticated payout field. Moving the wallet to either location, or looking it up from the GitHub API or a username, would not satisfy the current contract.

Prefilling the existing required data is the smallest change that removes manual bookkeeping without changing the payout rules. A sponsored withdrawal or direct transfer is a separate improvement; the current pull-payment design preserves credit if a recipient cannot accept a transfer.
