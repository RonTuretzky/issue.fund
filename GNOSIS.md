# Gnosis direct-DKIM deployment

The live static app is [issue.fund public preview](https://mergebounty-gnosis.turetzkyron.chatgpt.site). It is public and needs only the browser, original email files and a Gnosis wallet with xDAI for gas.

| Component                | Address                                      |
| ------------------------ | -------------------------------------------- |
| Direct RSA/DKIM verifier | `0xc2404198b7519c915817826586ec3892332a27cf` |
| Direct escrow            | `0xf7d518780fb08d77a79efdc9fe8f9fd32bdd6d46` |
| Chain                    | Gnosis, 100                                  |
| Currency                 | Native xDAI                                  |

Deployment transactions: [verifier](https://gnosisscan.io/tx/0x2c8b9f6872626f92ceb0880445c25ef58eef5ea66631214a5424806550ed9e54), [escrow](https://gnosisscan.io/tx/0xacd7879b9e2c12626be43832fda88cc6d2a703c45c6c6998cab86588805a997f).

The machine-readable manifest is `public/deployment.gnosis.json`, mirrored in `deployments/gnosis/deployment.json`. It records the genuine GitHub RSA modulus, key hash, deployed addresses, ABI and transaction hashes. Deployment validation checks runtime source correspondence, verifier linkage and the exact pinned modulus.

Use **Repositories** to add a public repository, browse issues and fund one. Copy the PR-title markers from that bounty, subscribe to the issue and PR, merge with `Closes #N`, download the two original event emails, then check and submit them. The contract credits the title's wallet; use that wallet to withdraw. Submitting discloses the signed headers and full canonical email bodies, including addresses and notification links.

The deployment has not had an independent security audit. It pins GitHub's observed RSA-1024 key and supports a narrow native notification template. Read `PROTOCOL.md` before funding substantial work.

## Reproducible deployment

The manual workflow in `.github/workflows/deploy-gnosis.yml` uses BreadchainCoop/etherform pinned to `180aa91926a02ce2045f9a7e3ed08be9395ecfab`. It invokes `script/Deploy.s.sol:Deploy`, which requires chain 100. Configure the repository's Gnosis environment and secret variables before dispatch; creating the workflow does not provision those secrets.

The local equivalent is `forge build` followed by `node scripts/deploy-gnosis.mjs`, which accepts a key through hidden terminal input or `GNOSIS_DEPLOYER_KEY` supplied by a secret manager. Never pass the key as a CLI argument or commit it. The script records public transaction checkpoints, resumes interrupted deployment and validates the resulting manifest.

Every deployment is a new immutable escrow. The old ZK escrow `0xdf1f54c97c728f7101b797a6db2383bea2cdecc1` and its outstanding bounty #2 are preserved. They remain accessible through the archived implementation, not the new direct-RSA interface.

## Real GitHub → Gnosis acceptance test

On September 6, 2026, public repository `RonTuretzky/tmp-mergebounty-public-e2e-20260906`, issue #2 and merged PR #4 completed the direct flow through the static frontend. Bounty #1 funded 0.001 xDAI. Both genuine original GitHub notifications passed browser RSA checks; the Gnosis contract verified them, credited the designated wallet, and that wallet withdrew the exact reward less its withdrawal gas. No proving service was used.

Transactions: [fund](https://gnosisscan.io/tx/0x944461c0e8a8f721b0c7340462fe940aaa25f2869985b7045982730eebbadd3a), [claim](https://gnosisscan.io/tx/0xdc00944624435a7f48e38666a3598df0768bc6cac0b7cfd0547a146281b0c053), [withdraw](https://gnosisscan.io/tx/0x181287ceaab3d41fd06953778e6bf95d840ee9760d2f43adbb852bfd440c9944). The claim contains the intentionally disclosed signed headers and full canonical bodies. A sanitized machine-readable record is in `deployments/gnosis/e2e.json`.

Both contract sources are verified on Gnosisscan: [RSA/DKIM verifier](https://gnosisscan.io/address/0xc2404198b7519c915817826586ec3892332a27cf?tab=contract) and [escrow](https://gnosisscan.io/address/0xf7d518780fb08d77a79efdc9fe8f9fd32bdd6d46?tab=contract). `scripts/verify-gnosis.mjs` resolves the canonical explorer host before submitting verification to avoid POST data being lost on redirects.
