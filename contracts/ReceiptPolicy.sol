// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/// Parses native GitHub events only after the verifier authenticates the entire
/// canonical header block and body. Both event text and native footer are bound.
library ReceiptPolicy {
    error InvalidReceipt();

    struct Event {
        string repo;
        uint256 number;
        uint256 pr;
        address wallet;
        bytes32 bountyRef;
        uint256 issuedAt;
        string branch;
        bool merged;
    }

    function decode(bytes memory subject, bytes memory body, uint256 issuedAt) internal pure returns (Event memory e) {
        e.issuedAt = issuedAt;
        uint256 footerAt;
        // Subject must include its complete CRLF terminator and contain no
        // other line breaks. This excludes partial-subject disclosures.
        expect(subject, 0, bytes("\r\nsubject:Re: ["));
        if (subject.length < 20 || subject[subject.length - 2] != 0x0d || subject[subject.length - 1] != 0x0a) {
            revert InvalidReceipt();
        }
        for (uint256 i = 2; i < subject.length - 2; i++) {
            if (uint8(subject[i]) < 32 || uint8(subject[i]) > 126) revert InvalidReceipt();
        }
        uint256 end = find(subject, bytes("] "), 16);
        e.repo = string(slice(subject, 15, end));
        // The end of the title is a GitHub generated issue/PR number suffix.
        uint256 tail = findLast(subject, bytes(" ("));
        uint256 p = tail + 2;
        bool isPr = at(subject, p, bytes("PR #"));
        if (isPr) {
            p += 4;
        } else {
            expect(subject, p, bytes("Issue #"));
            p += 7;
        }
        (e.number, p) = decimal(subject, p);
        expect(subject, p, bytes(")\r\n"));
        if (p + 3 != subject.length) revert InvalidReceipt();

        // Native first MIME part is anchored to body byte zero. Its boundary
        // permits no whitespace or markup that can inject a fake first event.
        expect(body, 0, bytes("\r\n----==_mimepart_"));
        p = 18;
        while (p < body.length && body[p] != 0x0d) {
            uint8 c = uint8(body[p]);
            if (!((c >= 48 && c <= 57) || (c >= 97 && c <= 102) || c == 95)) revert InvalidReceipt();
            p++;
        }
        if (p < 30 || p > 80) revert InvalidReceipt();
        bytes memory boundary = slice(body, 2, p);
        bytes memory mime =
            bytes("\r\nContent-Type: text/plain;\r\n charset=UTF-8\r\nContent-Transfer-Encoding: 7bit\r\n\r\n");
        expect(body, p, mime);
        p += mime.length;
        if (isPr) {
            expect(body, p, bytes("Merged #"));
            p += 8;
            (e.pr, p) = decimal(body, p);
            if (e.pr != e.number) revert InvalidReceipt();
            expect(body, p, bytes(" into "));
            p += 6;
            uint256 branchEnd = find(body, bytes(".\r\n\r\n"), p);
            e.branch = string(slice(body, p, branchEnd));
            footerAt = branchEnd + 5;
            uint256 w = unique(subject, bytes("[wallet 0x"));
            e.wallet = address(uint160(hexNumber(subject, w + 10, 40)));
            expect(subject, w + 50, bytes("]"));
            uint256 r = unique(subject, bytes("[bounty 0x"));
            e.bountyRef = bytes32(hexNumber(subject, r + 10, 64));
            expect(subject, r + 74, bytes("]"));
            if (e.wallet == address(0)) revert InvalidReceipt();
            e.merged = true;
        } else {
            expect(body, p, bytes("Closed #"));
            p += 8;
            (uint256 number, uint256 next) = decimal(body, p);
            p = next;
            if (number != e.number) revert InvalidReceipt();
            expect(body, p, bytes(" as completed via #"));
            p += 19;
            (e.pr, p) = decimal(body, p);
            expect(body, p, bytes(".\r\n\r\n"));
            footerAt = p + 5;
        }
        // A user comment can quote a native event. Require the GitHub-generated
        // issue_event footer, its matching URL/id, and the end of the actual MIME
        // text part. A forged footer before a real comment footer cannot qualify.
        bytes memory route = bytes(isPr ? "/pull/" : "/issues/");
        bytes memory thread = bytes(Strings.toString(e.number));
        bytes memory lead = abi.encodePacked("--\r\nReply to this email directly or view it on GitHub:\r\nhttps://github.com/", e.repo, route, thread, "#event-");
        expect(body, footerAt, lead);
        p = footerAt + lead.length;
        (uint256 eventId, uint256 afterId) = decimal(body, p);
        p = afterId;
        bytes memory reasonLead = bytes("\r\nYou are receiving this because ");
        expect(body, p, reasonLead);
        p += reasonLead.length;
        uint256 reasonEnd = find(body, bytes("\r\n"), p);
        if (reasonEnd == p || reasonEnd - p > 180) revert InvalidReceipt();
        for (uint256 i = p; i < reasonEnd; i++) {
            if (uint8(body[i]) < 32 || uint8(body[i]) > 126) revert InvalidReceipt();
        }
        bytes memory footerTail = abi.encodePacked("\r\n\r\nMessage ID: <", e.repo, isPr ? "/pull/" : "/issue/", thread, "/issue_event/", Strings.toString(eventId), "@github.com>\r\n", boundary,
            "\r\nContent-Type: text/html;\r\n charset=UTF-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\n");
        expect(body, reasonEnd, footerTail);
        bytes memory ending = abi.encodePacked("\r\n", boundary, "--\r\n");
        if (body.length < ending.length || !at(body, body.length - ending.length, ending)) revert InvalidReceipt();
        uint256 boundaries;
        for (uint256 i; i + boundary.length <= body.length; i++) {
            if (at(body, i, boundary)) { boundaries++; i += boundary.length - 1; }
        }
        if (boundaries != 3) revert InvalidReceipt();
    }

    function at(bytes memory s, uint256 p, bytes memory part) private pure returns (bool) {
        if (p > s.length || part.length > s.length - p) return false;
        for (uint256 i = 0; i < part.length; i++) {
            if (s[p + i] != part[i]) return false;
        }
        return true;
    }

    function expect(bytes memory s, uint256 p, bytes memory part) private pure {
        if (!at(s, p, part)) revert InvalidReceipt();
    }

    function contains(bytes memory s, bytes memory part) private pure returns (bool) {
        for (uint256 i; i + part.length <= s.length; i++) {
            if (at(s, i, part)) return true;
        }
        return false;
    }

    function find(bytes memory s, bytes memory part, uint256 p) private pure returns (uint256) {
        for (uint256 i = p; i + part.length <= s.length; i++) {
            if (at(s, i, part)) return i;
        }
        revert InvalidReceipt();
    }

    function findLast(bytes memory s, bytes memory part) private pure returns (uint256) {
        uint256 result = type(uint256).max;
        for (uint256 i; i + part.length <= s.length; i++) {
            if (at(s, i, part)) result = i;
        }
        if (result == type(uint256).max) revert InvalidReceipt();
        return result;
    }

    function unique(bytes memory s, bytes memory part) private pure returns (uint256) {
        uint256 found = find(s, part, 0);
        for (uint256 i = found + 1; i + part.length <= s.length; i++) {
            if (at(s, i, part)) revert InvalidReceipt();
        }
        return found;
    }

    function slice(bytes memory s, uint256 from, uint256 to) private pure returns (bytes memory out) {
        if (to < from || to > s.length) revert InvalidReceipt();
        out = new bytes(to - from);
        for (uint256 i; i < out.length; i++) {
            out[i] = s[from + i];
        }
    }

    function decimal(bytes memory s, uint256 p) private pure returns (uint256 n, uint256 end) {
        end = p;
        while (end < s.length && s[end] >= 0x30 && s[end] <= 0x39) {
            if (end - p >= 12) revert InvalidReceipt();
            n = n * 10 + uint8(s[end]) - 48;
            end++;
        }
        if (end == p || n == 0 || (end - p > 1 && s[p] == 0x30)) revert InvalidReceipt();
    }

    function hexNumber(bytes memory s, uint256 p, uint256 count) private pure returns (uint256 n) {
        if (p + count > s.length) revert InvalidReceipt();
        for (uint256 i; i < count; i++) {
            uint8 c = uint8(s[p + i]);
            uint8 v;
            if (c >= 48 && c <= 57) v = c - 48;
            else if (c >= 65 && c <= 70) v = c - 55;
            else if (c >= 97 && c <= 102) v = c - 87;
            else revert InvalidReceipt();
            n = (n << 4) | v;
        }
    }

    function lower(bytes memory s) private pure returns (bytes memory) {
        for (uint256 i; i < s.length; i++) {
            if (s[i] >= 0x41 && s[i] <= 0x5a) s[i] = bytes1(uint8(s[i]) + 32);
        }
        return s;
    }
}
