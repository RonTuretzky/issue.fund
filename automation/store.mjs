import { DatabaseSync } from "node:sqlite";
import { mkdirSync, chmodSync } from "node:fs";
import { dirname } from "node:path";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from "node:crypto";

export const json = (value) =>
  JSON.stringify(value, (_, v) => (typeof v === "bigint" ? v.toString() : v));
export const digest = (value) =>
  createHash("sha256").update(value).digest("hex");

// One persistent writer per service. SQLite transactions also protect admission
// and job uniqueness if an operator accidentally starts a second API instance.
export class Store {
  constructor(path, encryptionKey) {
    if (!(encryptionKey instanceof Uint8Array) || encryptionKey.length !== 32)
      throw Error("Storage requires a 32-byte encryption key");
    this.key = Buffer.from(encryptionKey);
    if (path !== ":memory:")
      mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path);
    if (path !== ":memory:") chmodSync(path, 0o600);
    this.db.exec(`
      PRAGMA journal_mode=WAL;
      PRAGMA synchronous=FULL;
      PRAGMA foreign_keys=ON;
      PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS repositories (
        id INTEGER PRIMARY KEY, full_name TEXT NOT NULL UNIQUE COLLATE NOCASE,
        owner_id INTEGER NOT NULL, branch TEXT NOT NULL, installation_id INTEGER,
        prepared_at INTEGER NOT NULL, watched_at INTEGER, checked_at INTEGER,
        delivered_at INTEGER, enabled INTEGER NOT NULL DEFAULT 1, error_code TEXT
      );
      CREATE TABLE IF NOT EXISTS issues (
        id INTEGER PRIMARY KEY, repo_id INTEGER NOT NULL REFERENCES repositories(id),
        number INTEGER NOT NULL, url TEXT NOT NULL, prepared_at INTEGER NOT NULL,
        UNIQUE(repo_id, number)
      );
      CREATE TABLE IF NOT EXISTS bounties (
        key TEXT PRIMARY KEY, chain_id INTEGER NOT NULL, escrow TEXT NOT NULL,
        bounty_id TEXT NOT NULL, repo_id INTEGER, issue_number INTEGER NOT NULL,
        bounty_ref TEXT NOT NULL UNIQUE, data TEXT NOT NULL, funded_block INTEGER NOT NULL,
        funded_hash TEXT NOT NULL, canonical INTEGER NOT NULL DEFAULT 1,
        updated_at INTEGER NOT NULL, UNIQUE(chain_id, escrow, bounty_id)
      );
      CREATE TABLE IF NOT EXISTS receipts (
        id TEXT PRIMARY KEY, repo_id INTEGER NOT NULL REFERENCES repositories(id),
        kind TEXT NOT NULL CHECK(kind IN ('merge','closure')), issue_number INTEGER,
        pr INTEGER NOT NULL, bounty_ref TEXT, issued_at INTEGER NOT NULL,
        received_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
        ciphertext BLOB NOT NULL, byte_length INTEGER NOT NULL,
        UNIQUE(id, repo_id)
      );
      CREATE INDEX IF NOT EXISTS receipt_pair ON receipts(repo_id, pr, kind);
      CREATE TABLE IF NOT EXISTS jobs (
        bounty_key TEXT PRIMARY KEY REFERENCES bounties(key),
        merge_id TEXT REFERENCES receipts(id), closure_id TEXT REFERENCES receipts(id),
        state TEXT NOT NULL DEFAULT 'waiting', code TEXT,
        attempts INTEGER NOT NULL DEFAULT 0, next_attempt INTEGER NOT NULL DEFAULT 0,
        tx_hash TEXT, updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS transactions (
        hash TEXT PRIMARY KEY, bounty_key TEXT NOT NULL REFERENCES bounties(key),
        nonce INTEGER NOT NULL, signed_ciphertext BLOB NOT NULL,
        gas_budget TEXT NOT NULL, created_at INTEGER NOT NULL,
        state TEXT NOT NULL DEFAULT 'signed', block_number INTEGER, block_hash TEXT
      );
      CREATE INDEX IF NOT EXISTS transactions_nonce ON transactions(nonce);
      CREATE TABLE IF NOT EXISTS chain_events (
        chain_id INTEGER NOT NULL, escrow TEXT NOT NULL, block_number INTEGER NOT NULL,
        block_hash TEXT NOT NULL, tx_hash TEXT NOT NULL, log_index INTEGER NOT NULL,
        event_name TEXT NOT NULL, args TEXT NOT NULL,
        PRIMARY KEY(chain_id, escrow, tx_hash, log_index)
      );
      CREATE INDEX IF NOT EXISTS event_history ON chain_events(chain_id, escrow, event_name, block_number);
      CREATE TABLE IF NOT EXISTS health (name TEXT PRIMARY KEY, checked_at INTEGER NOT NULL, ok INTEGER NOT NULL, code TEXT);
      CREATE TABLE IF NOT EXISTS leases (name TEXT PRIMARY KEY, owner TEXT NOT NULL, until_at INTEGER NOT NULL);
    `);
    const marker = this.getMeta("encryption-check");
    if (marker) {
      if (
        this.open(Buffer.from(marker, "base64"), "key-check").value !==
        "issue.fund"
      )
        throw Error("Wrong storage key");
    } else
      this.setMeta(
        "encryption-check",
        this.seal({ value: "issue.fund" }, "key-check").toString("base64"),
      );
  }
  get(sql, ...args) {
    return this.db.prepare(sql).get(...args);
  }
  all(sql, ...args) {
    return this.db.prepare(sql).all(...args);
  }
  run(sql, ...args) {
    return this.db.prepare(sql).run(...args);
  }
  transaction(fn) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  getMeta(key) {
    const r = this.get("SELECT value FROM meta WHERE key=?", key);
    return r ? JSON.parse(r.value) : null;
  }
  setMeta(key, value) {
    this.run(
      "INSERT INTO meta VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      key,
      json(value),
    );
  }
  health(name, ok, code = null, now = Date.now()) {
    this.run(
      "INSERT INTO health VALUES (?,?,?,?) ON CONFLICT(name) DO UPDATE SET checked_at=excluded.checked_at,ok=excluded.ok,code=excluded.code",
      name,
      now,
      ok ? 1 : 0,
      code,
    );
  }
  healthy(name, maxAge, now = Date.now()) {
    const h = this.get("SELECT * FROM health WHERE name=?", name);
    return Boolean(
      h?.ok && h.checked_at <= now && now - h.checked_at <= maxAge,
    );
  }
  lease(name, owner, duration, now = Date.now()) {
    return this.transaction(() => {
      const row = this.get("SELECT * FROM leases WHERE name=?", name);
      if (row && row.until_at > now && row.owner !== owner) return false;
      this.run(
        "INSERT INTO leases VALUES (?,?,?) ON CONFLICT(name) DO UPDATE SET owner=excluded.owner,until_at=excluded.until_at",
        name,
        owner,
        now + duration,
      );
      return true;
    });
  }
  release(name, owner) {
    this.run("DELETE FROM leases WHERE name=? AND owner=?", name, owner);
  }
  seal(value, context) {
    const nonce = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, nonce);
    cipher.setAAD(Buffer.from(context));
    const encrypted = Buffer.concat([
      cipher.update(json(value)),
      cipher.final(),
    ]);
    return Buffer.concat([nonce, cipher.getAuthTag(), encrypted]);
  }
  open(bytes, context) {
    const input = Buffer.from(bytes);
    const decipher = createDecipheriv(
      "aes-256-gcm",
      this.key,
      input.subarray(0, 12),
    );
    decipher.setAAD(Buffer.from(context));
    decipher.setAuthTag(input.subarray(12, 28));
    return JSON.parse(
      Buffer.concat([
        decipher.update(input.subarray(28)),
        decipher.final(),
      ]).toString(),
    );
  }
  putReceipt({
    raw,
    prepared,
    repoId,
    now,
    maxBytes = 100_000_000,
    retentionMs = 30 * 86400_000,
  }) {
    const id = digest(
      prepared.receipt.headers +
        prepared.receipt.body +
        prepared.receipt.signature,
    );
    return this.transaction(() => {
      if (this.get("SELECT id FROM receipts WHERE id=?", id))
        return { id, duplicate: true };
      const cipher = this.seal(
        { raw: Buffer.from(raw).toString("base64"), prepared },
        `receipt:${id}`,
      );
      const bytes = this.get(
        "SELECT COALESCE(SUM(byte_length),0) AS bytes FROM receipts",
      ).bytes;
      if (bytes + cipher.length > maxBytes)
        throw Object.assign(Error("Receipt storage capacity reached"), {
          code: "storage_full",
        });
      const s = prepared.summary;
      this.run(
        "INSERT INTO receipts VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        id,
        repoId,
        s.kind,
        s.issue ?? null,
        s.pr,
        s.bountyRef ?? null,
        s.issuedAt,
        now,
        now + retentionMs,
        cipher,
        cipher.length,
      );
      return { id, duplicate: false };
    });
  }
  receipt(id) {
    const r = this.get("SELECT ciphertext FROM receipts WHERE id=?", id);
    if (!r)
      throw Object.assign(Error("Receipt unavailable"), {
        code: "receipt_missing",
      });
    return this.open(r.ciphertext, `receipt:${id}`);
  }
  expireReceipts(now = Date.now()) {
    // Release evidence only after terminal settlement AND its retention window.
    this.run(
      "UPDATE jobs SET merge_id=NULL,closure_id=NULL WHERE state IN ('credited','withdrawn','refunded') AND updated_at<?",
      now - 30 * 86400_000,
    );
    // Active queued/signed jobs retain evidence until they reach a terminal state.
    this.run(
      `DELETE FROM receipts WHERE expires_at<? AND id NOT IN (
      SELECT merge_id FROM jobs WHERE merge_id IS NOT NULL UNION SELECT closure_id FROM jobs WHERE closure_id IS NOT NULL
    )`,
      now,
    );
  }
  close() {
    this.db.close();
    this.key.fill(0);
  }
}
