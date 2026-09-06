// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// Strict RFC 8017 EMSA-PKCS1-v1_5 with SHA-256 and explicit NULL DigestInfo.
/// GitHub's pinned pf2023 key is 1024 bits, below OpenZeppelin RSA's minimum.
/// This narrow verifier deliberately supports that existing key; it does not
/// claim 2048-bit security. Exponent is fixed at 65537, padding checked in full.
library RsaSha256 {
    function verify(bytes32 digest, bytes memory signature, bytes memory modulus) internal view returns (bool) {
        uint256 n = modulus.length;
        if ((n != 128 && n != 256) || signature.length != n) return false;
        bool smaller;
        for (uint256 i; i < n; i++) {
            if (signature[i] < modulus[i]) { smaller = true; break; }
            if (signature[i] > modulus[i]) return false;
        }
        if (!smaller) return false;
        bytes memory expected = new bytes(n);
        expected[1] = 0x01;
        uint256 paddingEnd = n - 52;
        for (uint256 i = 2; i < paddingEnd; i++) expected[i] = 0xff;
        bytes memory tail = abi.encodePacked(hex"003031300d060960864801650304020105000420", digest);
        for (uint256 i; i < tail.length; i++) expected[paddingEnd + i] = tail[i];
        return keccak256(Math.modExp(signature, hex"010001", modulus)) == keccak256(expected);
    }
}
