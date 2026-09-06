// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Groth16Verifier} from "../contracts/ReceiptVerifier.sol";
import {MergeBounty, IReceiptVerifier} from "../contracts/MergeBounty.sol";

interface DeploymentVm {
    function startBroadcast() external;
    function stopBroadcast() external;
}

/// The same script is used locally and by the pinned Etherform workflow.
contract Deploy {
    DeploymentVm private constant vm = DeploymentVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    uint256 private constant GITHUB_KEY =
        18769159890606851885526203517158331386071551795170342791119488780143683832216;

    function run() external returns (Groth16Verifier verifier, MergeBounty escrow) {
        require(block.chainid == 100, "Gnosis mainnet only");
        vm.startBroadcast();
        verifier = new Groth16Verifier();
        escrow = new MergeBounty(IReceiptVerifier(address(verifier)), GITHUB_KEY);
        vm.stopBroadcast();
    }
}
