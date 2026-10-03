// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {RSA} from "./vendor/openzeppelin/RSA.sol";

/// OpenZeppelin-based RSA with a documented, unaudited 1024-bit allowance.
/// Only the GitHub key sizes accepted by GithubDkimVerifier are supported.
/// The exponent remains fixed at 65537 and the entire PKCS#1 encoding is checked.
library RsaSha256 {
    function verify(bytes32 digest, bytes memory signature, bytes memory modulus) internal view returns (bool) {
        if (modulus.length != 128 && modulus.length != 256) return false;
        return RSA.pkcs1Sha256(digest, signature, hex"010001", modulus);
    }
}
