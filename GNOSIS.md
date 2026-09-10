# Gnosis direct-DKIM deployment

The live static app is [issue.fund](https://issue.fund). It is public and needs only the browser, original email files and a Gnosis wallet with xDAI for gas.

| Component                     | Address                                      |
| ----------------------------- | -------------------------------------------- |
| Direct RSA/DKIM verifier      | `0xc2404198b7519c915817826586ec3892332a27cf` |
| V2 escrow (new bounties)      | `0x1f5cE96dFa05D207Ca8E59C6ab4B9F1895D24630` |
| V1 escrow (preserved)         | `0xf7d518780fb08d77a79efdc9fe8f9fd32bdd6d46` |
| Initial fee recipient / owner | `0x86213f1cf0a501857B70Df35c1cb3C2EcF112844` |
| V2 success fee                | 1% (100 basis points), fixed                 |
| Chain                         | Gnosis, 100                                  |
| Currency                      | Native xDAI                                  |

V2 deployment: [confirmed transaction](https://gnosisscan.io/tx/0xb0dc07f9a2d723caa78e80c0968c652c0771f9d6890a17ded170ef5cdb5e0caf), September 10, 2026. The initial owner can change the fee recipient; ownership transfers require acceptance. The deployer has no fee administration rights.

Original V1 deployment transactions: [verifier](https://gnosisscan.io/tx/0x2c8b9f6872626f92ceb0880445c25ef58eef5ea66631214a5424806550ed9e54), [escrow](https://gnosisscan.io/tx/0xacd7879b9e2c12626be43832fda88cc6d2a703c45c6c6998cab86588805a997f).

The machine-readable manifest is `public/deployment.gnosis.json`, mirrored in `deployments/gnosis/deployment.json`. It records the genuine GitHub RSA modulus, key hash, deployed addresses, ABI and transaction hashes. Deployment validation checks runtime source correspondence, verifier linkage and the exact pinned modulus.

Paste a public issue URL into **Fund an issue**, or use **Repositories** to browse repositories already represented by bounties. Copy the PR-title markers from that bounty, subscribe to the issue and PR, merge with `Closes #N`, download the two original event emails, then check and submit them. The contract credits the title's wallet; use that wallet to withdraw. Submitting discloses the signed headers and full canonical email bodies, including addresses and notification links.

The deployment has not had an independent security audit. It pins GitHub's observed RSA-1024 key and supports a narrow native notification template. Read `PROTOCOL.md` before funding substantial work.

## Reproducible deployment

The manual workflow in `.github/workflows/deploy-gnosis.yml` uses BreadchainCoop/etherform pinned to `180aa91926a02ce2045f9a7e3ed08be9395ecfab`. It invokes `script/Deploy.s.sol:Deploy`, which requires chain 100. Configure the repository's Gnosis environment and secret variables before dispatch; creating the workflow does not provision those secrets.

The local equivalent is `forge build` followed by `node scripts/deploy-gnosis.mjs`, which accepts a key through hidden terminal input or `GNOSIS_DEPLOYER_KEY` supplied by a secret manager. Never pass the key as a CLI argument or commit it. The script records public transaction checkpoints, resumes interrupted deployment and validates the resulting manifest.

Every deployment is a new immutable escrow. The old ZK escrow `0xdf1f54c97c728f7101b797a6db2383bea2cdecc1` and its outstanding bounty #2 are preserved. They remain accessible through the archived implementation, not the new direct-RSA interface.

## V1 real GitHub → Gnosis acceptance test

On September 6, 2026, public repository `RonTuretzky/tmp-mergebounty-public-e2e-20260906`, issue #2 and merged PR #4 completed the direct flow through the static frontend. Bounty #1 funded 0.001 xDAI. Both genuine original GitHub notifications passed browser RSA checks; the Gnosis contract verified them, credited the designated wallet, and that wallet withdrew the exact reward less its withdrawal gas. No proving service was used.

Transactions: [fund](https://gnosisscan.io/tx/0x944461c0e8a8f721b0c7340462fe940aaa25f2869985b7045982730eebbadd3a), [claim](https://gnosisscan.io/tx/0xdc00944624435a7f48e38666a3598df0768bc6cac0b7cfd0547a146281b0c053), [withdraw](https://gnosisscan.io/tx/0x181287ceaab3d41fd06953778e6bf95d840ee9760d2f43adbb852bfd440c9944). The claim contains the intentionally disclosed signed headers and full canonical bodies. A sanitized machine-readable record is in `deployments/gnosis/e2e.json`.

Both contract sources are verified on Gnosisscan: [RSA/DKIM verifier](https://gnosisscan.io/address/0xc2404198b7519c915817826586ec3892332a27cf?tab=contract) and [escrow](https://gnosisscan.io/address/0xf7d518780fb08d77a79efdc9fe8f9fd32bdd6d46?tab=contract). `scripts/verify-gnosis.mjs` resolves the canonical explorer host before submitting verification to avoid POST data being lost on redirects.

## Deploy the V2 success-fee escrow

V2 is a separate escrow. Keep V1 and its credits accessible. The V2 deployment
script reuses the existing verified RSA verifier and defaults to 100 basis points
(1%). Set the fee recipient explicitly; it is also the initial owner. The fee
rate, verifier and key are immutable. The owner can change future fee routing
with `setFeeRecipient(address)`. Previously earned credits stay with the old
recipient. `transferOwnership(address)` followed by `acceptOwnership()` moves
control; `transferOwnership(address(0))` cancels a pending handoff. The deployed
frontend exposes these actions in Fee settings when the corresponding wallet is
connected. Ownership cannot be renounced or assigned to the escrow itself.

1. Build and test: `forge build`, `forge test`, `npm run test:deployment`,
   `npm run test:automation`, and `npm run build:gnosis`.
2. Set public environment values `FEE_RECIPIENT`, `EXPECTED_DEPLOYER`, and
   optionally `CLAIM_FEE_BPS` (default `100`). Run `npm run deploy:v2:plan`.
   It checks chain/source/verifier/key identity, pending nonces, the fee and gas
   budget, then writes `.local/v2-deployment-plan.json` without signing or sending.
3. Review that plan. Run `node scripts/deploy-v2-gnosis.mjs --execute`, supplying
   the deployer key through hidden terminal input or a secret-manager environment.
   The expected deployer must match. The command stores and flushes a private
   transaction checkpoint before broadcast, then waits for 12 confirmations and
   verifies the new runtime, immutable parameters and initial ownership. It writes a candidate
   `.local/v2-release.json`; it does not switch the public site.
4. On an uncertain response, rerun the same command and terms. The checkpoint
   binds the signed creation bytes, signer, chain, nonce, verifier, fee and
   compiler output. It only retries the original transaction. A conflicting nonce
   or changed source/terms stops the operation for reconciliation. Never delete
   the checkpoint merely because an RPC response was lost.
5. Verify the explorer source with
   `node scripts/verify-gnosis.mjs .local/v2-release.json`.
6. Run `node scripts/promote-v2-manifest.mjs` to revalidate and promote the
   candidate locally. It preserves all prior escrow addresses and the original
   numeric bounty-link mapping, and exports the flat service deployment list to
   `.local/automation-deployments.json`. Deploy that list to the collector and
   signer before publishing the Pages build.
7. Complete the real-mail acceptance checks and enable the service configuration
   deliberately; funding a V2 bounty does not by itself enable automatic receipt
   collection. Publish the built frontend through the existing Pages branch, then
   verify a genuine fund/collect/claim/withdraw run and both old/new escrow access.

The default deployment gas ceiling is 10 million gas, 10 gwei per gas, and
0.05 xDAI maximum total gas cost, with a 0.001 xDAI account reserve. The read-only
plan reports its exact current estimate. These are deployment limits; relay claim
limits are configured separately in the operator guide.
