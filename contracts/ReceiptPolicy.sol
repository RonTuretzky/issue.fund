// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// Parses ONLY fields authenticated by Receipt.circom. Fail closed on every
/// unsupported MIME/encoding/template variant. A UI parser is never authority.
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

    function decode(uint256[43] calldata fields) internal pure returns (Event memory e) {
        bytes memory subject = unpack(fields, 1, 13);
        bytes memory body = unpack(fields, 14, 9);
        bytes memory tags = unpack(fields, 23, 20);
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
            if (branchEnd + 5 != body.length) revert InvalidReceipt();
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
            if (p + 5 != body.length) revert InvalidReceipt();
        }
        // Canonical DKIM signature header is disclosed in full. Circuit also
        // checks its end is the first SHA padding byte, not a chosen substring.
        expect(tags, 0, bytes("\r\ndkim-signature:"));
        if (!at(tags, tags.length - 2, bytes("b="))) revert InvalidReceipt();
        bool domain;
        bool algorithm;
        bool canonical;
        bool version;
        bool timestamp;
        bool hash;
        bool signedSubject;
        bool headerList;
        p = 17;
        while (p < tags.length) {
            while (p < tags.length && (tags[p] == 0x20 || tags[p] == 0x3b)) p++;
            uint256 stop = p;
            while (stop < tags.length && tags[stop] != 0x3b) stop++;
            bytes memory part = slice(tags, p, stop);
            if (at(part, 0, bytes("d="))) {
                if (domain || keccak256(part) != keccak256("d=github.com")) revert InvalidReceipt();
                domain = true;
            } else if (at(part, 0, bytes("a="))) {
                if (algorithm || keccak256(part) != keccak256("a=rsa-sha256")) revert InvalidReceipt();
                algorithm = true;
            } else if (at(part, 0, bytes("c="))) {
                if (canonical || keccak256(part) != keccak256("c=relaxed/relaxed")) revert InvalidReceipt();
                canonical = true;
            } else if (at(part, 0, bytes("v="))) {
                if (version || keccak256(part) != keccak256("v=1")) revert InvalidReceipt();
                version = true;
            } else if (at(part, 0, bytes("l="))) {
                revert InvalidReceipt();
            } else if (at(part, 0, bytes("t="))) {
                if (timestamp) revert InvalidReceipt();
                uint256 last;
                (e.issuedAt, last) = decimal(part, 2);
                if (last != part.length) revert InvalidReceipt();
                timestamp = true;
            } else if (at(part, 0, bytes("bh="))) {
                if (hash || part.length != 47) revert InvalidReceipt();
                hash = true;
            } else if (at(part, 0, bytes("h="))) {
                if (headerList) revert InvalidReceipt();
                headerList = true;
                signedSubject = contains(lower(part), bytes(":subject:"));
            }
            p = stop + 1;
        }
        if (!(domain && algorithm && canonical && version && timestamp && hash && signedSubject)) revert InvalidReceipt();
    }

    function unpack(uint256[43] calldata fields, uint256 start, uint256 count) private pure returns (bytes memory out) {
        out = new bytes(count * 31);
        uint256 n;
        bool ended;
        for (uint256 i = 0; i < count; i++) {
            if (fields[start + i] >> 248 != 0) revert InvalidReceipt();
            for (uint256 j = 0; j < 31; j++) {
                bytes1 c = bytes1(uint8(fields[start + i] >> (j * 8)));
                if (c == 0) {
                    ended = true;
                } else {
                    if (ended) revert InvalidReceipt();
                    out[n++] = c;
                }
            }
        }
        assembly ("memory-safe") { mstore(out, n) }
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
