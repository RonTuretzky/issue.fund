# Verification

## Fast checks

```sh
npm test
npm run test:contracts
npm run build
npx playwright install chromium

# With npm run dev running:
npm run test:ui
```

`tests/receipts.test.mjs` tests native event parsing, joining, spoofed comment rejection, formatting limits, ambiguous markers, private file cleanup, and public signal packing. It uses synthetic canonical strings to isolate parsing; it does not label them DKIM-valid receipts.

`contracts/test/MergeBounty.t.sol` isolates escrow and on-chain policy using a clearly named `UnitVerifier`. It tests routing, replay, mismatches, timing, refunds, failed transfers, credit conservation and invalid policy disclosures. That test verifier is never deployed by `deploy:local`.

`tests/browser/interface.spec.ts` tests frontend states using controlled API/RPC fixtures, including search, paid/open views, nested dialogs, wallet errors, wrong networks, invalid uploads, recovery and mobile layout. These tests are separate from cryptographic end-to-end verification.

`tests/github.test.mjs` checks public-only access, URL boundaries, canonical identity, issue/branch validation, stale review rejection, API errors, search scope and pagination. `tests/browser/repositories.spec.ts` covers onboarding, browser persistence/removal, search and status filters, issue details, GitHub creation handoff, duplicate rewards, final preflight rejection, keyboard dismissal and mobile WCAG checks. Both are included in the fast checks; their controlled GitHub fixtures never make real changes.

## Public GitHub onboarding acceptance test

The public fixture `RonTuretzky/tmp-mergebounty-public-e2e-20260906` was created specifically for this test. Issue #1 was submitted through GitHub's real browser form reached from MergeBounty, then found through the app's anonymous API client. The live fixture is not a mocked GitHub response.

With Anvil and the local app running, `npm run test:public-flow` uses `.local/public-onboarding-fixture.json` (`repo`, `issue`, `branch`, `createdViaGithubForm`) to fund that open issue through the browser, verify the canonical repo/issue/branch and escrow balance, advance the local deadline, refund and withdraw. It explicitly checks chain 31337 and restores its snapshot and clock. It does not spend Gnosis xDAI. The sanitized result is `.local/public-onboarding-results.json`.

Issue creation is an intentional handoff to GitHub, not an authenticated API operation inside MergeBounty. Private repos, GitHub token storage and OAuth flows are not implemented. Anonymous API rate limits are surfaced to the user and fail funding closed. Browser preflight is not atomic with GitHub state or a wallet confirmation.

## Circuit checks with a real email

The input JSON and raw message must stay private. Prepare an input using `prepareReceipt` from `server/receipt.mjs`, then write its `inputs` to a file under `.local/`. No example private email is committed.

```sh
MERGEBOUNTY_CIRCUIT_INPUT=.local/sample-input.json npm run test:circuit
```

The negative circuit test changes the RSA signature, signed subject, event body, SHA prefix state and DKIM disclosure boundary. Each must fail a circuit assertion, not merely a JavaScript preflight. The positive witness can also be checked using `snarkjs wtns check artifacts/Receipt.r1cs PRIVATE_WITNESS_PATH`.

## Actual GitHub → ZK → contract → ETH test

This run uses the actual generated verifier, real GitHub-signed emails, Anvil ETH transactions and the browser interface. It requires the local artifacts, deployment, original receipts and prepared GitHub fixture; no mock verifier or synthetic signing key substitutes for GitHub's signature.

1. Prepare an authorized disposable public repository with issues enabled and default branch `main`. Run `MERGEBOUNTY_TEST_REPO=owner/public-lab node scripts/github-fixture.mjs prepare`. This fixture helper uses the two user-owned authenticated `gh` accounts named in the script, both of which need the relevant repository permissions. The helpers reject private repos for new fixtures. Existing saved fixtures retain their original repository when resumed. Read the script before adapting it; it creates real GitHub content.
2. Deploy the generated verifier/escrow on a fresh local chain. The fixture predicts the escrow's address from the first Anvil account's deployment nonce. Do not transact from that account before the two deployments.
3. Run the funding test through the real UI:

   ```sh
   npx playwright test tests/browser/chain.spec.ts -g 'fund the fresh'
   ```

4. Only after funding, run `node scripts/github-fixture.mjs finish` to merge the PR and close its linked issue.
5. Download the two native GitHub emails to `.local/merge.eml` and `.local/closure.eml`.
6. Run `npm run test:chain`. The first run generates two full proofs; subsequent runs can import `.local/proof-pair.json` and verify them against the real contract.

The test confirms the signed-title wallet's identity, submits the claim from a different wallet, rejects a changed public input and replay, verifies exact ETH credit/withdrawal including transaction gas, and tests refund timing and an alternative withdrawal destination. It captures screenshots and sanitized reports under `.local/`.

Claim and refund tests restore their Anvil snapshots after checking terminal states. This keeps the original funded bounty open for repeat tests. The exported proofs remain available to demonstrate a claim manually. Snapshot identifiers and transaction hashes belong to this disposable local chain and are not public-network receipts.

Raw emails, Playwright traces, circuit witnesses, proof inputs and private local artifacts are ignored. Only share sanitized test reports or screenshots that you have inspected for personal information.
