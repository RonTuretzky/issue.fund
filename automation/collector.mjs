import {
  authenticateEmail,
  parseNativeEvent,
  checkPair,
} from "../shared/dkim.mjs";
import { verifyGmailDelivery } from "./mail-policy.mjs";
import { ServiceError, fail } from "./errors.mjs";

export class Collector {
  constructor({
    store,
    keys,
    mailbox,
    now = Date.now,
    maxStorageBytes,
    retentionMs,
  }) {
    Object.assign(this, {
      store,
      keys,
      mailbox,
      now,
      maxStorageBytes,
      retentionMs,
    });
  }
  // No public upload endpoint calls this method: its raw bytes come exclusively
  // from the authenticated mailbox adapter. Manual claiming stays in-browser.
  async ingest(raw) {
    verifyGmailDelivery(raw, this.mailbox);
    let auth;
    for (const key of this.keys) {
      try {
        auth = await authenticateEmail(raw, key);
        break;
      } catch {
        /* try another pinned deployment key */
      }
    }
    if (!auth) fail("email_signature_invalid", 422);
    const matched =
      /^\r\nsubject:Re: \[([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\] /.exec(
        auth.subject,
      );
    if (!matched || auth.issuedAt * 1000 > this.now() + 60_000)
      fail("notification_unsupported", 422);
    const repo = this.store.get(
      "SELECT * FROM repositories WHERE full_name=? AND enabled=1",
      matched[1],
    );
    if (!repo || repo.full_name !== matched[1])
      return { outcome: "unregistered" };
    // Do not declare receipt readiness from a replay predating this watch period.
    if (repo.watched_at && auth.issuedAt * 1000 >= repo.watched_at - 1000) {
      this.store.run(
        "UPDATE repositories SET delivered_at=? WHERE id=?",
        this.now(),
        repo.id,
      );
    }
    let summary;
    try {
      summary = {
        ...parseNativeEvent(auth.subject, auth.body, auth.issuedAt),
        keyHash: auth.keyHash,
      };
    } catch {
      return { outcome: "notification_only" };
    }
    // Store only potentially useful receipts, not the repository's whole inbox.
    const useful =
      summary.kind === "merge"
        ? this.store.get(
            "SELECT 1 FROM issues WHERE repo_id=? LIMIT 1",
            repo.id,
          )
        : this.store.get(
            "SELECT 1 FROM issues WHERE repo_id=? AND number=?",
            repo.id,
            summary.issue,
          );
    if (!useful) return { outcome: "unmatched" };
    const prepared = { receipt: auth.receipt, summary };
    const saved = this.store.putReceipt({
      raw,
      prepared,
      repoId: repo.id,
      now: this.now(),
      maxBytes: this.maxStorageBytes,
      retentionMs: this.retentionMs,
    });
    this.pair(repo.id, summary.pr);
    return { outcome: saved.duplicate ? "duplicate" : "stored", id: saved.id };
  }
  pair(repoId, pr) {
    const merges = this.store.all(
      "SELECT * FROM receipts WHERE repo_id=? AND pr=? AND kind='merge' ORDER BY received_at",
      repoId,
      pr,
    );
    const closures = this.store.all(
      "SELECT * FROM receipts WHERE repo_id=? AND pr=? AND kind='closure' ORDER BY received_at",
      repoId,
      pr,
    );
    for (const m of merges) {
      const b = this.store.get(
        "SELECT * FROM bounties WHERE bounty_ref=? AND canonical=1",
        m.bounty_ref,
      );
      if (!b) continue;
      const bounty = JSON.parse(b.data);
      if (bounty.status !== 0) continue;
      for (const c of closures) {
        try {
          const merged = this.store.receipt(m.id).prepared,
            closed = this.store.receipt(c.id).prepared;
          checkPair(merged, closed, bounty);
          this.store.run(
            `INSERT INTO jobs(bounty_key,merge_id,closure_id,state,updated_at) VALUES (?,?,?,'queued',?)
            ON CONFLICT(bounty_key) DO UPDATE SET merge_id=excluded.merge_id,closure_id=excluded.closure_id,state='queued',code=NULL,updated_at=excluded.updated_at
            WHERE jobs.state IN ('waiting','attention') AND jobs.tx_hash IS NULL`,
            b.key,
            m.id,
            c.id,
            this.now(),
          );
          break;
        } catch (error) {
          if (error instanceof ServiceError && error.status >= 500) throw error;
          // An unrelated closure must not prevent trying the correct pair.
        }
      }
    }
  }
}
