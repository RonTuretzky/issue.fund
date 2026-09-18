// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {RsaSha256} from "../RsaSha256.sol";
import {RSA as UpstreamRSA} from "@openzeppelin/contracts/utils/cryptography/RSA.sol";

interface RsaVm {
    function readFile(string calldata) external view returns (string memory);
    function parseJsonBytes(string calldata, string calldata) external pure returns (bytes memory);
}

contract RsaCompatibilityTest {
    RsaVm constant vm = RsaVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    string vectors;
    function setUp() public { vectors = vm.readFile("tests/fixtures/rsa-compatibility.json"); }
    function value(string memory size, string memory name) internal view returns(bytes memory) {
        return vm.parseJsonBytes(vectors, string.concat(".", size, ".", name));
    }
    function check(string memory size) internal view {
        bytes memory modulus = value(size, "modulus");
        bytes32 digest = bytes32(value(size, "digest"));
        bytes memory valid = value(size, "valid");
        require(RsaSha256.verify(digest, valid, modulus), "valid explicit NULL rejected");
        require(RsaSha256.verify(digest, value(size, "implicitNull"), modulus), "valid implicit NULL rejected");
        string[6] memory malformed = ["badPrefix", "badPadding", "badSeparator", "badAlgorithm", "badDigest", "trailingData"];
        for(uint256 i; i < malformed.length; ++i) {
            require(!RsaSha256.verify(digest, value(size, malformed[i]), modulus), malformed[i]);
        }
        require(!RsaSha256.verify(digest, modulus, modulus), "signature == modulus accepted");
        require(!RsaSha256.verify(digest, new bytes(modulus.length - 1), modulus), "short signature accepted");
        require(!RsaSha256.verify(digest, abi.encodePacked(bytes1(0), valid), modulus), "long signature accepted");
        require(!RsaSha256.verify(digest ^ bytes32(uint256(1)), valid, modulus), "wrong digest accepted");
    }
    function test1024Conformance() public view { check("bits1024"); }
    function test2048Conformance() public view { check("bits2048"); }
    function testUnchangedOpenZeppelinRejects1024() public view {
        require(!UpstreamRSA.pkcs1Sha256(bytes32(value("bits1024", "digest")), value("bits1024", "valid"), hex"010001", value("bits1024", "modulus")));
    }
    function test2048MatchesUnchangedOpenZeppelin() public view {
        string[8] memory names = ["valid", "implicitNull", "badPrefix", "badPadding", "badSeparator", "badAlgorithm", "badDigest", "trailingData"];
        bytes memory modulus = value("bits2048", "modulus");
        bytes32 digest = bytes32(value("bits2048", "digest"));
        for(uint256 i; i < names.length; ++i) {
            bytes memory sig = value("bits2048", names[i]);
            require(RsaSha256.verify(digest, sig, modulus) == UpstreamRSA.pkcs1Sha256(digest, sig, hex"010001", modulus));
        }
    }
    function testFuzzMutatedSignatureFails(uint8 position, uint8 mask) public view {
        bytes memory sig = value("bits1024", "valid");
        sig[uint256(position) % sig.length] ^= bytes1(mask == 0 ? uint8(1) : mask);
        require(!RsaSha256.verify(bytes32(value("bits1024", "digest")), sig, value("bits1024", "modulus")));
    }
}
