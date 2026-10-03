# OpenZeppelin RSA candidate for issue.fund

This is the maintained RSA candidate used by the current issue.fund deployment.

The upstream library rejects GitHub's current `pf2023` 1024-bit key. This applies to newly generated notifications; dropping old deployments or receipts does not resolve it. DNS was rechecked on 2026-09-14: 1024 bits, exponent 65537.

## Provenance and exact changes

- Source: https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.6.1/contracts/utils/cryptography/RSA.sol
- Upstream SHA-256: `036c1fab2a132d7acb7fa0873812f2ad22c873d2efc91032b8ac7a1fda5ff476`
- Upstream audit: https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/audits/2024-10-v5.1.pdf
- License: MIT; retain the source attribution and [upstream license](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.6.1/LICENSE).
- Full patch: [upstream.diff](upstream.diff).

The only executable algorithm change is the minimum length: `length < 0x100` becomes `length < 0x80`. The import path is relocated and comments identify the exception. The wrapper restricts keys to 128/256 bytes and the exponent to 65537, as before. Full padding, algorithm identifier, digest and signature-range validation remain in place. Both standards-compliant explicit and implicit NULL encodings are accepted by the upstream parser.

**This is adapted audited code, not an unchanged audited library. The 1024-bit exception and issue.fund integration have not been independently audited.** GitHub controls the signing key; we cannot rotate it ourselves. No zero-padding workaround is used. This remains RSA-1024 verification when processing current GitHub mail.

## Validation

`forge test --summary` exercises the candidate with the existing DKIM/escrow tests and RSA conformance tests. The added tests cover valid 1024/2048 signatures, malformed padding, prefix, separator, algorithm identifier, digest, trailing bytes, invalid lengths, signature equal to modulus, and mutated signatures. They demonstrate that unchanged OpenZeppelin rejects a valid 1024-bit signature and compare the candidate with upstream on 2048-bit inputs. All signing keys are synthetic; private components are generated in memory and discarded.

Verified on 2026-09-18: 59 Solidity tests and 25 JavaScript tests passed. Fresh local deployments completed create, permissionless claim, fee credit, replay rejection and withdrawal for both 1024-bit and 2048-bit synthetic keys. The candidate also verified both saved original GitHub merge/closure notifications on an isolated local chain; raw emails were not transmitted to a public RPC. These are local results, not an independent audit. The vendored baseline was byte-compared with the upstream GitHub source. Full CI, static Pages deployment and browser documentation smoke tests passed.

## Deployment decision

A fresh verifier and escrow were deployed on Gnosis on September 18, 2026 because verifier and escrow addresses are immutable. The current addresses are [GithubDkimVerifier `0x4A9359D2925F5aA0cD1aa5fFA09d5a980c1Ca006`](https://gnosisscan.io/address/0x4A9359D2925F5aA0cD1aa5fFA09d5a980c1Ca006?tab=contract) and [MergeBounty `0x5B1Ace7B8f447183F1C7572F5e4A76c0791Ec38C`](https://gnosisscan.io/address/0x5B1Ace7B8f447183F1C7572F5e4A76c0791Ec38C?tab=contract). Source verification succeeded for both. Existing bounties remain in their original immutable escrows; no compatibility migration is required by the user. Switching this primitive does not independently audit our GitHub receipt parsing or bounty settlement policy, and this branch does not substitute a different escrow protocol.
