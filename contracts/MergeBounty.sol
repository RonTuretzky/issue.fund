// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ReceiptPolicy} from "./ReceiptPolicy.sol";

import {IDkimVerifier} from "./IDkimVerifier.sol";

/// Native-ETH issue escrow. No administrator, upgrades, replacement verifier,
/// key updates, fee recipient, or discretionary withdrawal of active bounties.
contract MergeBounty is ReentrancyGuard {
    enum Status {
        Open,
        Paid,
        Refunded
    }

    struct Bounty {
        address funder;
        uint256 amount;
        uint64 createdAt;
        uint64 deadline;
        uint64 issue;
        Status status;
        address recipient;
        uint64 pr;
        string repo;
        string branch;
    }

    IDkimVerifier public immutable verifier;
    bytes32 public immutable githubKeyHash;
    uint256 public constant CLAIM_GRACE = 7 days;
    uint256 public nextId = 1;
    mapping(uint256 => Bounty) private bounties;
    mapping(address => uint256) public credits;
    event Funded(
        uint256 indexed id,
        address indexed funder,
        bytes32 bountyRef,
        string repo,
        uint64 issue,
        uint256 amount,
        uint64 deadline
    );
    event Paid(uint256 indexed id, address indexed recipient, uint256 amount, uint64 pr);
    event Refunded(uint256 indexed id, address indexed funder, uint256 amount);
    event Withdrawn(address indexed owner, address indexed destination, uint256 amount);
    error InvalidInput();
    error InvalidReceipt();
    error NotOpen();
    error TooLate();
    error TooEarly();
    error Unauthorized();
    error NothingToWithdraw();
    error TransferFailed();

    constructor(IDkimVerifier v) {
        if (address(v).code.length == 0 || v.keyHash() == bytes32(0)) revert InvalidInput();
        verifier = v;
        githubKeyHash = v.keyHash();
    }

    function getBounty(uint256 id) external view returns (Bounty memory) {
        if (id == 0 || id >= nextId) revert InvalidInput();
        return bounties[id];
    }

    function referenceFor(uint256 id) public view returns (bytes32) {
        return keccak256(abi.encode(block.chainid, address(this), id));
    }

    function create(string calldata repo, uint64 issue, string calldata branch, uint64 deadline)
        external
        payable
        returns (uint256 id)
    {
        if (
            msg.value == 0 || issue == 0 || deadline < block.timestamp + 10 minutes
                || deadline > block.timestamp + 365 days
        ) {
            revert InvalidInput();
        }
        validateRepo(repo);
        validateBranch(branch);
        id = nextId++;
        bounties[id] =
            Bounty(
            msg.sender, msg.value, uint64(block.timestamp), deadline, issue, Status.Open, address(0), 0, repo, branch
        );
        emit Funded(id, msg.sender, referenceFor(id), repo, issue, msg.value, deadline);
    }

    function claim(uint256 id, IDkimVerifier.Receipt calldata merged, IDkimVerifier.Receipt calldata closed) external nonReentrant {
        Bounty storage bounty = bounties[id];
        if (bounty.funder == address(0)) revert InvalidInput();
        if (bounty.status != Status.Open) revert NotOpen();
        if (block.timestamp > uint256(bounty.deadline) + CLAIM_GRACE) revert TooLate();
        ReceiptPolicy.Event memory m = verifier.verifyReceipt(merged);
        ReceiptPolicy.Event memory c = verifier.verifyReceipt(closed);
        if (
            !m.merged || c.merged || m.pr != c.pr || c.number != bounty.issue || m.pr > type(uint64).max
                || m.bountyRef != referenceFor(id)
        ) revert InvalidReceipt();
        if (
            keccak256(bytes(m.repo)) != keccak256(bytes(bounty.repo))
                || keccak256(bytes(c.repo)) != keccak256(bytes(bounty.repo))
                || keccak256(bytes(m.branch)) != keccak256(bytes(bounty.branch))
        ) revert InvalidReceipt();
        if (
            m.issuedAt < bounty.createdAt || c.issuedAt < bounty.createdAt || m.issuedAt > bounty.deadline
                || c.issuedAt > bounty.deadline || m.issuedAt > block.timestamp || c.issuedAt > block.timestamp
        ) revert InvalidReceipt();
        bounty.status = Status.Paid;
        bounty.recipient = m.wallet;
        bounty.pr = uint64(m.pr);
        credits[m.wallet] += bounty.amount;
        emit Paid(id, m.wallet, bounty.amount, uint64(m.pr));
    }

    function refund(uint256 id) external nonReentrant {
        Bounty storage b = bounties[id];
        if (b.funder != msg.sender) revert Unauthorized();
        if (b.status != Status.Open) revert NotOpen();
        if (block.timestamp <= uint256(b.deadline) + CLAIM_GRACE) revert TooEarly();
        b.status = Status.Refunded;
        credits[b.funder] += b.amount;
        emit Refunded(id, b.funder, b.amount);
    }

    // Pull payment ensures a beneficiary contract cannot block settlement.
    // Only the credited wallet can choose another withdrawal destination.
    function withdraw(address payable destination) external nonReentrant {
        if (destination == address(0)) revert InvalidInput();
        uint256 amount = credits[msg.sender];
        if (amount == 0) revert NothingToWithdraw();
        credits[msg.sender] = 0;
        (bool ok,) = destination.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit Withdrawn(msg.sender, destination, amount);
    }

    function validateRepo(string calldata value) private pure {
        bytes memory s = bytes(value);
        if (s.length < 3 || s.length > 140) revert InvalidInput();
        uint256 slashes;
        for (uint256 i; i < s.length; i++) {
            uint8 c = uint8(s[i]);
            if (c == 47) {
                slashes++;
                if (i == 0 || i == s.length - 1) {
                    revert InvalidInput();
                }
            } else if (!((c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c == 45 || c == 95 || c == 46)) {
                revert InvalidInput();
            }
        }
        if (slashes != 1) revert InvalidInput();
    }

    function validateBranch(string calldata value) private pure {
        bytes memory s = bytes(value);
        if (s.length == 0 || s.length > 64) revert InvalidInput();
        for (uint256 i; i < s.length; i++) {
            uint8 c = uint8(s[i]);
            if (!((c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c == 45 || c == 95 || c == 46
                        || c == 47)) revert InvalidInput();
        }
    }
}
