# Audited components

Audited reuse options, compatibility limits, and what still needs an issue.fund audit.

[All documentation](../README.md) · [Read on the website](https://issue.fund/#docs/reference/audited-components)

## What is audited today

issue.fund’s own verifier, receipt policy and escrow have not had an independent security audit. Importing audited utilities does not extend their audit to our integration or payment rules. This review checked upstream source and published audit reports on September 14, 2026.

The project already pins OpenZeppelin Contracts 5.6.1 and uses its math, encoding, reentrancy protection and ownership utilities. Direct GitHub RSA verification and event parsing remain application code.


## RSA-SHA256: OpenZeppelin has a key-size blocker

OpenZeppelin’s RSA.sol was included in its Contracts 5.1 audit. It verifies RSA PKCS#1 v1.5 signatures with SHA-256 and checks the signature padding. Its pkcs1Sha256 function is available through the dependency already installed here.

It requires at least 2048-bit signatures and moduli. A fresh DNS check found GitHub’s pf2023 key is still 1024 bits, exponent 65537, and matches our pinned key. An unchanged import therefore rejects our supported GitHub receipts. Removing the minimum-size check creates a modified implementation whose difference needs review; adding leading zeroes does not make the key stronger.

Recommendation: keep the narrow compatibility implementation until its RSA-1024 behavior is independently reviewed, or adopt the unmodified OpenZeppelin verifier when a supported GitHub signing key meets its requirement. Neither changing libraries nor tests can make GitHub’s current key 2048-bit.

- [OpenZeppelin RSA.sol at the installed 5.6.1 release](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.6.1/contracts/utils/cryptography/RSA.sol)
- [OpenZeppelin Contracts 5.1 audit, including RSA.sol](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/audits/2024-10-v5.1.pdf)

## Direct DKIM: Ambire is a reference, not a drop-in replacement

Ambire’s DKIMRecoverySigValidator was in Pashov’s second security review, with reviewed fixes at commit 20aae8ec666d1341dc1462962ea2ac50bf2edd6f. It implements wallet recovery, not GitHub issue completion. Its reviewed header logic and recovery assumptions do not establish our receipt policy.

The current Ambire RSASHA256 helper examined here compares only the final recovered hash; it does not check the complete PKCS#1 padding. Our implementation checks the whole encoded block. The audit’s named scope lists the account and DKIM recovery validator, so it is not evidence of a standalone audit of that RSA helper. It is not a suitable replacement for our strict RSA check.

ENS published a separate advisory about missing RSA padding validation in its DNSSEC implementation and linked a fix. That is a reason to examine exact code and patches, not evidence that the same attack works against GitHub’s exponent-65537 key.

- [Ambire DKIM security review and scope](https://github.com/AmbireTech/ambire-common/blob/v2/audits/Pashov-Ambire-second-security-review.md)
- [Ambire RSA-SHA256 helper examined](https://github.com/AmbireTech/ambire-common/blob/v2/contracts/dkim/RSASHA256.sol)
- [ENS padding-validation advisory and patch](https://github.com/ensdomains/ens-contracts/security/advisories/GHSA-c6rr-7pmc-73wc)

## UniPass also has direct DKIM and published audits

UniPass publishes BlockSec and Salus wallet-contract audits. BlockSec’s final listed review commit is b5de524eabc036522a2f47349b88836bd7376c5c. The DkimKeys contract has a direct RSA path with exponent 65537, but it also brings wallet-specific parsing, an administrator-managed key registry and upgradeability.

Its LibRsa.rsapkcs1Verify implementation, including at that reviewed commit, only compares the recovered hash suffix. Despite the function name, it does not validate the full PKCS#1 encoding. It is another audited-system reference whose RSA helper does not meet our full-padding requirement. This is a source-level compatibility assessment, not a demonstrated exploit against the UniPass wallet.

- [UniPass BlockSec audit and reviewed commits](https://github.com/UniPassID/UniPass-Wallet-Contract/blob/main/audits/blocksec_unipass_wallet_signed_v2.1.pdf)
- [UniPass RSA helper at the reviewed commit](https://github.com/UniPassID/UniPass-Wallet-Contract/blob/b5de524eabc036522a2f47349b88836bd7376c5c/contracts/utils/LibRsa.sol)
- [UniPass direct DKIM implementation](https://github.com/UniPassID/UniPass-Wallet-Contract/blob/main/contracts/DkimKeys.sol)

## ZK Email has audits, but uses a different verification path

ZK Email publishes audits of its circuits and email-authentication contracts. The RSA/DKIM work is proven off-chain and checked using a proof on-chain. A DKIM key registry alone is not an email signature verifier.

This is a candidate if the project later reintroduces proving. A server could generate proofs without making contributors run a prover, but that would still change our current direct-verification architecture. It has not been imported here.

- [ZK Email audits and reviewed releases](https://docs.zk.email/audits)

## Audited bounty escrows exist, with different approval rules

Neither is an unchanged replacement for permissionless, two-email settlement. For this payment rule, retaining one small escrow built from audited utilities leaves a more focused integration to audit than adopting committee, governance or issuer powers that the product does not need. This is an architectural recommendation, not an independent audit finding.

| Candidate | Audit evidence | Fit for issue.fund |
| --- | --- | --- |
| StandardBounties | MixBytes reviewed e79d844; its report links fixes at 7c7dfc6, including a critical double-refund fix. | Supports ETH and tokens, but approvers accept submissions and issuers have editing/draining powers. A receipt-verifying adapter would have to control those roles and still needs audit. |
| Hats Finance | G0’s February 2023 report includes HATVault and HATVaultsRegistry at 95ff820. This does not audit every later change. | Built for security bounties with committee approval and dispute handling. Substituting our automatic GitHub rule requires additional integration and review. |

- [MixBytes StandardBounties report and fixes](https://github.com/mixbytes/audits_public/blob/master/Aragon/Open%20Enterprise/StandardBounties.md)
- [StandardBounties role and payout documentation](https://github.com/ConsenSys/StandardBounties)
- [Hats G0 audit, February 2023](https://github.com/hats-finance/hats-contracts/blob/develop/audit/202302-g0-group-audit.pdf)
- [Hats protocol and committee model](https://github.com/hats-finance/hats-contracts)

## One maintained escrow

The maintained source is contracts/MergeBounty.sol. It includes the fixed success fee and changeable fee recipient. New work and deployment scripts use that implementation.

Existing contracts are immutable. Their addresses, terms and withdrawal balances remain available through historical deployment manifests. Frozen build artifacts are kept solely for exact runtime verification and compatibility tests. Historical wire-format identifiers and explorer contract names remain in those records; they are not alternative product versions.

The receipt-policy clarity changes preserve executable runtime instructions. This source cleanup does not migrate funds, change the live payment rule or imply a new on-chain deployment.

- [Maintained escrow source](https://github.com/RonTuretzky/issue.fund/blob/codex/automation-production/contracts/MergeBounty.sol)
