# Decentral Park / MergeBounty

A native-token escrow for GitHub issues (xDAI on Gnosis; test ETH locally), with a React interface and private proofs of GitHub's DKIM-signed merge and issue-closure notifications.

Branded with Decentral Park's official tree mark, self-hosted fonts, fund palette and lifted buttons. Source and integration details are in [BRANDING.md](BRANDING.md).

The funder agrees to pay the wallet in the **PR title at merge time**. No GitHub-account enrollment or identity proof is needed. Anyone holding the receipts can generate and submit a claim; the contract fixes the beneficiary. The captured GitHub emails included the PR title but did not include the source branch name, so putting the wallet only in a branch is insufficient for this implementation.

**The Gnosis deployment is experimental and uses real xDAI. It is unaudited; use tiny amounts.** It uses a development Groth16 ceremony, a pinned GitHub DKIM key, and a deliberately narrow notification format. GitHub remains the authority for repository events. The prover cannot authorize a payment on its own.

See [VERIFICATION.md](VERIFICATION.md) for the completed real-email, proof, payout and refund checks.

## Gnosis live version

The static frontend is hosted at **https://mergebounty-gnosis.turetzkyron.chatgpt.site** with owner-only access. It reads Gnosis directly and uses your browser wallet for transactions. See [GNOSIS.md](GNOSIS.md) for the verified contracts, deployment workflow, and acceptance test.

For email proof generation on the prepared development computer:

```sh
npm run prover:gnosis
```

On the live page, choose **Connect prover** and paste the private code from `.local/prover-pairing-code`. Allow local network access for this page if the browser requests it. Keep the computer awake while proving. The prover listens only on `127.0.0.1:4320`; it requires the pairing code and accepts the specific site origin. Original emails remain local. Funding, withdrawals and public-proof import work without a prover.

The matching 2.7 GB proving key and WASM are already installed on this computer. **Do not generate a new setup for the live deployment.** A fresh setup produces a different verification key. Running on another computer requires a copy of these exact public proving artifacts; an artifact distribution service and a browser-only prover are not included.

## Run a separate local development chain

Prerequisites: Node 22, npm, Foundry (`forge` and `anvil`), Circom 2.2.2 for circuit compilation. The first circuit build and setup need substantial disk, memory and time. The development machine has 128 GB RAM; this is not a phone/browser prover.

```sh
npm ci --ignore-scripts

# First setup only, if artifacts are absent:
npm run circuits:build
node scripts/download-ptau.mjs
MERGEBOUNTY_PTAU=artifacts/hermez23.ptau npm run setup

# Terminal 1: local chain; use only its public test accounts.
npm run chain

# Terminal 2: deploy the actual generated verifier and escrow.
npm run deploy:local
npm run dev
```

Open **http://127.0.0.1:5174**. Connect a browser wallet to chain 31337, or choose “Local test wallet.” Wallet 1 is the funder, wallet 2 the example beneficiary, and wallet 3 a relayer. Local accounts contain test ETH and must never hold real assets.

For the compiled frontend, run `npm run build`, then `npm start`, and open **http://127.0.0.1:4319**. Both modes use the localhost prover and local Anvil RPC. The application is intentionally bound to localhost; publishing this server would expose private proof inputs and unlocked test accounts.

Deployments are recorded in `.local/deployment.json`. The deployment script refuses to replace existing live contracts. Restarting Anvil without a state file erases its local chain. Setup preserves completed proving keys and refuses to overwrite a partial setup. See [OPERATIONS.md](OPERATIONS.md) for artifact recovery.

## User flow

1. **Find and fund:** choose **Browse repositories**, add a public GitHub repository, then browse, search or import an issue. **Create issue** opens GitHub's issue form; submit there, then return and refresh or paste its URL. Review the open issue, detected default branch, reward and deadline, then confirm funding in your wallet. The contract escrows the native token and emits a bounty reference bound to the chain, contract and bounty number. Terms cannot be edited afterward.
2. **Contribute:** copy the title template from the bounty. Use one `[bounty 0x…]` marker and one `[wallet 0x…]` marker in the PR title. Include `Closes #ISSUE` in the PR description and target the funded branch. The intended branch must also be the repository's default branch for GitHub to perform the automatic issue closure.
3. **Receive:** subscribe to both the issue and PR before the merge. Download the original `.eml` for the native merge notification and the issue notification saying it was completed via that PR. In Gmail, use the specific message's three-dot menu → Download message. A forwarded email or a comment containing “Merged” is insufficient.
4. **Inspect:** upload the two receipts. The UI checks signatures and the joined bounty terms, then shows the beneficiary before proof generation.
5. **Prove:** generate two private proofs locally. Progress survives page navigation/reload. You can cancel, retry, or export/import the public proofs. Imported proofs must pass the actual contract's verification before the UI accepts them.
6. **Claim:** any wallet may pay gas to submit the proofs. The escrow credits the signed-title wallet, even if another wallet submitted the transaction. Replaying the claim fails.
7. **Withdraw:** the credited wallet authorizes withdrawal to itself or another nonzero Ethereum address. Failed native-token transfers preserve its credit.
8. **Refund:** if no claim succeeds, the funder can reclaim after the completion deadline plus a seven-day claim period. Refunds become withdrawable credit. A funder cannot race a timely claim during that grace period.

Both DKIM issuance timestamps must fall between bounty creation and its completion deadline. Submission is allowed through the grace period. The rule accepts a linked completed issue and merged PR; it does not judge code quality or establish authorship of the contribution.

## Public repository onboarding

MergeBounty requires no GitHub OAuth, account connection, API token or repository installation. Public metadata is read directly from `api.github.com`, without credentials. GitHub handles authentication only on its own site when a user creates an issue. Private repositories are outside the app's scope.

Saved repositories are browser bookmarks, persisted by numeric repository ID and canonical name; they are not ownership registrations or an on-chain repository registry. Funded issues are discoverable through the shared escrow. Removing a bookmark does not affect any bounty.

The funding review verifies public visibility, an active repository with issues enabled, a real open issue (not a pull request), and an existing default branch compatible with the deployed verifier. Immediately before invoking the wallet it repeats the checks and rejects changes in repository ID/name, issue ID or default branch. Duplicate unsettled bounties require explicit review; a new bounty does not top up an existing one. Repository names and branch terms remain fixed in escrow.

These are browser preflight checks, not additional smart-contract guarantees. GitHub may change after the check, including while the wallet confirmation is open. The deployed escrow validates signed receipts and still identifies repositories by name. GitHub's unauthenticated API rate limit also applies: the UI pauses funding with a retry message when it cannot verify an issue. Search is paginated and reports GitHub's partial-result and 1,000-result limits. The app does not bypass rate limits with shared credentials.

## Components

| Component                       | Responsibility                                                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `src/`                          | React + TypeScript interface; live contract data; wallet transactions; upload, proof, claim, withdrawal and refund states |
| `server/receipt.mjs`            | DKIM preflight and full-body circuit inputs                                    |
| `server/prove-worker.mjs`       | Witness generation, Groth16 proving, off-chain proof verification, Solidity calldata export                               |
| `circuits/Receipt.circom`       | RSA-SHA256 DKIM integrity and bounded public disclosures, built on `@zk-email/circuits`                                   |
| `contracts/ReceiptPolicy.sol`   | Strict parsing of the proof-authenticated native notification fields                                                      |
| `contracts/MergeBounty.sol`     | Immutable native-token escrow, bounty reference, claim policy, credits and refunds                                                 |
| `contracts/ReceiptVerifier.sol` | Generated Groth16 verifier for this exact circuit and ceremony                                                            |

See [PROTOCOL.md](PROTOCOL.md) for the statement and trust boundaries, [TESTING.md](TESTING.md) for verification, and [OPERATIONS.md](OPERATIONS.md) for setup and recovery.

## Privacy

The public proof reveals the PR and issue subjects, the native first event paragraph including MIME prefix, DKIM signature metadata with the signature value removed, and a hash of the GitHub public key. The subject contains the payout wallet and bounty reference. These disclosures appear in transaction calldata.

Email sender/recipient headers, reply/unsubscribe tokens, and the remaining body are private witness data. Original emails are processed on this computer. DNS verification sends the DKIM selector/domain to a resolver, not the email contents. The application does not log email contents. Job directories have restricted permissions; private intermediate inputs and witnesses are removed on success, failure, cancellation and restart recovery. Your original uploaded files remain on your own disk. Public proof jobs remain under `.local/jobs` (Anvil) or `.local/gnosis-jobs` (Gnosis) for resumption. The shared browser/server receipt policy is in `shared/receipt-policy.mjs`.

## Scope and production gaps

- Native chain currency only (xDAI on Gnosis, ETH on Anvil); one funder and one winner per bounty. No ERC20 rewards, disputes, reputation, partial payouts, top-ups, fees or upgrade administrator.
- GitHub's exact ASCII, 7-bit plain-text MIME notification format is supported. Signed canonical headers must fit 1,975 bytes and the canonical body 4,023 bytes. Long, localized, encoded, forwarded or changed templates fail closed.
- Repository and branch names are compared exactly. Renames, transfers and repository-name reuse are not resolved using GitHub numeric repository IDs. Fund only repositories whose maintenance and naming you trust.
- The deployment pins one RSA public-key hash. GitHub can change keys or notifications. There is no key registry or automatic rotation; incompatible receipts require another deployment. Revocation/compromise handling is not implemented.
- The default ceremony is locally generated for testing. Production requires a reviewed circuit, verified independent ceremony contributions including circuit-specific phase 2, artifact provenance, security review and external audits. A community phase-1 file alone does not make this setup production-ready.
- The local service retrieves the newest 100 bounties. Production-scale indexing, chain finality/reorg handling, gas optimization and remote proving infrastructure are outside this version.
- RSA-1024 is the size of the observed GitHub `pf2023` signing key. This implementation verifies that existing signature; it cannot strengthen GitHub's underlying key or guarantee its future security.

Never commit `.eml`, witness files, local proof inputs, private mailbox metadata, keys, or ceremony entropy. These working artifacts are ignored by Git.
