# Developer setup

Run the app locally, test direct verification, and navigate the source.

[All documentation](../README.md) · [Read on the website](https://issue.fund/#docs/reference/developers)

## Run locally

Use Node 22, npm and Foundry (forge and anvil). Clone the source repository, install dependencies, and keep the chain and development app in separate terminals. The local flow uses test ETH on chain 31337; it does not send Gnosis transactions.

```text
git clone https://github.com/RonTuretzky/issue.fund.git
cd issue.fund
npm ci --ignore-scripts

# Terminal 1
npm run chain

# Terminal 2
npm run deploy:local
npm run dev
# Open http://127.0.0.1:5174
```


## Check changes

The chain and app must be running for chain/browser integration tests. Run stateful suites sequentially against the same Anvil instance. Synthetic test signing keys are used only for local verifier deployments. Genuine mail and signing keys are never part of the repository or ordinary CI.

```text
npm test
npm run test:contracts
npm run test:chain
npm run test:ui
npm run docs:build
npm run build:gnosis
```

- [Full testing guide](https://github.com/RonTuretzky/issue.fund/blob/codex/automation-production/TESTING.md)

## Source map

| Path | Responsibility |
| --- | --- |
| shared/dkim.mjs | Canonicalize email and check the existing RSA signature in the browser. |
| contracts/GithubDkimVerifier.sol | Verify signed headers, the complete body hash and immutable GitHub key. |
| contracts/ReceiptPolicy.sol | Parse the authenticated native events and title markers. |
| contracts/MergeBounty.sol | Enforce escrow terms, credits, refunds and withdrawals. |
| src/ClaimPanel.tsx | Receipt uploads, local preview, disclosure and claim submission. |
| shared/documentation.mjs | Canonical guide content used by the website and exported Markdown. |


## Keep documentation in sync

Edit shared/documentation.mjs and run npm run docs:build to refresh the Markdown in docs/. The website uses the same page catalogue and content. Keep every audience’s pages in the catalogue and link new procedures from the relevant onboarding path.


## Hosting and contract deployment

npm run build:gnosis creates a static dist/ build. npm run deploy:pages publishes it to the repository’s codex/pages branch; GitHub Pages serves issue.fund through Cloudflare DNS. The app reads the deployment manifest and HTTPS RPC directly; it needs no local server or proof-generation software. No email or wallet secret belongs in a static build.

Contract deployment creates new immutable addresses and does not migrate existing funds. The source includes a chain-100 deployment script and a pinned Breadchain Etherform workflow. See the operations and Gnosis records before deploying.

- [GitHub Pages hosting and Cloudflare DNS](https://github.com/RonTuretzky/issue.fund/blob/codex/automation-production/CLOUDFLARE.md)
- [Operations and recovery](https://github.com/RonTuretzky/issue.fund/blob/codex/automation-production/OPERATIONS.md)
- [Gnosis deployment guide](https://github.com/RonTuretzky/issue.fund/blob/codex/automation-production/GNOSIS.md)
- [Browse the source](https://github.com/RonTuretzky/issue.fund)
