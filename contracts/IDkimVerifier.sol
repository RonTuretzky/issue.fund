// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {ReceiptPolicy} from "./ReceiptPolicy.sol";
interface IDkimVerifier {
    struct Receipt { bytes headers; bytes body; bytes signature; }
    function keyHash() external view returns (bytes32);
    function verifyReceipt(Receipt calldata receipt) external view returns (ReceiptPolicy.Event memory);
}
