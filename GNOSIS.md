# Gnosis experimental deployment

The frontend is a static React build. Chain reads, wallet transactions and imported-proof verification run from the browser against Gnosis. Original-email proof generation uses the paired local Node prover on this computer. This is a live experimental deployment, with real xDAI, an unaudited circuit/escrow, and a development Groth16 phase-2 setup.

| Item | Value |
|---|---|
| Site | https://mergebounty-gnosis.turetzkyron.chatgpt.site |
| Network | Gnosis mainnet, chain 100, native xDAI |
| Escrow | [0xdf1f54c97c728f7101b797a6db2383bea2cdecc1](https://gnosisscan.io/address/0xdf1f54c97c728f7101b797a6db2383bea2cdecc1#code) |
| Verifier | [0x0106a198a94ef9958a5ab2dfc0fdb96ac3092e4f](https://gnosisscan.io/address/0x0106a198a94ef9958a5ab2dfc0fdb96ac3092e4f#code) |
| Manifest | `public/deployment.gnosis.json` |
| Etherform revision | `180aa91926a02ce2045f9a7e3ed08be9395ecfab` |

Both contracts were deployed using `script/Deploy.s.sol`, and their sources were verified through Etherform's Blockscout verification helper. `scripts/export-gnosis.mjs` checks successful deployment receipts, byte-for-byte verifier runtime identity, escrow verifier address, and pinned GitHub key before exporting the frontend manifest.

## Test the application

1. Start `npm run prover:gnosis` in the prepared project. Keep it running and keep the computer awake.
2. Open the site in a browser with an Ethereum wallet. Connect the wallet and switch/add Gnosis when requested. Use a wallet holding a small amount of xDAI for gas.
3. Choose **Connect prover** and paste `.local/prover-pairing-code`. This code grants access only to your local prover, never to your wallet. Allow the browser's local network permission for this specific site if prompted.
4. Fund an issue with a tiny xDAI reward. Copy its exact bounty and wallet markers into the PR title before merging. Add `Closes #ISSUE` to its description; target the funded default branch.
5. Subscribe to the issue and PR before the merge. Download the original merged-PR and linked issue-closure `.eml` messages. Check them, generate the two proofs, and submit the claim.
6. The wallet named in the signed merge-time PR title withdraws its credited balance. The submitter cannot change that recipient.

Proof export/import works without exposing original emails. Import is checked by the actual Gnosis escrow using `eth_call`; a transaction still simulates again before submission. If the local service is stopped or the browser blocks loopback access, the site explains how to reconnect. Proof generation is not a standalone browser feature in this version.

## Reproducible deployment and Etherform

The checked-in GitHub workflows use the pinned `breadchaincoop/etherform` CI and deployment workflows. Gnosis deployment is **manual only**, via `workflow_dispatch`; it is never triggered by a pull request or ordinary push. A future manual deployment requires the `gnosis` GitHub environment and its `GNOSIS_DEPLOYER_KEY` and `GNOSIS_RPC_URL` secrets. No deployer credential is checked into this project or copied into frontend assets.

The completed initial deployment was run locally with Foundry's hidden interactive key entry. Etherform's broadcast parser, network resolver, artifact writer and verification helper were then run locally at the same pinned revision. The CI workflow is provided for reuse; an upstream Etherform GitHub Actions deployment was not used for this initial broadcast.

Two integration details need preserving: the current canonical Gnosis explorer is `https://gnosisscan.io` (the old Blockscout hostname redirects), and the generated verifier is named `Groth16Verifier` inside `contracts/ReceiptVerifier.sol`. Etherform's generic artifact writer assumes filename equals contract name, so `deployments/gnosis/deployment.json` corrects that source mapping. Dry-run broadcasts must be kept separate from the real broadcast before running its parser.

`forge script script/Deploy.s.sol:Deploy` checks chain 100 before broadcasting. Running it again deploys **new immutable contracts**, not an upgrade. Existing bounties and proof artifacts must continue using their original deployment. Preserve the original proving key for the current escrow.

## Acceptance evidence

The controlled fixture is issue #11 and PR #12 in the previously authorized private GitHub test repository. It uses a 0.001 xDAI bounty. Mainnet browser tests are explicitly gated behind `RUN_GNOSIS_E2E=1` and never run in routine CI. The full Gnosis flow passed on September 6, 2026: genuine receipts → local proof generation through the static frontend → browser proof import and on-chain verification → claim → exact withdrawal after gas. Mutated proofs and claim replay were rejected. The transactions are [funding](https://gnosisscan.io/tx/0x94260af729194eaa5acd4a26f1ec6355daaab04b9f37edb2322c2b3cb5df102a), [claim](https://gnosisscan.io/tx/0xbd92ead56c9ac35f63c5432c0069a4b5310fa87ed491e60789c10681481f0e10), and [withdrawal](https://gnosisscan.io/tx/0xf14a3d1bcf00ffd8489689917072bfbe60f50b6e5ed191b4c935172ba64fec24).

Local evidence is retained under `.local/gnosis-*`; private originals and keys are ignored by Git.

The production gaps and trust assumptions in `PROTOCOL.md` and `README.md` still apply. The successful test is not an audit or an independently secured circuit-specific ceremony.
