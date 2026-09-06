# Verification record

The direct implementation was tested on September 6, 2026. It remains experimental and unaudited.

- 16 JavaScript tests passed for public GitHub validation and direct DKIM checks.
- 35 Foundry tests passed, including 128 randomized escrow-conservation cases.
- 23 interface/onboarding tests passed, including wallet rejection, public-only checks, final funding preflight, accessibility and mobile layout.
- The additional browser integration passed local signature checks → disclosure consent → actual RSA contract claim from a relayer → beneficiary withdrawal. No email-bearing request was sent during local checking.
- Full chain tests passed with independent synthetic RSA-1024 and RSA-2048 keys. They used the actual verifier, not a mock, and checked tampering, wrong bounty references, replay, unauthorized withdrawals and exact balances after gas.
- Two genuine original GitHub native notifications passed WebCrypto and the actual pinned-key verifier on local Anvil. The historical raw originals remained local.
- A real public GitHub issue passed anonymous discovery → final preflight → actual Anvil funding → expiry refund → withdrawal through the browser.
- The Gnosis direct verifier and escrow deployed successfully; runtime bytecode, immutable linkage and pinned modulus were checked against the build.

Synthetic local claims consumed approximately 2.90 million gas for two receipts; genuine notification gas depends on header/body size and must be estimated before submission. Local integration tests restore snapshots, so their transaction hashes are not persistent public-network records. Genuine email fixtures and private keys are not committed.

See `TESTING.md` for commands and `GNOSIS.md` for the deployed addresses. Legacy ZK test results belong to the archived branch and are not evidence for this replacement implementation.

The fresh **real Gnosis** acceptance test also passed: a public GitHub issue and PR generated two new genuine emails; the static browser checked them locally, the actual on-chain verifier settled the bounty, and the recipient withdrew 0.001 xDAI. All three transactions succeeded. See `deployments/gnosis/e2e.json` and the linked transaction records in `GNOSIS.md`. The legacy escrow's bounty #2 was separately confirmed still open with its original 0.001 xDAI.

Both deployed contract sources were verified on Gnosisscan. The genuine two-email claim used 9,283,775 gas; the successful public transaction is recorded above.
