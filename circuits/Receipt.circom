pragma circom 2.2.2;
include "@zk-email/circuits/email-verifier.circom";

// Private DKIM verification with narrowly scoped public disclosures. The
// Solidity policy parses these disclosures; neither JS parsing nor DNS is
// trusted by settlement. Prefixes always start at body byte zero.
template Disclosure(N, L) {
    signal input source[N];
    signal input start;
    signal input length;
    signal output bytes[L];
    signal output packed[(L+30)\31];
    component lenBits = Num2Bits(12); lenBits.in <== length;
    component lenBound = LessEqThan(12); lenBound.in[0] <== length; lenBound.in[1] <== L; lenBound.out === 1;
    component shift = VarShiftLeft(N,L); shift.in <== source; shift.shift <== start;
    component active[L];
    for (var i=0;i<L;i++) {
        active[i]=LessThan(12); active[i].in[0]<==i; active[i].in[1]<==length;
        bytes[i] <== shift.out[i]*active[i].out;
    }
    for (var w=0;w<(L+30)\31;w++) {
        var v=0;
        for(var b=0;b<31;b++) { if(w*31+b<L) { v+=bytes[w*31+b]*(2**(8*b)); } }
        packed[w]<==v;
    }
}

template Receipt(H,B) {
    signal input emailHeader[H];
    signal input emailHeaderLength;
    signal input pubkey[17];
    signal input signature[17];
    signal input emailBody[B];
    signal input emailBodyLength;
    signal input bodyHashIndex;
    signal input precomputedSHA[32];
    signal input subjectStart;
    signal input subjectLength;
    signal input dkimStart;
    signal input dkimLength;
    signal input prefixLength;
    signal output keyHash;
    signal output subject[13];
    signal output prefix[9];
    signal output dkim[20];
    component email=EmailVerifier(H,B,121,17,0,0,0,0);
    email.emailHeader<==emailHeader; email.emailHeaderLength<==emailHeaderLength;
    email.pubkey<==pubkey; email.signature<==signature;
    email.emailBody<==emailBody; email.emailBodyLength<==emailBodyLength;
    email.bodyHashIndex<==bodyHashIndex; email.precomputedSHA<==precomputedSHA;
    keyHash<==email.pubkeyHash;
    // No unproven SHA prefix: full body authentication from the standard IV.
    var iv[32]=[106,9,230,103,187,103,174,133,60,110,243,114,165,79,245,58,81,14,82,127,155,5,104,140,31,131,217,171,91,224,205,25];
    for(var i=0;i<32;i++){precomputedSHA[i]===iv[i];}
    component s=Disclosure(H,403); s.source<==emailHeader; s.start<==subjectStart; s.length<==subjectLength;
    subject<==s.packed;
    // Subject and DKIM disclosures begin at authenticated header boundaries.
    var sp[10]=[13,10,115,117,98,106,101,99,116,58];
    for(var i=0;i<10;i++){s.bytes[i]===sp[i];}
    component d=Disclosure(H,620); d.source<==emailHeader; d.start<==dkimStart; d.length<==dkimLength;
    dkim<==d.packed;
    var dp[17]=[13,10,100,107,105,109,45,115,105,103,110,97,116,117,114,101,58];
    for(var i=0;i<17;i++){d.bytes[i]===dp[i];}
    component dEnd=ItemAtIndex(H);dEnd.in<==emailHeader;dEnd.index<==dkimStart+dkimLength;dEnd.out===128;
    component p=Disclosure(B,279);p.source<==emailBody;p.start<==0;p.length<==prefixLength;
    prefix<==p.packed;
}
component main = Receipt(2048,4096);
