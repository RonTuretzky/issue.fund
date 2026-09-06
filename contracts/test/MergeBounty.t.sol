// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {MergeBounty} from "../MergeBounty.sol";
import {IDkimVerifier} from "../IDkimVerifier.sol";
import {ReceiptPolicy} from "../ReceiptPolicy.sol";
import {GithubDkimVerifier} from "../GithubDkimVerifier.sol";

interface Vm {
    function deal(address, uint256) external;
    function warp(uint256) external;
    function prank(address) external;
    function chainId(uint256) external;
    function expectRevert() external;
    function expectRevert(bytes4) external;
    function readFile(string calldata) external view returns (string memory);
    function parseJsonBytes(string calldata, string calldata) external pure returns (bytes memory);
}
// Test-only policy seam; cryptography is tested below and in full-chain tests.
contract UnitVerifier is IDkimVerifier {
    bytes32 public constant keyHash = bytes32(uint256(123));
    function verifyReceipt(Receipt calldata r) external pure returns (ReceiptPolicy.Event memory) {
        return abi.decode(r.headers, (ReceiptPolicy.Event));
    }
}
contract RejectEther { receive() external payable { revert(); } }
contract ReenterRecipient {
    MergeBounty immutable escrow;
    bool public blocked;
    constructor(MergeBounty e) { escrow=e; }
    function pull() external { escrow.withdraw(payable(address(this))); }
    receive() external payable { try escrow.withdraw(payable(address(this))) { revert("reentered"); } catch { blocked=true; } }
}
contract MergeBountyTest {
    Vm constant vm=Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    MergeBounty escrow;
    bytes32 bountyReference;
    address constant RECIPIENT=address(0x1234);
    address constant RELAYER=address(0x8888);
    uint64 constant START=1809700000;
    uint64 constant DEADLINE=START+1 days;
    receive() external payable {}
    function setUp() public {
        vm.warp(START); vm.deal(address(this),100 ether);
        escrow=new MergeBounty(new UnitVerifier());
        escrow.create{value:1 ether}("owner/repo",1,"main",DEADLINE);
        bountyReference=escrow.referenceFor(1);
    }
    function events() internal view returns (ReceiptPolicy.Event memory m, ReceiptPolicy.Event memory c) {
        m=ReceiptPolicy.Event("owner/repo",2,2,RECIPIENT,bountyReference,START,"main",true);
        c=ReceiptPolicy.Event("owner/repo",1,2,address(0),bytes32(0),START,"",false);
    }
    function receipt(ReceiptPolicy.Event memory e) internal pure returns(IDkimVerifier.Receipt memory) { return IDkimVerifier.Receipt(abi.encode(e),"",""); }
    function settle() internal { (ReceiptPolicy.Event memory m,ReceiptPolicy.Event memory c)=events(); escrow.claim(1,receipt(m),receipt(c)); }
    function testPermissionlessClaimCreditsSignedWallet() public { vm.prank(RELAYER); settle(); require(escrow.credits(RECIPIENT)==1 ether && escrow.credits(RELAYER)==0); require(escrow.getBounty(1).status==MergeBounty.Status.Paid); }
    function testRecipientWithdrawsExactAmount() public { settle(); vm.prank(RECIPIENT); escrow.withdraw(payable(RECIPIENT)); require(RECIPIENT.balance==1 ether && escrow.credits(RECIPIENT)==0 && address(escrow).balance==0); }
    function testRelayerCannotWithdraw() public { settle(); vm.expectRevert(MergeBounty.NothingToWithdraw.selector); vm.prank(RELAYER); escrow.withdraw(payable(RELAYER)); }
    function testClaimReplayFails() public { settle(); vm.expectRevert(MergeBounty.NotOpen.selector); settle(); }
    function testRecipientMayRedirectWithdrawal() public { settle(); vm.prank(RECIPIENT); escrow.withdraw(payable(RELAYER)); require(RELAYER.balance==1 ether); }
    function testRejectedTransferPreservesCredit() public { settle(); RejectEther reject=new RejectEther(); vm.expectRevert(MergeBounty.TransferFailed.selector); vm.prank(RECIPIENT); escrow.withdraw(payable(address(reject))); require(escrow.credits(RECIPIENT)==1 ether); }
    function testZeroDestinationFails() public { settle(); vm.expectRevert(MergeBounty.InvalidInput.selector); vm.prank(RECIPIENT); escrow.withdraw(payable(address(0))); }
    function testReentrantWithdrawalIsBlocked() public { ReenterRecipient r=new ReenterRecipient(escrow); (ReceiptPolicy.Event memory m,ReceiptPolicy.Event memory c)=events(); m.wallet=address(r); escrow.claim(1,receipt(m),receipt(c)); r.pull(); require(r.blocked() && address(r).balance==1 ether); }
    function testPairBindingsFailClosed() public {
        for(uint256 i;i<10;i++) {
            (ReceiptPolicy.Event memory m,ReceiptPolicy.Event memory c)=events();
            if(i==0)m.merged=false; if(i==1)c.merged=true; if(i==2)c.pr=99; if(i==3)c.number=99;
            if(i==4)m.bountyRef=bytes32(uint256(9)); if(i==5)m.repo="other/repo"; if(i==6)c.repo="other/repo";
            if(i==7)m.branch="develop"; if(i==8)m.pr=uint256(type(uint64).max)+1; if(i==9)m.bountyRef=escrow.referenceFor(2);
            vm.expectRevert(MergeBounty.InvalidReceipt.selector); escrow.claim(1,receipt(m),receipt(c));
        }
    }
    function testReceiptWindowsFailClosed() public {
        for(uint256 i;i<6;i++) {
            (ReceiptPolicy.Event memory m,ReceiptPolicy.Event memory c)=events();
            if(i==0)m.issuedAt=START-1; if(i==1)c.issuedAt=START-1; if(i==2)m.issuedAt=DEADLINE+1;
            if(i==3)c.issuedAt=DEADLINE+1; if(i==4)m.issuedAt=START+1; if(i==5)c.issuedAt=START+1;
            vm.expectRevert(MergeBounty.InvalidReceipt.selector); escrow.claim(1,receipt(m),receipt(c));
        }
    }
    function testChainAndContractBoundReference() public { bytes32 beforeRef=escrow.referenceFor(1); vm.chainId(block.chainid+1); require(beforeRef!=escrow.referenceFor(1)); MergeBounty other=new MergeBounty(new UnitVerifier()); require(other.referenceFor(1)!=escrow.referenceFor(1)); }
    function testClaimAtEndOfGraceAllowed() public { vm.warp(DEADLINE+7 days); settle(); }
    function testClaimAfterGraceFails() public { vm.warp(DEADLINE+7 days+1); vm.expectRevert(MergeBounty.TooLate.selector); settle(); }
    function testEarlyRefundFails() public { vm.warp(DEADLINE+7 days); vm.expectRevert(MergeBounty.TooEarly.selector); escrow.refund(1); }
    function testRefundOnlyFunder() public { vm.warp(DEADLINE+7 days+1); vm.expectRevert(MergeBounty.Unauthorized.selector); vm.prank(RELAYER); escrow.refund(1); }
    function testRefundThenWithdrawal() public { vm.warp(DEADLINE+7 days+1); escrow.refund(1); require(escrow.credits(address(this))==1 ether); escrow.withdraw(payable(address(this))); require(address(escrow).balance==0); vm.expectRevert(MergeBounty.NotOpen.selector); escrow.refund(1); }
    function testPaidCannotRefund() public { settle(); vm.warp(DEADLINE+7 days+1); vm.expectRevert(MergeBounty.NotOpen.selector); escrow.refund(1); }
    function testInvalidFundingAndUnknownBounty() public {
        vm.expectRevert(); escrow.create("owner/repo",1,"main",DEADLINE);
        vm.expectRevert(); escrow.create{value:1}("owner/repo",0,"main",DEADLINE);
        vm.expectRevert(); escrow.create{value:1}("owner/repo",1,"main",START+599);
        vm.expectRevert(); escrow.create{value:1}("owner/repo",1,"main",START+366 days);
        vm.expectRevert(); escrow.create{value:1}("/owner/repo",1,"main",DEADLINE);
        vm.expectRevert(); escrow.create{value:1}("owner/repo",1,"main\n",DEADLINE);
        vm.expectRevert(); escrow.getBounty(0);
        vm.expectRevert(); escrow.getBounty(2);
        vm.expectRevert(); new MergeBounty(IDkimVerifier(address(1)));
    }
    function testFuzzEscrowConservation(uint96 amount) public {
        uint256 value=uint256(amount)%10 ether+1; escrow.create{value:value}("owner/repo",3,"main",DEADLINE);
        settle(); require(address(escrow).balance==value+escrow.credits(RECIPIENT));
        vm.warp(DEADLINE+7 days+1); escrow.refund(2); require(address(escrow).balance==escrow.credits(address(this))+escrow.credits(RECIPIENT));
        escrow.withdraw(payable(address(this))); vm.prank(RECIPIENT); escrow.withdraw(payable(RECIPIENT)); require(address(escrow).balance==0);
    }
}
contract DirectDkimTest {
    Vm constant vm=Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    GithubDkimVerifier verifier;
    string vectors;
    function setUp() public { vm.warp(1809700100); vectors=vm.readFile("tests/fixtures/rsa-vectors.json"); verifier=new GithubDkimVerifier(vm.parseJsonBytes(vectors,".modulus")); }
    function vector(string memory name) internal view returns(IDkimVerifier.Receipt memory r) {
        r.headers=vm.parseJsonBytes(vectors,string.concat(".",name,".headers")); r.body=vm.parseJsonBytes(vectors,string.concat(".",name,".body")); r.signature=vm.parseJsonBytes(vectors,string.concat(".",name,".signature"));
    }
    function testFullRsaVerificationAndNativePair() public view { ReceiptPolicy.Event memory m=verifier.verifyReceipt(vector("merged")); ReceiptPolicy.Event memory c=verifier.verifyReceipt(vector("closed")); require(m.pr==43 && m.number==43 && m.merged && c.number==42 && !c.merged && c.pr==m.pr); require(m.wallet==0x70997970C51812dc3A010C7d01b50e0d17dc79C8); }
    function testTamperedBodyRejected() public { IDkimVerifier.Receipt memory r=vector("merged"); r.body[100]^=0x01; vm.expectRevert(); verifier.verifyReceipt(r); }
    function testTamperedHeaderRejected() public { IDkimVerifier.Receipt memory r=vector("merged"); r.headers[30]^=0x01; vm.expectRevert(); verifier.verifyReceipt(r); }
    function testTamperedSignatureRejected() public { IDkimVerifier.Receipt memory r=vector("merged"); r.signature[0]^=0x01; vm.expectRevert(); verifier.verifyReceipt(r); }
    function testSignedCommentCannotClaim() public { vm.expectRevert(); verifier.verifyReceipt(vector("comment")); }
    function testSignedFakeFooterCannotClaim() public { vm.expectRevert(); verifier.verifyReceipt(vector("fakeFooter")); }
    function testEventIdentifiersMustAgree() public { vm.expectRevert(); verifier.verifyReceipt(vector("mismatchedEvent")); }
    function testPartialBodySignatureRejected() public { vm.expectRevert(); verifier.verifyReceipt(vector("bodyLength")); }
    function testDuplicateSignedSubjectRejected() public { vm.expectRevert(); verifier.verifyReceipt(vector("duplicateSubject")); }
    function testExpiredSignatureRejected() public { vm.expectRevert(); verifier.verifyReceipt(vector("expired")); }
    function testDuplicateTimestampRejected() public { vm.expectRevert(); verifier.verifyReceipt(vector("duplicateTimestamp")); }
    function testSignatureAtOrAboveModulusRejected() public { IDkimVerifier.Receipt memory r=vector("merged"); r.signature=verifier.modulus(); vm.expectRevert(); verifier.verifyReceipt(r); }
    function testCorrectDigestWithMalformedPaddingRejected() public { vm.expectRevert(); verifier.verifyReceipt(vector("malformedPadding")); }
    function testTruncatedSignatureRejected() public { IDkimVerifier.Receipt memory r=vector("merged"); r.signature=new bytes(127); vm.expectRevert(); verifier.verifyReceipt(r); }
    function testSizeLimits() public { IDkimVerifier.Receipt memory r=vector("merged"); r.body=new bytes(65537); vm.expectRevert(); verifier.verifyReceipt(r); r=vector("merged"); r.headers=new bytes(8193); vm.expectRevert(); verifier.verifyReceipt(r); }
    function testRejectInvalidModuli() public { vm.expectRevert(); new GithubDkimVerifier(new bytes(127)); vm.expectRevert(); new GithubDkimVerifier(new bytes(128)); }
}
