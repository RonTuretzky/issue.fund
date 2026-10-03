// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/// @title The rules for accepting a GitHub event email
/// @notice Accept only GitHub's own "PR merged" or "issue completed by PR" notification.
/// A comment that copies those words must never count as a completion receipt.
/// @dev Call only after GithubDkimVerifier authenticates the full signed headers
/// and body. This library reads ONE event; MergeBounty.claim checks that the TWO
/// events match the funded repository, issue, PR, branch, bounty and time window.
/// It does not prove code quality, GitHub account ownership, or conversation locks.
/// Plain-language examples: docs/reference/receipt-policy.md.
library ReceiptPolicy {
    error InvalidReceipt();

    struct Event {
        string repo; // Repository name in the signed subject, e.g. "owner/repo".
        uint256 number; // The subject's PR number for a merge, or issue number for a closure.
        uint256 pr; // The merged PR; the closure must name this same PR.
        address wallet; // Payout wallet from the merge-time PR title; zero for a closure.
        bytes32 bountyRef; // Title marker binding the reward to its chain, escrow and ID.
        uint256 issuedAt; // DKIM signing time, authenticated by GithubDkimVerifier.
        string branch; // Merge destination, e.g. "main"; empty for a closure.
        bool merged; // True = PR merge notification; false = linked issue closure.
    }

    /// @notice Read one authenticated GitHub event or reject its format.
    /// @param subject Complete canonical subject line, including the surrounding CRLF.
    /// @param body Complete canonical MIME body: plain text, then HTML.
    /// @param issuedAt Signing time already authenticated by the DKIM verifier.
    function decode(bytes memory subject, bytes memory body, uint256 issuedAt) internal pure returns (Event memory eventData) {
        eventData.issuedAt = issuedAt;
        uint256 footerAt;
        // 1. Read the repository and GitHub-generated issue/PR number.
        // Example: "Re: [owner/repo] Fix parser [wallet 0x...] [bounty 0x...] (PR #43)".
        // The whole subject must be one printable line, with its final CRLF intact.
        // This stops a caller presenting just a convenient fragment of the subject.
        expect(subject, 0, bytes("\r\nsubject:Re: ["));
        if (subject.length < 20 || subject[subject.length - 2] != 0x0d || subject[subject.length - 1] != 0x0a) {
            revert InvalidReceipt();
        }
        for (uint256 i = 2; i < subject.length - 2; i++) {
            if (uint8(subject[i]) < 32 || uint8(subject[i]) > 126) revert InvalidReceipt();
        }
        uint256 end = find(subject, bytes("] "), 16);
        eventData.repo = string(slice(subject, 15, end));
        // The end of the title is a GitHub generated issue/PR number suffix.
        uint256 numberSuffixAt = findLast(subject, bytes(" ("));
        uint256 cursor = numberSuffixAt + 2;
        bool isPr = at(subject, cursor, bytes("PR #"));
        if (isPr) {
            cursor += 4;
        } else {
            expect(subject, cursor, bytes("Issue #"));
            cursor += 7;
        }
        (eventData.number, cursor) = decimal(subject, cursor);
        expect(subject, cursor, bytes(")\r\n"));
        if (cursor + 3 != subject.length) revert InvalidReceipt();

        // 2. Require the notification's plain-text section at the start of the body.
        // MIME is the email envelope holding plain-text and HTML versions. Its
        // separator has GitHub's expected shape; no extra text may precede the event.
        expect(body, 0, bytes("\r\n----==_mimepart_"));
        cursor = 18;
        while (cursor < body.length && body[cursor] != 0x0d) {
            uint8 c = uint8(body[cursor]);
            if (!((c >= 48 && c <= 57) || (c >= 97 && c <= 102) || c == 95)) revert InvalidReceipt();
            cursor++;
        }
        if (cursor < 30 || cursor > 80) revert InvalidReceipt();
        bytes memory boundary = slice(body, 2, cursor);
        bytes memory plainTextHeaders =
            bytes("\r\nContent-Type: text/plain;\r\n charset=UTF-8\r\nContent-Transfer-Encoding: 7bit\r\n\r\n");
        expect(body, cursor, plainTextHeaders);
        cursor += plainTextHeaders.length;
        // 3. Read exactly one of the two accepted event sentences.
        if (isPr) {
            // Merge: "Merged #43 into main." The number must match the subject.
            expect(body, cursor, bytes("Merged #"));
            cursor += 8;
            (eventData.pr, cursor) = decimal(body, cursor);
            if (eventData.pr != eventData.number) revert InvalidReceipt();
            expect(body, cursor, bytes(" into "));
            cursor += 6;
            uint256 branchEnd = find(body, bytes(".\r\n\r\n"), cursor);
            eventData.branch = string(slice(body, cursor, branchEnd));
            footerAt = branchEnd + 5;
            // The signed title must contain exactly one wallet and bounty marker.
            // The wallet designates the beneficiary; the transaction sender does not.
            uint256 walletAt = unique(subject, bytes("[wallet 0x"));
            eventData.wallet = address(uint160(hexNumber(subject, walletAt + 10, 40)));
            expect(subject, walletAt + 50, bytes("]"));
            uint256 bountyAt = unique(subject, bytes("[bounty 0x"));
            eventData.bountyRef = bytes32(hexNumber(subject, bountyAt + 10, 64));
            expect(subject, bountyAt + 74, bytes("]"));
            if (eventData.wallet == address(0)) revert InvalidReceipt();
            eventData.merged = true;
        } else {
            // Closure: "Closed #42 as completed via #43." A plain "Closed #42"
            // email is insufficient: GitHub must explicitly link the closing PR.
            expect(body, cursor, bytes("Closed #"));
            cursor += 8;
            (uint256 number, uint256 next) = decimal(body, cursor);
            cursor = next;
            if (number != eventData.number) revert InvalidReceipt();
            expect(body, cursor, bytes(" as completed via #"));
            cursor += 19;
            (eventData.pr, cursor) = decimal(body, cursor);
            expect(body, cursor, bytes(".\r\n\r\n"));
            footerAt = cursor + 5;
        }
        // 4. Require GitHub's event footer immediately after that sentence.
        // Both its URL (#event-ID) and Message ID (/issue_event/ID) must name the
        // same event and thread. A normal comment has a different footer; copying
        // event text or inserting a fake footer before the real one cannot qualify.
        bytes memory route = bytes(isPr ? "/pull/" : "/issues/");
        bytes memory thread = bytes(Strings.toString(eventData.number));
        bytes memory lead = abi.encodePacked("--\r\nReply to this email directly or view it on GitHub:\r\nhttps://github.com/", eventData.repo, route, thread, "#event-");
        expect(body, footerAt, lead);
        cursor = footerAt + lead.length;
        (uint256 eventId, uint256 afterId) = decimal(body, cursor);
        cursor = afterId;
        bytes memory reasonLead = bytes("\r\nYou are receiving this because ");
        expect(body, cursor, reasonLead);
        cursor += reasonLead.length;
        uint256 reasonEnd = find(body, bytes("\r\n"), cursor);
        if (reasonEnd == cursor || reasonEnd - cursor > 180) revert InvalidReceipt();
        for (uint256 i = cursor; i < reasonEnd; i++) {
            if (uint8(body[i]) < 32 || uint8(body[i]) > 126) revert InvalidReceipt();
        }
        bytes memory footerTail = abi.encodePacked("\r\n\r\nMessage ID: <", eventData.repo, isPr ? "/pull/" : "/issue/", thread, "/issue_event/", Strings.toString(eventId), "@github.com>\r\n", boundary,
            "\r\nContent-Type: text/html;\r\n charset=UTF-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\n");
        expect(body, reasonEnd, footerTail);
        // 5. Require the end of the HTML section and exactly three MIME separators:
        // opening plain text, opening HTML, closing envelope. Extra inserted parts fail.
        bytes memory ending = abi.encodePacked("\r\n", boundary, "--\r\n");
        if (body.length < ending.length || !at(body, body.length - ending.length, ending)) revert InvalidReceipt();
        uint256 boundaries;
        for (uint256 i; i + boundary.length <= body.length; i++) {
            if (at(body, i, boundary)) { boundaries++; i += boundary.length - 1; }
        }
        if (boundaries != 3) revert InvalidReceipt();
    }

    // Byte helpers below deliberately match exact text. Do not replace these with
    // broad substring searches: an email may contain user-authored quoted content.
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

    // Reject duplicate title markers rather than choosing the first or last one.
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

    // Read a positive decimal ID, at most 12 digits, without leading zeroes.
    function decimal(bytes memory s, uint256 p) private pure returns (uint256 n, uint256 end) {
        end = p;
        while (end < s.length && s[end] >= 0x30 && s[end] <= 0x39) {
            if (end - p >= 12) revert InvalidReceipt();
            n = n * 10 + uint8(s[end]) - 48;
            end++;
        }
        if (end == p || n == 0 || (end - p > 1 && s[p] == 0x30)) revert InvalidReceipt();
    }

    // Read exactly the required hex digits: 40 for a wallet, 64 for a bounty reference.
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
