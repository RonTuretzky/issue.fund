# Historical deployment build records

There is one maintained escrow: `contracts/MergeBounty.sol`.
These frozen ABI, creation-bytecode and runtime-bytecode records exist only to
verify earlier immutable deployments and test access to their existing funds.
They are not alternative contracts to develop or publish as product versions.

Source snapshot: [commit 2c0d300d2c08](https://github.com/RonTuretzky/issue.fund/tree/2c0d300d2c08873b0ddc94798b2b2f26cab57c22/contracts).
Compiler settings remain recorded in that commit's `foundry.toml`.

- `MergeBounty.json`: original no-fee escrow.
- `MergeBountyV2.json`: historical explorer name for the fee-bearing escrow now maintained as `MergeBounty.sol`.
- `GithubDkimVerifier.json`: verifier build used by those deployments.

Runtime checks compare the full bytecode, including compiler metadata, after
masking only the compiler-declared immutable slots; the verifier/key and fee
parameters are then read independently. They never trust a manifest's address or
runtime hash alone. The artifact's `sourceCommit` and `sourcePath` locate the old
source for reproduction and explorer verification.

The receipt readability changes and escrow rename were checked to preserve
executable runtime instructions. Compiler metadata changes with source comments
and paths. Existing escrow addresses, balances, manifests and numeric bounty-link
mapping are preserved. Historical protocol labels remain stable for older clients.
