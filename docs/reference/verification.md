# How verification works

What RSA/DKIM authenticates, and what the escrow checks before paying.

[All documentation](../README.md) · [Read on the website](https://issue.fund/#docs/reference/verification)

## A signed statement from GitHub

DKIM is an email-signing standard. GitHub signs a canonical set of headers containing a hash of the canonical email body. RSA-SHA256 verification checks that those authenticated bytes have not changed and match the pinned GitHub public key.

This implementation verifies that signature directly on-chain. It does not use a zero-knowledge proof. The collector prepares and checks the signed bytes for automatic claims; the browser does the same for manual claims. The contract independently decides whether either submission can settle the bounty.


## Checks in the contract

1. Authenticate the complete signed header block with RSA and match the full body to its signed SHA-256 hash.
2. Require the supported GitHub domain, selector, canonicalization, timestamp and signed-subject layout. Partial-body signatures and ambiguous tags are rejected.
3. Parse the exact native merge and closure events. Check their GitHub issue_event footers, event identifiers and MIME boundaries, so a signed comment quoting an event is insufficient.
4. Match the repository, funded issue, closing PR, target branch, payout address and chain-specific bounty reference.
5. Check receipt timestamps, claim deadline and open status, then credit the authenticated wallet and consume the bounty.


## Why there is no account-ownership step

The rule is to pay the address designated in the authenticated merge-time PR title. It is not a claim that a wallet owns a GitHub username or wrote a particular commit. Anyone can relay the same receipts, but changing the payout address changes signed data and invalidates the claim.


## Where trust remains

GitHub remains the authority for the events it signs, and maintainers remain responsible for accepting the code. Blockchain validators execute the verifier and escrow. The relay signs the transaction that submits the receipts; it cannot authorize a payout that fails the contract’s checks. GitHub itself remains centralized.

The public key and verifier are fixed in this deployment. There is no administrator who can override the payout rule or replace a key. The automatic service can miss or delay a claim, but cannot change the wallet authenticated in the receipts. Read [Contracts and supported limits](https://issue.fund/#docs/reference/contracts) for the pinned-key, template and repository-identity limitations.

- [DKIM standard: RFC 6376](https://www.rfc-editor.org/rfc/rfc6376)
- [Protocol specification in the source repository](https://github.com/RonTuretzky/issue.fund/blob/codex/automation-production/PROTOCOL.md)
