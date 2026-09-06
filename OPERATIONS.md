# Operation and recovery

The deployed app is a static build. It reads public GitHub metadata anonymously, reads Gnosis through HTTPS RPC, performs local WebCrypto signature checks, and asks the user's wallet to submit transactions. It has no receipt-upload endpoint, proving server, GitHub token or custody key.

## Local development

- 8547: Anvil RPC, chain 31337.
- 4319: loopback development API with config, bounties, credits and local RPC forwarding.
- 5174: Vite frontend.

Start with `npm run chain`, `npm run deploy:local`, then `npm run dev`. The local manifest is `.local/deployment.rsa.json`. After contract changes, retain any existing deployment record, then explicitly create a fresh local deployment; `deploy:local` reuses an existing deployed address. Never expose unlocked Anvil wallets publicly.

The local API supports only `GET /api/config`, `GET /api/bounties`, `GET /api/credits/:address` and a loopback RPC proxy. Uploaded emails are processed by `shared/dkim.mjs` in the page, not this service. Raw files are held in memory and discarded on navigation/reload; reselect originals to retry.

## Static publishing

`npm run build:gnosis` builds `dist/` with `public/deployment.gnosis.json`. The manifest identifies chain 100, the escrow, immutable verifier, RSA key and ABI. The browser checks the chain and deployed key against the manifest before presenting the app. Do not reuse the legacy ZK manifest with this build.

`scripts/deploy-gnosis.mjs` deploys new immutable contracts with a hidden-input/secret-environment signer and a resumable local transaction checkpoint. `script/Deploy.s.sol` supports the pinned Etherform workflow. `scripts/export-gnosis.mjs` validates Foundry broadcast results and writes a manifest. Runtime validation checks compiled bytecode with compiler-declared immutable ranges normalized, then separately checks the actual immutable verifier/key and stored modulus. Deployment does not migrate old funds.

## Common recovery paths

- **No GitHub connection needed:** public reads require no credentials. Rate limits or API failures stop funding preflight; retry later. Create issues through GitHub's own UI.
- **Unsupported email:** obtain the original `.eml`; ensure it is a native merge or linked closure event, not a comment, forwarded message or manual closure. Titles and target branch must match the bounty.
- **Invalid RSA/body hash:** the file was modified, decoded, signed with another key, or is not a supported original. Download it again; never bypass signature checking.
- **Wrong reference or timestamps:** receipts cannot be repurposed for another escrow, chain, bounty or funding window. A new deployment requires newly funded work and appropriately timed receipts.
- **Wallet rejected:** retry from the current review. Signed data may already have reached the configured RPC during simulation, even if the transaction was cancelled.
- **Paid but not received:** the reward is a withdrawal credit for the authenticated wallet. Connect that wallet and withdraw; another submitter cannot withdraw it.
- **Transfer failure:** credit remains intact. The credited wallet can choose a different destination.
- **Expired bounty:** valid receipt submission remains possible through the seven-day grace period. Only the funder can reclaim after that period.

## Legacy ZK funds

The archived branch and [backlog issue #1](https://github.com/RonTuretzky/issue.fund/issues/1) retain the original verifier, interfaces and artifact requirements. The old Gnosis escrow and bounty #2 were left intact. Keep the original local proving key, verification key and WASM; a newly generated setup cannot recreate that deployment's key. Use a separate archived checkout for old claims. Do not delete legacy local artifacts while a bounty remains unsettled.
