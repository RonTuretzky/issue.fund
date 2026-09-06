// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {RsaSha256} from "./RsaSha256.sol";
import {ReceiptPolicy} from "./ReceiptPolicy.sol";
import {IDkimVerifier} from "./IDkimVerifier.sol";

/// Complete signed headers and body are public calldata. No circuit, prover,
/// setup, operator signature, or trusted caller is involved in verification.
contract GithubDkimVerifier is IDkimVerifier {
    bytes public modulus;
    bytes32 public immutable keyHash;
    error InvalidDkim();
    constructor(bytes memory n) {
        if ((n.length != 128 && n.length != 256) || uint8(n[0]) < 128 || uint8(n[n.length - 1]) % 2 != 1) revert InvalidDkim();
        modulus = n;
        keyHash = keccak256(n);
    }
    function verifyReceipt(Receipt calldata receipt) external view returns (ReceiptPolicy.Event memory) {
        if (receipt.headers.length == 0 || receipt.headers.length > 8192 || receipt.body.length > 65536) revert InvalidDkim();
        bytes memory headers = receipt.headers;
        (bytes memory subject, bytes memory tags, bytes memory names) = parseHeaders(headers);
        (uint256 issuedAt, uint256 expiresAt) = parseTags(tags, sha256(receipt.body), names);
        if (expiresAt != 0 && (expiresAt <= issuedAt || block.timestamp > expiresAt)) revert InvalidDkim();
        if (!RsaSha256.verify(sha256(headers), receipt.signature, modulus)) revert InvalidDkim();
        return ReceiptPolicy.decode(subject, receipt.body, issuedAt);
    }
    function parseHeaders(bytes memory h) private pure returns (bytes memory subject, bytes memory tags, bytes memory names) {
        uint256 p;
        bool found;
        while (p < h.length) {
            uint256 colon = p;
            while (colon < h.length && h[colon] != 0x3a) {
                uint8 c = uint8(h[colon]);
                if (!((c >= 97 && c <= 122) || (c >= 48 && c <= 57) || c == 45)) revert InvalidDkim();
                colon++;
            }
            if (colon == p || colon == h.length) revert InvalidDkim();
            bytes memory name = slice(h, p, colon);
            uint256 end = colon + 1;
            while (end < h.length && h[end] != 0x0d) {
                if (uint8(h[end]) < 32 || uint8(h[end]) > 126) revert InvalidDkim();
                end++;
            }
            if (keccak256(name) == keccak256("dkim-signature")) {
                if (end != h.length) revert InvalidDkim();
                tags = slice(h, colon + 1, end);
                break;
            }
            if (end + 1 >= h.length || h[end + 1] != 0x0a) revert InvalidDkim();
            names = abi.encodePacked(names, name, ":");
            if (keccak256(name) == keccak256("subject")) {
                if (found) revert InvalidDkim();
                subject = abi.encodePacked("\r\n", slice(h, p, end + 2));
                found = true;
            }
            p = end + 2;
        }
        if (!found || tags.length == 0) revert InvalidDkim();
    }
    function parseTags(bytes memory tags, bytes32 bodyHash, bytes memory names) private pure returns (uint256 issuedAt, uint256 expiresAt) {
        uint256 seen;
        uint256 p;
        while (p < tags.length) {
            while (p < tags.length && tags[p] == 0x20) p++;
            uint256 end = p;
            while (end < tags.length && tags[end] != 0x3b) end++;
            uint256 eq = p;
            while (eq < end && tags[eq] != 0x3d) eq++;
            if (eq == end) revert InvalidDkim();
            bytes memory name = trim(slice(tags, p, eq));
            bytes memory value = trim(slice(tags, eq + 1, end));
            bytes32 id = keccak256(name);
            uint256 bit;
            if (id == keccak256("v")) { bit = 1; requireEqual(value, bytes("1")); }
            else if (id == keccak256("a")) { bit = 2; requireEqual(value, bytes("rsa-sha256")); }
            else if (id == keccak256("c")) { bit = 4; requireEqual(value, bytes("relaxed/relaxed")); }
            else if (id == keccak256("d")) { bit = 8; requireEqual(value, bytes("github.com")); }
            else if (id == keccak256("s")) { bit = 16; requireEqual(value, bytes("pf2023")); }
            else if (id == keccak256("t")) { bit = 32; issuedAt = decimal(value); }
            else if (id == keccak256("bh")) { bit = 64; requireEqual(value, bytes(Base64.encode(abi.encodePacked(bodyHash)))); }
            else if (id == keccak256("h")) { bit = 128; checkHeaderList(value, names); }
            else if (id == keccak256("b")) { bit = 256; if (value.length != 0 || end != tags.length) revert InvalidDkim(); }
            else if (id == keccak256("x")) { bit = 512; expiresAt = decimal(value); }
            else if (id == keccak256("q")) { bit = 1024; requireEqual(value, bytes("dns/txt")); }
            else if (id == keccak256("i")) { bit = 2048; requireEqual(value, bytes("@github.com")); }
            else revert InvalidDkim(); // Includes l= and unknown semantics.
            if (seen & bit != 0) revert InvalidDkim();
            seen |= bit;
            p = end + 1;
        }
        if (seen & 511 != 511) revert InvalidDkim();
    }
    function checkHeaderList(bytes memory value, bytes memory names) private pure {
        bytes memory list;
        for (uint256 i; i < value.length; i++) {
            uint8 c = uint8(value[i]);
            if (c == 32) continue;
            if (c >= 65 && c <= 90) c += 32;
            if (!((c >= 97 && c <= 122) || (c >= 48 && c <= 57) || c == 45 || c == 58)) revert InvalidDkim();
            list = abi.encodePacked(list, bytes1(c));
        }
        list = abi.encodePacked(list, ":");
        uint256 p;
        for (uint256 i; i < list.length;) {
            uint256 end = i;
            while (end < list.length && list[end] != 0x3a) end++;
            if (end == i) revert InvalidDkim();
            uint256 next = p;
            while (next < names.length && names[next] != 0x3a) next++;
            // h= may oversign missing occurrences (GitHub repeats From).
            if (p < names.length && keccak256(slice(list, i, end)) == keccak256(slice(names, p, next))) p = next + 1;
            i = end + 1;
        }
        if (p != names.length) revert InvalidDkim();
    }
    function decimal(bytes memory s) private pure returns (uint256 n) {
        if (s.length == 0 || s.length > 12 || s[0] == 0x30) revert InvalidDkim();
        for (uint256 i; i < s.length; i++) { uint8 c = uint8(s[i]); if (c < 48 || c > 57) revert InvalidDkim(); n = n * 10 + c - 48; }
    }
    function requireEqual(bytes memory a, bytes memory b) private pure { if (keccak256(a) != keccak256(b)) revert InvalidDkim(); }
    function trim(bytes memory s) private pure returns (bytes memory) { uint256 a; uint256 b = s.length; while (a < b && s[a] == 0x20) a++; while (b > a && s[b - 1] == 0x20) b--; return slice(s, a, b); }
    function slice(bytes memory s, uint256 a, uint256 b) private pure returns (bytes memory out) {
        if (b < a || b > s.length) revert InvalidDkim();
        out = new bytes(b - a); for (uint256 i; i < out.length; i++) out[i] = s[a + i];
    }
}
