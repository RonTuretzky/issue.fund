// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {MergeBounty, IReceiptVerifier} from "../MergeBounty.sol";
import {ReceiptPolicy} from "../ReceiptPolicy.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

interface Vm {
    function deal(address, uint256) external;
    function warp(uint256) external;
    function prank(address) external;
    function expectRevert() external;
    function expectRevert(bytes4) external;
}

/// Test-only verifier isolates settlement/policy. Full cryptographic proofs are
/// tested separately against the generated verifier by tests/chain-e2e.mjs.
contract UnitVerifier is IReceiptVerifier {
    bool public valid = true;

    function setValid(bool value) external {
        valid = value;
    }

    function verifyProof(uint256[2] calldata, uint256[2][2] calldata, uint256[2] calldata, uint256[43] calldata)
        external
        view
        returns (bool)
    {
        return valid;
    }
}

contract RejectEther {
    receive() external payable {
        revert("No ETH");
    }
}

contract ReenterRecipient {
    MergeBounty immutable escrow;
    bool public blocked;

    constructor(MergeBounty e) {
        escrow = e;
    }

    function pull() external {
        escrow.withdraw(payable(address(this)));
    }

    receive() external payable {
        try escrow.withdraw(payable(address(this))) {
            revert("Reentered");
        }
            catch {
            blocked = true;
        }
    }
}

contract MergeBountyTest {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    MergeBounty escrow;
    UnitVerifier verifier;
    address constant RECIPIENT = address(0x1234);
    address constant RELAYER = address(0x8888);
    uint64 constant START = 1788699000;
    uint64 constant DEADLINE = START + 1 days;
    receive() external payable {}

    function setUp() public {
        vm.warp(START);
        vm.deal(address(this), 100 ether);
        verifier = new UnitVerifier();
        escrow = new MergeBounty(verifier, 123);
        escrow.create{value: 1 ether}("owner/repo", 1, "main", DEADLINE);
    }

    function title() internal view returns (string memory) {
        return string.concat(
            "Repair the parser [bounty ",
            Strings.toHexString(uint256(escrow.referenceFor(1)), 32),
            "] [wallet ",
            Strings.toHexString(RECIPIENT),
            "]"
        );
    }

    function signals(bool merged, string memory t, string memory eventText)
        internal
        pure
        returns (uint256[43] memory s)
    {
        s[0] = 123;
        string memory subject =
            string.concat("\r\nsubject:Re: [owner/repo] ", t, merged ? " (PR #2)\r\n" : " (Issue #1)\r\n");
        string memory body = string.concat(
            "\r\n----==_mimepart_6a9d62d2c9150_eb11b8353365\r\nContent-Type: text/plain;\r\n charset=UTF-8\r\nContent-Transfer-Encoding: 7bit\r\n\r\n",
            eventText,
            "\r\n\r\n"
        );
        string memory dkim =
            "\r\ndkim-signature:v=1; a=rsa-sha256; c=relaxed/relaxed; d=github.com; s=pf2023; t=1788699000; bh=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=; h=Date:From:Subject:To; b=";
        pack(s, 1, 13, bytes(subject));
        pack(s, 14, 9, bytes(body));
        pack(s, 23, 20, bytes(dkim));
    }

    function pack(uint256[43] memory s, uint256 from, uint256 words, bytes memory raw) internal pure {
        require(raw.length <= words * 31);
        for (uint256 i; i < raw.length; i++) {
            s[from + i / 31] |= uint256(uint8(raw[i])) << ((i % 31) * 8);
        }
    }

    function proofs() internal view returns (MergeBounty.Proof memory m, MergeBounty.Proof memory c) {
        m.signals = signals(true, title(), "Merged #2 into main.");
        c.signals = signals(false, "Repair parser", "Closed #1 as completed via #2.");
    }

    function testPermissionlessClaimCreditsSignedWallet() public {
        (MergeBounty.Proof memory m, MergeBounty.Proof memory c) = proofs();
        vm.prank(RELAYER);
        escrow.claim(1, m, c);
        require(escrow.credits(RECIPIENT) == 1 ether);
        require(escrow.credits(RELAYER) == 0);
        require(escrow.getBounty(1).status == MergeBounty.Status.Paid);
    }

    function testRecipientWithdrawsExactAmount() public {
        (MergeBounty.Proof memory m, MergeBounty.Proof memory c) = proofs();
        escrow.claim(1, m, c);
        vm.prank(RECIPIENT);
        escrow.withdraw(payable(RECIPIENT));
        require(RECIPIENT.balance == 1 ether);
        require(escrow.credits(RECIPIENT) == 0);
    }

    function testCannotRedirectOtherWalletCredit() public {
        (MergeBounty.Proof memory m, MergeBounty.Proof memory c) = proofs();
        escrow.claim(1, m, c);
        vm.prank(RELAYER);
        vm.expectRevert(MergeBounty.NothingToWithdraw.selector);
        escrow.withdraw(payable(RELAYER));
    }

    function testDoubleClaimRejected() public {
        (MergeBounty.Proof memory m, MergeBounty.Proof memory c) = proofs();
        escrow.claim(1, m, c);
        vm.expectRevert(MergeBounty.NotOpen.selector);
        escrow.claim(1, m, c);
    }

    function testBadCryptographicProofRejected() public {
        (MergeBounty.Proof memory m, MergeBounty.Proof memory c) = proofs();
        verifier.setValid(false);
        vm.expectRevert(MergeBounty.InvalidProof.selector);
        escrow.claim(1, m, c);
    }

    function testUnknownKeyRejected() public {
        (MergeBounty.Proof memory m, MergeBounty.Proof memory c) = proofs();
        m.signals[0] = 999;
        vm.expectRevert(MergeBounty.InvalidProof.selector);
        escrow.claim(1, m, c);
    }

    function testOrdinaryCommentCannotQualify() public {
        (MergeBounty.Proof memory m, MergeBounty.Proof memory c) = proofs();
        m.signals = signals(true, title(), "Someone left a comment. Merged #2 into main.");
        vm.expectRevert(ReceiptPolicy.InvalidReceipt.selector);
        escrow.claim(1, m, c);
    }

    function testClosedPrCannotQualify() public {
        (MergeBounty.Proof memory m, MergeBounty.Proof memory c) = proofs();
        m.signals = signals(true, title(), "Closed #2.");
        vm.expectRevert(ReceiptPolicy.InvalidReceipt.selector);
        escrow.claim(1, m, c);
    }

    function testWrongBranchRejected() public {
        (MergeBounty.Proof memory m, MergeBounty.Proof memory c) = proofs();
        m.signals = signals(true, title(), "Merged #2 into develop.");
        vm.expectRevert(MergeBounty.InvalidProof.selector);
        escrow.claim(1, m, c);
    }

    function testWrongLinkedPrRejected() public {
        (MergeBounty.Proof memory m, MergeBounty.Proof memory c) = proofs();
        c.signals = signals(false, "Repair parser", "Closed #1 as completed via #3.");
        vm.expectRevert(MergeBounty.InvalidProof.selector);
        escrow.claim(1, m, c);
    }

    function testWrongBountyReferenceRejected() public {
        (MergeBounty.Proof memory m, MergeBounty.Proof memory c) = proofs();
        m.signals = signals(
            true,
            string.concat(
                "[bounty ", Strings.toHexString(uint256(7), 32), "] [wallet ", Strings.toHexString(RECIPIENT), "]"
            ),
            "Merged #2 into main."
        );
        vm.expectRevert(MergeBounty.InvalidProof.selector);
        escrow.claim(1, m, c);
    }

    function testAmbiguousWalletRejected() public {
        (MergeBounty.Proof memory m, MergeBounty.Proof memory c) = proofs();
        m.signals =
            signals(
            true, string.concat(title(), " [wallet ", Strings.toHexString(RELAYER), "]"), "Merged #2 into main."
        );
        vm.expectRevert(ReceiptPolicy.InvalidReceipt.selector);
        escrow.claim(1, m, c);
    }

    function testSwappedReceiptsRejected() public {
        (MergeBounty.Proof memory m, MergeBounty.Proof memory c) = proofs();
        vm.expectRevert(MergeBounty.InvalidProof.selector);
        escrow.claim(1, c, m);
    }

    function testRefundCannotRaceTimelyClaim() public {
        vm.warp(DEADLINE + 1);
        vm.expectRevert(MergeBounty.TooEarly.selector);
        escrow.refund(1);
        (MergeBounty.Proof memory m, MergeBounty.Proof memory c) = proofs();
        escrow.claim(1, m, c);
    }

    function testExpiredUnclaimedBountyRefundsFunder() public {
        vm.warp(DEADLINE + escrow.CLAIM_GRACE() + 1);
        escrow.refund(1);
        require(escrow.credits(address(this)) == 1 ether);
        escrow.withdraw(payable(address(this)));
        require(escrow.getBounty(1).status == MergeBounty.Status.Refunded);
    }

    function testLateClaimRejected() public {
        vm.warp(DEADLINE + escrow.CLAIM_GRACE() + 1);
        (MergeBounty.Proof memory m, MergeBounty.Proof memory c) = proofs();
        vm.expectRevert(MergeBounty.TooLate.selector);
        escrow.claim(1, m, c);
    }

    function testOnlyFunderCanRefund() public {
        vm.warp(DEADLINE + escrow.CLAIM_GRACE() + 1);
        vm.prank(RELAYER);
        vm.expectRevert(MergeBounty.Unauthorized.selector);
        escrow.refund(1);
    }

    function testRefundTwiceRejected() public {
        vm.warp(DEADLINE + escrow.CLAIM_GRACE() + 1);
        escrow.refund(1);
        vm.expectRevert(MergeBounty.NotOpen.selector);
        escrow.refund(1);
    }

    function testFundingValidation() public {
        vm.expectRevert(MergeBounty.InvalidInput.selector);
        escrow.create{value: 1 ether}("bad repo", 1, "main", DEADLINE);
        vm.expectRevert(MergeBounty.InvalidInput.selector);
        escrow.create("owner/repo", 1, "main", DEADLINE);
    }

    function replaceDkim(MergeBounty.Proof memory p, string memory raw)
        internal
        pure
        returns (MergeBounty.Proof memory)
    {
        for (uint256 i = 23; i < 43; i++) {
            p.signals[i] = 0;
        }
        pack(p.signals, 23, 20, bytes(raw));
        return p;
    }

    function testDkimLengthTagRejected() public {
        (MergeBounty.Proof memory m, MergeBounty.Proof memory c) = proofs();
        m = replaceDkim(
            m,
            "\r\ndkim-signature:v=1; a=rsa-sha256; c=relaxed/relaxed; d=github.com; l=100; t=1788699000; bh=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=; h=Date:Subject:To; b="
        );
        vm.expectRevert(ReceiptPolicy.InvalidReceipt.selector);
        escrow.claim(1, m, c);
    }

    function testDkimWithoutSignedSubjectRejected() public {
        (MergeBounty.Proof memory m, MergeBounty.Proof memory c) = proofs();
        m = replaceDkim(
            m,
            "\r\ndkim-signature:v=1; a=rsa-sha256; c=relaxed/relaxed; d=github.com; t=1788699000; bh=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=; h=Date:From:To; b="
        );
        vm.expectRevert(ReceiptPolicy.InvalidReceipt.selector);
        escrow.claim(1, m, c);
    }

    function testDuplicateDkimHeadersListRejected() public {
        (MergeBounty.Proof memory m, MergeBounty.Proof memory c) = proofs();
        m = replaceDkim(
            m,
            "\r\ndkim-signature:v=1; a=rsa-sha256; c=relaxed/relaxed; d=github.com; t=1788699000; bh=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=; h=Date:From:To; h=Date:Subject:To; b="
        );
        vm.expectRevert(ReceiptPolicy.InvalidReceipt.selector);
        escrow.claim(1, m, c);
    }

    function testStaleReceiptRejected() public {
        (MergeBounty.Proof memory m, MergeBounty.Proof memory c) = proofs();
        m = replaceDkim(
            m,
            "\r\ndkim-signature:v=1; a=rsa-sha256; c=relaxed/relaxed; d=github.com; t=1788698999; bh=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=; h=Date:Subject:To; b="
        );
        vm.expectRevert(MergeBounty.InvalidProof.selector);
        escrow.claim(1, m, c);
    }

    function testFutureReceiptRejected() public {
        (MergeBounty.Proof memory m, MergeBounty.Proof memory c) = proofs();
        m = replaceDkim(
            m,
            "\r\ndkim-signature:v=1; a=rsa-sha256; c=relaxed/relaxed; d=github.com; t=1788699001; bh=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=; h=Date:Subject:To; b="
        );
        vm.expectRevert(MergeBounty.InvalidProof.selector);
        escrow.claim(1, m, c);
    }

    function testGarbageAfterDisclosureTerminatorRejected() public {
        (MergeBounty.Proof memory m, MergeBounty.Proof memory c) = proofs();
        m.signals[13] = 1;
        vm.expectRevert(ReceiptPolicy.InvalidReceipt.selector);
        escrow.claim(1, m, c);
    }

    function testOutOfRangeDisclosureFieldRejected() public {
        (MergeBounty.Proof memory m, MergeBounty.Proof memory c) = proofs();
        m.signals[1] |= 1 << 248;
        vm.expectRevert(ReceiptPolicy.InvalidReceipt.selector);
        escrow.claim(1, m, c);
    }

    function testUnknownBountyRejected() public {
        (MergeBounty.Proof memory m, MergeBounty.Proof memory c) = proofs();
        vm.expectRevert(MergeBounty.InvalidInput.selector);
        escrow.claim(999, m, c);
    }

    function testZeroWithdrawalDestinationRejected() public {
        (MergeBounty.Proof memory m, MergeBounty.Proof memory c) = proofs();
        escrow.claim(1, m, c);
        vm.prank(RECIPIENT);
        vm.expectRevert(MergeBounty.InvalidInput.selector);
        escrow.withdraw(payable(address(0)));
        require(escrow.credits(RECIPIENT) == 1 ether);
    }

    function testRejectedTransferPreservesCreditAndAllowsAnotherDestination() public {
        (MergeBounty.Proof memory m, MergeBounty.Proof memory c) = proofs();
        escrow.claim(1, m, c);
        RejectEther destination = new RejectEther();
        vm.prank(RECIPIENT);
        vm.expectRevert(MergeBounty.TransferFailed.selector);
        escrow.withdraw(payable(address(destination)));
        require(escrow.credits(RECIPIENT) == 1 ether);
        vm.prank(RECIPIENT);
        escrow.withdraw(payable(RELAYER));
        require(RELAYER.balance == 1 ether);
        require(escrow.credits(RECIPIENT) == 0);
    }

    function testWithdrawalReentrancyIsBlocked() public {
        ReenterRecipient r = new ReenterRecipient(escrow);
        (MergeBounty.Proof memory m, MergeBounty.Proof memory c) = proofs();
        m.signals = signals(
            true,
            string.concat(
                "[bounty ",
                Strings.toHexString(uint256(escrow.referenceFor(1)), 32),
                "] [wallet ",
                Strings.toHexString(address(r)),
                "]"
            ),
            "Merged #2 into main."
        );
        escrow.claim(1, m, c);
        r.pull();
        require(r.blocked());
        require(address(r).balance == 1 ether);
        require(escrow.credits(address(r)) == 0);
    }

    function testFuzzPayoutIsConserved(uint96 value) public {
        uint256 amount = uint256(value) + 1;
        vm.deal(address(this), amount);
        uint256 id = escrow.create{value: amount}("owner/repo", 2, "main", DEADLINE);
        vm.warp(DEADLINE + escrow.CLAIM_GRACE() + 1);
        escrow.refund(id);
        require(escrow.credits(address(this)) == amount);
        require(address(escrow).balance == 1 ether + amount);
        escrow.withdraw(payable(address(this)));
        require(address(escrow).balance == 1 ether);
        require(address(this).balance == amount);
    }
}
