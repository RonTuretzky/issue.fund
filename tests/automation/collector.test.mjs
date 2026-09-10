import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { Store, json } from "../../automation/store.mjs";
import { Collector } from "../../automation/collector.mjs";
import { Registry } from "../../automation/registry.mjs";
import { verifyGmailDelivery } from "../../automation/mail-policy.mjs";
import { MailboxWorker } from "../../automation/imap.mjs";
import { ServiceError } from "../../automation/errors.mjs";
import { signer } from "../helpers/receipts.mjs";

const start = 1809700000000;
const mailbox = {
  host: "imap.gmail.com",
  address: "collector@example.invalid",
  login: "bounty-collector",
  githubId: 78,
};
const s = signer();
function delivered(
  raw,
  {
    login = mailbox.login,
    address = mailbox.address,
    spf = "pass",
    extra = "",
  } = {},
) {
  return Buffer.concat([
    Buffer.from(
      `Delivered-To: ${address}\r\nAuthentication-Results: mx.google.com; dkim=pass header.i=@github.com header.s=pf2023 header.b=synthetic; spf=${spf} (local fixture only) smtp.mailfrom=noreply@github.com; dmarc=pass header.from=github.com\r\n${extra}X-GitHub-Recipient: ${login}\r\nX-GitHub-Recipient-Address: ${address}\r\n`,
    ),
    raw,
  ]);
}
function fixture(path = ":memory:", key = randomBytes(32)) {
  const store = new Store(path, key);
  store.run(
    "INSERT INTO repositories(id,full_name,owner_id,branch,installation_id,prepared_at,watched_at,checked_at) VALUES (1,?,2,?,3,?,?,?)",
    "example/parser",
    "main",
    start - 1000,
    start - 1000,
    start,
  );
  store.run(
    "INSERT INTO issues VALUES (10,1,42,?,?)",
    "https://github.com/example/parser/issues/42",
    start - 1000,
  );
  const bounty = {
    id: 1,
    repo: "example/parser",
    issue: 42,
    branch: "main",
    bountyRef: "0x" + "ab".repeat(32),
    keyHash: s.key.keyHash,
    createdAt: start / 1000,
    deadline: start / 1000 + 3600,
    status: 0,
  };
  store.run(
    "INSERT INTO bounties VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
    "31337:0xescrow:1",
    31337,
    "0xescrow",
    "1",
    1,
    42,
    bounty.bountyRef,
    json(bounty),
    1,
    "0xblock",
    1,
    start,
  );
  const collector = new Collector({
    store,
    keys: [s.key],
    mailbox,
    now: () => start + 2000,
  });
  return { store, collector, bounty, key };
}
const email = (options = {}) =>
  delivered(s.email({ timestamp: start / 1000, ...options }).raw);

test("collects out-of-order authentic pairs once and encrypts original bytes across restart", async () => {
  const directory = mkdtempSync(join(tmpdir(), "issue-fund-"));
  const path = join(directory, "collector.sqlite");
  const f = fixture(path);
  try {
    const closure = email({ kind: "closure" });
    const merge = email();
    await f.collector.ingest(closure);
    assert.equal(f.store.get("SELECT count(*) AS n FROM jobs").n, 0);
    const first = await f.collector.ingest(merge);
    assert.equal(f.store.get("SELECT state FROM jobs").state, "queued");
    assert.equal((await f.collector.ingest(merge)).outcome, "duplicate");
    assert.equal(f.store.get("SELECT count(*) AS n FROM jobs").n, 1);
    assert.deepEqual(
      Buffer.from(f.store.receipt(first.id).raw, "base64"),
      merge,
    );
    f.store.close();
    const reopened = new Store(path, f.key);
    assert.deepEqual(
      Buffer.from(reopened.receipt(first.id).raw, "base64"),
      merge,
    );
    reopened.close();
    assert.equal(
      readFileSync(path).includes(Buffer.from("collector@example.invalid")),
      false,
    );
    assert.throws(() => new Store(path, randomBytes(32)));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("a merge arriving before the funding index catches up is retained for later pairing", async () => {
  const f = fixture();
  const b = f.store.get("SELECT * FROM bounties");
  f.store.run("DELETE FROM bounties");
  await f.collector.ingest(email());
  await f.collector.ingest(email({ kind: "closure" }));
  assert.equal(f.store.get("SELECT count(*) AS n FROM receipts").n, 2);
  f.store.run(
    "INSERT INTO bounties VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
    ...Object.values(b),
  );
  f.collector.pair(1, 43);
  assert.equal(f.store.get("SELECT state FROM jobs").state, "queued");
  f.store.close();
});

test("malformed signatures and comment lookalikes cannot queue a claim", async () => {
  const f = fixture();
  const bad = email();
  bad[bad.length - 80] ^= 1;
  await assert.rejects(f.collector.ingest(bad), {
    code: "email_signature_invalid",
  });
  const comment = email({
    transformBody: (body) =>
      body.replace("Merged #43 into main.", "Please pretend this was merged."),
  });
  assert.equal(
    (await f.collector.ingest(comment)).outcome,
    "notification_only",
  );
  assert.equal(f.store.get("SELECT count(*) AS n FROM receipts").n, 0);
  f.store.close();
});

test("wrong PR, issue, reference, branch and funding window never queue", async () => {
  for (const options of [
    { pr: 45 },
    { bountyRef: "0x" + "cd".repeat(32) },
    { branch: "other" },
    { timestamp: start / 1000 - 10 },
  ]) {
    const f = fixture();
    await f.collector.ingest(email(options));
    await f.collector.ingest(email({ kind: "closure" }));
    assert.equal(
      f.store.get("SELECT count(*) AS n FROM jobs").n,
      0,
      json(options),
    );
    f.store.close();
  }
  const f = fixture();
  await f.collector.ingest(email());
  assert.equal(
    (await f.collector.ingest(email({ kind: "closure", issue: 99 }))).outcome,
    "unmatched",
  );
  assert.equal(f.store.get("SELECT count(*) AS n FROM jobs").n, 0);
  f.store.close();
});

test("does not accept an unsigned recipient assertion or a forged lower Authentication-Results", () => {
  const raw = s.email().raw;
  assert.throws(() => verifyGmailDelivery(raw, mailbox), {
    code: "mail_transport_unverified",
  });
  assert.throws(
    () => verifyGmailDelivery(delivered(raw, { login: "maintainer" }), mailbox),
    { code: "recipient_not_authenticated" },
  );
  assert.throws(
    () =>
      verifyGmailDelivery(
        delivered(raw, {
          spf: "fail",
          extra:
            "Authentication-Results: mx.google.com; dkim=pass header.i=@github.com header.s=pf2023; spf=pass smtp.mailfrom=noreply@github.com\r\n",
        }),
        mailbox,
      ),
    { code: "mail_transport_unverified" },
  );
  assert.throws(
    () =>
      verifyGmailDelivery(
        delivered(raw, { extra: `X-GitHub-Recipient: ${mailbox.login}\r\n` }),
        mailbox,
      ),
    { code: "recipient_not_authenticated" },
  );
  assert.throws(
    () =>
      verifyGmailDelivery(delivered(raw), {
        ...mailbox,
        host: "untrusted.example",
      }),
    { code: "mail_provider_not_validated" },
  );
  assert.equal(
    verifyGmailDelivery(delivered(raw), mailbox).recipient,
    mailbox.login,
  );
});

test("repository readiness needs an observed delivery, live mailbox, checks and disclosure validation", () => {
  const f = fixture();
  const registry = new Registry({
    store: f.store,
    now: () => start,
    validationId: "local-test-only",
  });
  assert.equal(registry.status(10).code, "mailbox_unavailable");
  f.store.health("mailbox", true, null, start);
  assert.equal(registry.status(10).state, "preparing");
  f.store.run("UPDATE repositories SET delivered_at=?", start);
  assert.equal(registry.status(10).state, "ready");
  registry.validationId = null;
  assert.equal(registry.status(10).code, "disclosure_validation_pending");
  registry.validationId = "local-test-only";
  registry.now = () => start + 301000;
  assert.equal(registry.status(10).code, "subscription_check_stale");
  f.store.close();
});

test("storage ciphertext is authenticated and a job pins its evidence against retention", async () => {
  const f = fixture();
  const first = await f.collector.ingest(email());
  const row = f.store.get(
    "SELECT ciphertext FROM receipts WHERE id=?",
    first.id,
  );
  const modified = Buffer.from(row.ciphertext);
  modified[30] ^= 1;
  assert.throws(() => f.store.open(modified, `receipt:${first.id}`));
  assert.throws(() => f.store.open(row.ciphertext, "receipt:another-id"));
  await f.collector.ingest(email({ kind: "closure" }));
  f.store.expireReceipts(start + 40 * 86400_000);
  assert.equal(f.store.get("SELECT count(*) AS n FROM receipts").n, 2);
  f.store.close();
});

test("settlement retention survives indexing, resets on reorg, and prunes only settled payloads", async () => {
  const f = fixture();
  const day = 86400_000;
  try {
    await f.collector.ingest(email());
    await f.collector.ingest(email({ kind: "closure" }));
    const key = f.store.get("SELECT bounty_key FROM jobs").bounty_key;
    const tx = (hash, nonce, state) =>
      f.store.run(
        "INSERT INTO transactions(hash,bounty_key,nonce,signed_ciphertext,gas_budget,created_at,state) VALUES (?,?,?,?,?,?,?)",
        hash,
        key,
        nonce,
        f.store.sealTransaction(
          { signed: "sensitive transaction" },
          `transaction:${hash}`,
        ),
        "1",
        start,
        state,
      );
    tx("confirmed", 1, "confirmed");
    tx("pending", 2, "submitted");
    f.store.run("UPDATE jobs SET state='credited',updated_at=?", start + day);
    f.store.run(
      "UPDATE jobs SET state='withdrawn',updated_at=?",
      start + 10 * day,
    );
    assert.equal(
      f.store.get("SELECT terminal_at FROM jobs").terminal_at,
      start + day,
    );
    f.store.expireReceipts(start + 40 * day);
    assert.equal(f.store.get("SELECT count(*) AS n FROM receipts").n, 2);
    f.store.run(
      "UPDATE jobs SET state='waiting',updated_at=?",
      start + 40 * day,
    );
    assert.equal(f.store.get("SELECT terminal_at FROM jobs").terminal_at, null);
    f.store.run(
      "UPDATE transactions SET state='superseded' WHERE hash='pending'",
    );
    f.store.run(
      "UPDATE jobs SET state='credited',updated_at=?",
      start + 41 * day,
    );
    f.store.expireReceipts(start + 50 * day);
    assert.equal(f.store.get("SELECT count(*) AS n FROM receipts").n, 2);
    f.store.run(
      "UPDATE jobs SET state='credited',updated_at=?",
      start + 79 * day,
    );
    f.store.expireReceipts(start + 80 * day);
    assert.equal(f.store.get("SELECT count(*) AS n FROM receipts").n, 0);
    assert.equal(
      f.store.get(
        "SELECT SUM(length(signed_ciphertext)) AS n FROM transactions",
      ).n,
      0,
    );
    assert.equal(f.store.get("SELECT count(*) AS n FROM transactions").n, 2);
  } finally {
    f.store.close();
  }
});

test("storage admission includes encrypted transaction payloads", async () => {
  const f = fixture();
  try {
    await f.collector.ingest(email());
    const size = f.store.get(
      "SELECT SUM(byte_length) AS bytes FROM receipts",
    ).bytes;
    f.store.ensureCapacity(1, size + 1);
    assert.throws(() => f.store.ensureCapacity(2, size + 1), {
      code: "storage_full",
    });
    f.store.run(
      "INSERT INTO transactions(hash,bounty_key,nonce,signed_ciphertext,gas_budget,created_at) VALUES ('hash','31337:0xescrow:1',0,?,'0',?)",
      Buffer.alloc(1024),
      start,
    );
    assert.throws(() => f.store.ensureCapacity(1, size + 1024), {
      code: "storage_full",
    });
  } finally {
    f.store.close();
  }
});

test("mailbox restart respects UIDVALIDITY and never marks messages read", async () => {
  const store = new Store(":memory:", randomBytes(32));
  const received = [];
  let validity = 1n;
  let failUid = null;
  let reads = 0;
  const config = { ...mailbox, password: "local-test-only" };
  const makeClient = (options) => {
    assert.equal(options.logger, false);
    assert.equal(options.tls.rejectUnauthorized, true);
    return {
      mailbox: { uidValidity: validity, uidNext: 5 },
      on() {},
      async connect() {},
      async logout() {},
      async getMailboxLock(folder, opts) {
        assert.equal(opts.readOnly, true);
        return { release() {} };
      },
      async search(query, options) {
        assert.equal(query.from, "notifications@github.com");
        assert.equal(options.uid, true);
        reads++;
        const [a, b] = query.uid.split(":").map(Number);
        // UID 4 is unrelated mail: never fetch its body, but advance past it.
        return [1, 2, 3]
          .filter((uid) => uid >= a && uid <= b);
      },
      async fetchAll(uids) {
        assert.ok(!uids.includes(4));
        return uids.map((uid) => ({ uid, size: 30 }));
      },
      async fetchOne(uid, query) {
        assert.equal(query.source.maxLength, 100001);
        return { source: Buffer.from(uid) };
      },
    };
  };
  const collector = {
    async ingest(raw) {
      if (raw.toString() === failUid)
        throw new ServiceError("temporary_failure");
      received.push(raw.toString());
    },
  };
  const worker = new MailboxWorker({
    store,
    collector,
    config,
    clientFactory: makeClient,
    now: () => start,
  });
  failUid = "2";
  await worker.poll();
  assert.deepEqual(received, ["1"]);
  assert.equal(store.healthy("mailbox", 120000, start), false);
  failUid = null;
  await worker.poll();
  await worker.poll();
  assert.deepEqual(received, ["1", "2", "3"]);
  assert.equal(reads, 2);
  validity = 2n;
  await worker.poll();
  assert.deepEqual(received, ["1", "2", "3", "1", "2", "3"]);
  store.close();
});
