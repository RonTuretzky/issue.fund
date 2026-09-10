import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Store } from "../../automation/store.mjs";
import { createApi } from "../../automation/api.mjs";
import { operationalHealth } from "../../automation/operational-health.mjs";

const now = 2_000_000_000_000;
function fixture(t) {
  const store = new Store(":memory:", randomBytes(32));
  t.after(() => store.close());
  const ready = () => {
    store.health("worker", true, null, now);
    store.health("chain", true, null, now);
  };
  return {
    store,
    ready,
    check: (options = {}) => operationalHealth({ store, now, ...options }),
  };
}

test("setup health is explicit, and missing, stale or future worker/chain heartbeats fail", (t) => {
  const f = fixture(t);
  assert.deepEqual(f.check().problems, ["worker", "chain"]);
  f.ready();
  f.store.health("mailbox", false, "mailbox_not_configured", now);
  assert.equal(f.check().status, "ok");
  assert.equal(f.check().mode, "setup");
  assert.equal(f.check().checks.mailbox, null);
  assert.equal(f.check().checks.disclosure, null);
  assert.deepEqual(f.check({ now: now + 120_001 }).problems, [
    "worker",
    "chain",
  ]);
  f.store.health("chain", true, null, now + 1);
  assert.deepEqual(f.check().problems, ["chain"]);
});

test("configured mail and automatic mode expose operational failures without private error details", (t) => {
  const f = fixture(t);
  f.ready();
  assert.deepEqual(f.check({ mailboxExpected: true }).problems, ["mailbox"]);
  f.store.health("mailbox", true, null, now);
  assert.deepEqual(f.check({ relayExpected: true }).problems, ["disclosure"]);
  f.store.health("relay", false, "private provider detail", now);
  f.store.run(
    "INSERT INTO repositories(id,full_name,owner_id,branch,prepared_at,error_code) VALUES (1,'example/private-detail',2,'main',?,'private error')",
    now,
  );
  const report = f.check({ relayExpected: true, disclosureAuthorized: true });
  assert.deepEqual(report.problems, ["relay", "repositories"]);
  assert.equal(report.mode, "automatic");
  assert.ok(!JSON.stringify(report).includes("private"));
  f.store.health("relay", true, null, now);
  f.store.run("UPDATE repositories SET error_code=NULL");
  assert.equal(
    f.check({ relayExpected: true, disclosureAuthorized: true }).status,
    "ok",
  );
});

test("backup health requires a recent successful report for both databases", (t) => {
  const f = fixture(t);
  f.ready();
  const directory = mkdtempSync(join(tmpdir(), "issue-fund-health-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const backupStatusFile = join(directory, "backup.json");
  const check = () => f.check({ backupStatusFile });
  assert.deepEqual(check().problems, ["backup"]);
  const valid = { version: 1, ok: true, databases: 2, checkedAt: now };
  for (const record of [
    { ...valid, ok: false },
    { ...valid, databases: 1 },
    { ...valid, checkedAt: now + 1 },
    { ...valid, checkedAt: now - 30 * 3600_000 - 1 },
    { ...valid, version: 2 },
    { ...valid, checkedAt: String(now) },
  ]) {
    writeFileSync(backupStatusFile, JSON.stringify(record));
    assert.deepEqual(check().problems, ["backup"]);
  }
  for (const bytes of ["invalid JSON", "x".repeat(4097)]) {
    writeFileSync(backupStatusFile, bytes);
    assert.equal(check().status, "degraded");
  }
  writeFileSync(backupStatusFile, JSON.stringify(valid));
  assert.equal(check().status, "ok");
});

test("operational endpoint returns 503 for a stalled worker while process health remains 200", async (t) => {
  const f = fixture(t);
  let clock = now;
  const server = createApi({
    store: f.store,
    registry: { validationId: null },
    now: () => clock,
  }).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await fetch(url + "/healthz")).status, 200);
    assert.equal((await fetch(url + "/v1/health/operational")).status, 503);
    f.ready();
    const ok = await fetch(url + "/v1/health/operational");
    assert.equal(ok.status, 200);
    assert.equal((await ok.json()).mode, "setup");
    clock += 120_001;
    const stale = await fetch(url + "/v1/health/operational");
    assert.equal(stale.status, 503);
    assert.deepEqual((await stale.json()).problems, ["worker", "chain"]);
    assert.equal((await fetch(url + "/healthz")).status, 200);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("health distinguishes accepted exposure from completed disclosure validation", async (t) => {
  const f = fixture(t);
  f.ready();
  f.store.health("mailbox", true, null, now);
  const registry = {
    validationId: null,
    riskAcceptanceId: "operator-accepted",
  };
  const server = createApi({
    store: f.store,
    registry,
    now: () => now,
    monitoring: { relayExpected: true },
  }).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    const health = await (await fetch(url + "/v1/health")).json();
    assert.equal(health.disclosureValidated, false);
    assert.equal(health.disclosureAuthorized, true);
    assert.equal(health.disclosurePolicy, "operator-risk-accepted");
    assert.equal((await fetch(url + "/v1/health/operational")).status, 200);
    registry.riskAcceptanceId = null;
    assert.equal((await fetch(url + "/v1/health/operational")).status, 503);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
