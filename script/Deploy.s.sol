// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {GithubDkimVerifier} from "../contracts/GithubDkimVerifier.sol";
import {MergeBounty} from "../contracts/MergeBounty.sol";
interface DeploymentVm { function startBroadcast() external; function stopBroadcast() external; }
contract Deploy {
    DeploymentVm private constant vm = DeploymentVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    function run() external returns (GithubDkimVerifier verifier, MergeBounty escrow) {
        require(block.chainid == 100, "Gnosis mainnet only");
        vm.startBroadcast();
        verifier = new GithubDkimVerifier(hex"9c9b39b2659faf700cf4b4537d348049b9ed704d70f07cca749a5ed762c6616d6ca61871ac588bc0f7f79d2e7d470372b51b420a5507d72a5a0e8640da048453e57aa623b6b4f2fc2666640fd7657ca4c483e44aacc40193dda272ca618909c7320472f35950aa34786fbc3f509326f6530530147315a25ecb0363002f061bf9");
        escrow = new MergeBounty(verifier);
        vm.stopBroadcast();
    }
}
