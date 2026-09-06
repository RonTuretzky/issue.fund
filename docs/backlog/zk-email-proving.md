# Backlog: optional private GitHub-email claims with ZK proofs

Status: deferred. Preserve this implementation on `codex/archive-zk-proving`; the active product is moving to direct RSA/DKIM verification so users do not need a proving service, proving key or client-side proof generation.

## Preserved implementation

- `circuits/Receipt.circom`: RSA-SHA256 DKIM verification, authenticated subject, native event prefix and complete DKIM metadata. Built with Circom 2.2.2 and zk-email circuits 6.3.4.
- `contracts/ReceiptVerifier.sol`: generated Groth16 verifier; `ReceiptPolicy.sol`: strict interpretation of its 43 public signals; `MergeBounty.sol`: immutable escrow, claim window, beneficiary credit and withdrawal.
- `server/receipt.mjs`, `server/prove-worker.mjs`, `server/jobs.mjs`, `server/index.mjs`: original-email inspection, private witness generation, two sequential Groth16 proofs, proof verification, resumable jobs, cancellation and cleanup.
- `shared/receipt-policy.mjs`: browser/server statement checks and public-signal encoding. Imported proof files are simulated against the actual escrow before acceptance.
- `src/App.tsx` and `src/static-api.ts`: paired local prover, original `.eml` upload, recipient preview, progress/recovery, proof export/import, claim, refund and withdrawal.
- Setup/build/provenance scripts, Etherform integration, contract/circuit/browser tests and operational documentation are retained on this branch.

## Statement and disclosure

Two genuine GitHub notifications are joined: `Merged #PR into BRANCH.` and `Closed #ISSUE as completed via #PR.` The complete subject identifies the canonical repo and PR/issue. The merged PR title includes exactly one `[bounty 0x…]` and one `[wallet 0x…]`. Both DKIM timestamps must be within the bounty funding window. The bounty reference binds chain, escrow address and bounty number. Any relayer can claim, but only the signed-title wallet receives credit.

The source branch is not present in the captured emails; placing the address only in that branch is insufficient. This does not establish GitHub-account ownership, contribution authorship or code quality.

Public signals are the GitHub key hash, subject (13 packed fields), native first MIME event prefix (9), and canonical DKIM metadata with the signature removed (20), totaling 43. Sender/recipient headers, reply/unsubscribe links and the rest of the body remain private witnesses. Do not publish originals, witness files, mailbox tokens, private job inputs, deployer keys or ceremony entropy.

## Size and operation

The compiled circuit has approximately 5.6 million constraints. Its buffers are 2,048 header bytes and 4,096 body bytes, with actual canonical input limits of 1,975/4,023 bytes to avoid the buffer-length boundary. It supports a narrow ASCII, 7-bit native GitHub MIME template and fails closed on unsupported formats, forwarding, comments and unmerged closures.

The final proving key is approximately 2.7 GB; WASM approximately 25 MB. The prepared development computer has 128 GB RAM. Two actual receipts were proved and paid in a roughly 2.5-minute local acceptance run. This is not a phone/browser-only prover. A static website uses a paired loopback service; Sites' 128 MB worker limit cannot accommodate it.

The archive's `npm run prover:gnosis` starts the service on 127.0.0.1:4320. A private pairing code and exact Origin/Host checks restrict access. Jobs remove raw inputs/witnesses after success, failure, cancellation and restart; public proof results remain resumable. Original uploads remain on the owner's disk.

## Existing Gnosis deployment and funded claims

- Chain 100; escrow `0xdf1f54c97c728f7101b797a6db2383bea2cdecc1`.
- Verifier `0x0106a198a94ef9958a5ab2dfc0fdb96ac3092e4f`.
- Pinned key hash `18769159890606851885526203517158331386071551795170342791119488780143683832216`.
- Original manifest and source checksums: `public/deployment.gnosis.json` on this branch.
- Bounty #1 completed actual funding → genuine receipts → Groth16 verification → claim → withdrawal. Bounty #2 was deliberately left funded for the owner's manual test; changing the frontend does not migrate or cancel it.
- The escrow/verifier are immutable. The direct-verification deployment must be separate. Existing proof files and bounties are bound to their original escrow. Keep the original circuit, proving key and manifest for any outstanding legacy claims.

To run the archived interface, use a separate checkout of this branch, `npm ci --ignore-scripts`, and the exact original public artifacts from the prepared machine. Build with `npm run build:gnosis`, run the paired prover, and serve the static build on the archive's allowed localhost origin (127.0.0.1:5175). Use the original manifest. Do not run a new setup for an existing escrow: it produces a different key and invalidates compatibility. The artifact binaries are intentionally not in Git; their retained location is the prepared machine's ignored `artifacts/` directory. Original receipt files remain private on that machine.

## Security and remaining production work

1. Review the statement, circuit and exact on-chain parser together. Preserve attacks against fake comments, injected MIME parts, chosen disclosure offsets, missing subject coverage, ambiguous markers, altered SHA state, unsigned headers, `l=` truncation, future/stale timestamps and replay.
2. Replace the development circuit-specific phase-2 ceremony with independently verified contributions, artifact checksums and reproducible provenance. The public phase-1 file alone does not secure phase 2.
3. Define an authenticated, time-aware DKIM key registry: rotation, revocation, compromised-key policy and historical validity. The observed GitHub `pf2023` key is RSA-1024; proof verification cannot strengthen GitHub's source key.
4. Address mutable repository names/renames/transfers and numeric identity binding. A browser's GitHub lookup is not a decentralized identity proof.
5. Design artifact distribution and integrity checks, realistic desktop/mobile memory targets, progress/cancellation, resource limits, and browser proving feasibility before promising a no-install private path.
6. If remote proving is offered, specify exactly who sees emails, retention, encryption, deletion, operating cost and denial-of-service controls. Never label untrusted remote proving as private from its operator.
7. Expand templates and maximum lengths only with positive real-email vectors, adversarial fixtures and a new verifier/ceremony when the circuit changes. Add authenticated expiry (`x=`) policy rather than assuming every DKIM timestamp remains valid forever.
8. Audit the verifier, policy, escrow and ceremony independently. Add release pinning, production-scale indexing, finality/reorg handling and gas benchmarks.

## Restoration acceptance criteria

- Privacy is optional and clearly distinguished from direct on-chain DKIM submission.
- Fresh genuine GitHub receipts verify in the circuit and deployed contract; no mock verifier substitutes for this test.
- Tampering with RSA signature, subject, body, SHA state, payout wallet, bounty/chain reference, issue or PR fails cryptographically or in the authenticated on-chain policy.
- Claims route credit to the signed wallet, reject replay, preserve refund grace periods and conserve funds under failed/reentrant withdrawal attempts.
- Users can recover/cancel jobs and export/import validated public proofs. Private intermediate data is demonstrably cleaned.
- No original email, private token or proving-secret material is committed or published. Public artifacts have checked provenance and match the deployment.
- Documentation includes measured proving latency, peak memory, artifact size, disclosed fields and explicit remaining trust assumptions.

Existing evidence and commands are in `TESTING.md`, `VERIFICATION.md`, `PROTOCOL.md`, `OPERATIONS.md` and `GNOSIS.md` on this branch. The archived test suite contains 31 escrow/policy tests, 23 JavaScript checks, 24 controlled UI checks, real Anvil claim/refund flows, genuine-email circuit tampering tests, and opt-in mainnet acceptance tests.
