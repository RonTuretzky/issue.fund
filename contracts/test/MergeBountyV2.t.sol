// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {MergeBountyV2} from "../MergeBountyV2.sol";
import {IDkimVerifier} from "../IDkimVerifier.sol";
import {ReceiptPolicy} from "../ReceiptPolicy.sol";
import {Vm, UnitVerifier, RejectEther} from "./MergeBounty.t.sol";

contract V2ReentrantRecipient {
    MergeBountyV2 immutable escrow;
    bool public blocked;

    constructor(MergeBountyV2 e) {
        escrow = e;
    }

    function pull() external {
        escrow.withdraw(payable(address(this)));
    }

    receive() external payable {
        try escrow.withdraw(payable(address(this))) {
            revert("reentered");
        }
            catch {
            blocked = true;
        }
    }
}

contract MergeBountyV2Test {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    MergeBountyV2 escrow;
    address constant CONTRIBUTOR = address(0x1234);
    address constant TREASURY = address(0x5678);
    address constant RELAYER = address(0x8888);
    uint64 constant START = 1809700000;
    uint64 constant DEADLINE = START + 1 days;
    receive() external payable {}

    function setUp() public {
        vm.warp(START);
        vm.deal(address(this), 100 ether);
        escrow = new MergeBountyV2(new UnitVerifier(), TREASURY, 100);
        escrow.create{value: 1 ether}("owner/repo", 1, "main", DEADLINE);
    }

    function events(uint256 id, address recipient)
        internal
        view
        returns (IDkimVerifier.Receipt memory m, IDkimVerifier.Receipt memory c)
    {
        m = IDkimVerifier.Receipt(
            abi.encode(
                ReceiptPolicy.Event(
                    "owner/repo",
                    2,
                    2,
                    recipient,
                    keccak256(abi.encode(block.chainid, address(escrow), id)),
                    START,
                    "main",
                    true
                )
            ),
            "",
            ""
        );
        c = IDkimVerifier.Receipt(
            abi.encode(ReceiptPolicy.Event("owner/repo", 1, 2, address(0), bytes32(0), START, "", false)), "", ""
        );
    }

    function settle(uint256 id, address recipient) internal {
        (IDkimVerifier.Receipt memory m, IDkimVerifier.Receipt memory c) = events(id, recipient);
        escrow.claim(id, m, c);
    }

    function testPermissionlessClaimCreditsNetAndTreasuryOnce() public {
        vm.prank(RELAYER);
        settle(1, CONTRIBUTOR);
        require(escrow.credits(CONTRIBUTOR) == 0.99 ether);
        require(escrow.credits(TREASURY) == 0.01 ether);
        require(escrow.credits(RELAYER) == 0);
        require(escrow.getBounty(1).amount == 1 ether);
        vm.expectRevert(MergeBountyV2.NotOpen.selector);
        settle(1, CONTRIBUTOR);
        require(escrow.credits(TREASURY) == 0.01 ether);
    }

    function testBothCreditOwnersCanWithdraw() public {
        settle(1, CONTRIBUTOR);
        vm.prank(CONTRIBUTOR);
        escrow.withdraw(payable(CONTRIBUTOR));
        vm.prank(TREASURY);
        escrow.withdraw(payable(TREASURY));
        require(CONTRIBUTOR.balance == 0.99 ether && TREASURY.balance == 0.01 ether);
        require(address(escrow).balance == 0);
    }

    function testTreasuryCannotWithdrawOpenBounty() public {
        vm.expectRevert(MergeBountyV2.NothingToWithdraw.selector);
        vm.prank(TREASURY);
        escrow.withdraw(payable(TREASURY));
        require(address(escrow).balance == 1 ether);
    }

    function testFeeRecipientCanBeContributor() public {
        settle(1, TREASURY);
        require(escrow.credits(TREASURY) == 1 ether);
    }

    function testInvalidClaimLeavesNoFeeOrStateChange() public {
        (IDkimVerifier.Receipt memory m, IDkimVerifier.Receipt memory c) = events(2, CONTRIBUTOR);
        vm.expectRevert(MergeBountyV2.InvalidReceipt.selector);
        escrow.claim(1, m, c);
        require(escrow.credits(TREASURY) == 0 && escrow.credits(CONTRIBUTOR) == 0);
        require(escrow.getBounty(1).status == MergeBountyV2.Status.Open);
    }

    function testCannotCreditZeroOrEscrowItself() public {
        vm.expectRevert(MergeBountyV2.InvalidReceipt.selector);
        settle(1, address(0));
        vm.expectRevert(MergeBountyV2.InvalidReceipt.selector);
        settle(1, address(escrow));
    }

    function testFullRefundHasNoFee() public {
        vm.warp(DEADLINE + 7 days + 1);
        escrow.refund(1);
        require(escrow.credits(address(this)) == 1 ether && escrow.credits(TREASURY) == 0);
        vm.expectRevert(MergeBountyV2.NotOpen.selector);
        settle(1, CONTRIBUTOR);
        escrow.withdraw(payable(address(this)));
        require(address(escrow).balance == 0);
    }

    function testClaimRefundBoundaryHasNoOverlap() public {
        vm.warp(DEADLINE + 7 days);
        vm.expectRevert(MergeBountyV2.TooEarly.selector);
        escrow.refund(1);
        settle(1, CONTRIBUTOR);
        vm.warp(DEADLINE + 7 days + 1);
        vm.expectRevert(MergeBountyV2.NotOpen.selector);
        escrow.refund(1);
    }

    function testExpiredClaimDoesNotEarnFee() public {
        vm.warp(DEADLINE + 7 days + 1);
        vm.expectRevert(MergeBountyV2.TooLate.selector);
        settle(1, CONTRIBUTOR);
        require(escrow.credits(TREASURY) == 0);
    }

    function testRejectingTreasuryCannotBlockClaim() public {
        RejectEther reject = new RejectEther();
        escrow = new MergeBountyV2(new UnitVerifier(), address(reject), 100);
        escrow.create{value: 1 ether}("owner/repo", 1, "main", DEADLINE);
        settle(1, CONTRIBUTOR);
        require(escrow.credits(CONTRIBUTOR) == 0.99 ether);
        vm.expectRevert(MergeBountyV2.TransferFailed.selector);
        vm.prank(address(reject));
        escrow.withdraw(payable(address(reject)));
        require(escrow.credits(address(reject)) == 0.01 ether);
        vm.prank(address(reject));
        escrow.withdraw(payable(TREASURY));
        require(TREASURY.balance == 0.01 ether);
    }

    function testReentrantWithdrawalCannotDrainOtherCredits() public {
        V2ReentrantRecipient recipient = new V2ReentrantRecipient(escrow);
        settle(1, address(recipient));
        recipient.pull();
        require(recipient.blocked() && address(recipient).balance == 0.99 ether);
        require(address(escrow).balance == 0.01 ether && escrow.credits(TREASURY) == 0.01 ether);
    }

    function testInvalidFeeConfiguration() public {
        UnitVerifier verifier = new UnitVerifier();
        vm.expectRevert(MergeBountyV2.InvalidInput.selector);
        new MergeBountyV2(verifier, address(0), 100);
        vm.expectRevert(MergeBountyV2.InvalidInput.selector);
        new MergeBountyV2(verifier, TREASURY, 501);
        vm.expectRevert(MergeBountyV2.InvalidInput.selector);
        new MergeBountyV2(IDkimVerifier(address(0)), TREASURY, 100);
    }

    function testZeroFeeAndTinyRewards() public {
        escrow = new MergeBountyV2(new UnitVerifier(), TREASURY, 0);
        escrow.create{value: 1 ether}("owner/repo", 1, "main", DEADLINE);
        settle(1, CONTRIBUTOR);
        require(escrow.credits(CONTRIBUTOR) == 1 ether && escrow.credits(TREASURY) == 0);
        escrow = new MergeBountyV2(new UnitVerifier(), TREASURY, 100);
        escrow.create{value: 99}("owner/repo", 1, "main", DEADLINE);
        settle(1, CONTRIBUTOR);
        require(escrow.credits(CONTRIBUTOR) == 99 && escrow.credits(TREASURY) == 0);
    }

    function testQuoteDoesNotOverflow() public view {
        (uint256 net, uint256 fee) = escrow.quoteClaim(type(uint256).max);
        require(net + fee == type(uint256).max);
        require(fee == type(uint256).max / 100);
    }

    function testFuzzConservationWithRefundAndFee(uint96 gross, uint16 bps) public {
        uint256 amount = uint256(gross) % 10 ether + 1;
        uint256 feeRate = uint256(bps) % 501;
        escrow = new MergeBountyV2(new UnitVerifier(), TREASURY, feeRate);
        escrow.create{value: amount}("owner/repo", 1, "main", DEADLINE);
        escrow.create{value: amount}("owner/repo", 1, "main", DEADLINE);
        settle(1, CONTRIBUTOR);
        require(escrow.credits(CONTRIBUTOR) + escrow.credits(TREASURY) == amount);
        require(escrow.credits(TREASURY) == amount * feeRate / 10_000);
        vm.warp(DEADLINE + 7 days + 1);
        escrow.refund(2);
        require(
            address(escrow).balance
                == escrow.credits(CONTRIBUTOR) + escrow.credits(TREASURY) + escrow.credits(address(this))
        );
        vm.prank(CONTRIBUTOR);
        escrow.withdraw(payable(CONTRIBUTOR));
        if (escrow.credits(TREASURY) > 0) {
            vm.prank(TREASURY);
            escrow.withdraw(payable(TREASURY));
        }
        escrow.withdraw(payable(address(this)));
        require(address(escrow).balance == 0);
    }
}
