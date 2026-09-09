// Run as root on the dedicated service host; prints checks, never credentials.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  readFileSync,
  readdirSync,
  statSync,
  mkdtempSync,
  copyFileSync,
  rmSync,
  readlinkSync,
} from "node:fs";
import { join } from "node:path";
import { Store } from "../../automation/store.mjs";
import { keyFile } from "../../automation/config.mjs";
import { SignerClient } from "../../automation/signer-ipc.mjs";
const command = (name, args) =>
  execFileSync(name, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
try {
  assert.equal((await fetch("http://127.0.0.1:4320/healthz")).status, 200);
  for (const service of ["issue-fund", "issue-fund-signer", "caddy"])
    assert.equal(command("systemctl", ["is-active", service]), "active");
  assert.notEqual(
    spawnSync("runuser", [
      "-u",
      "issue-fund",
      "--",
      "test",
      "-r",
      "/etc/issue-fund/signer/relay.key",
    ]).status,
    0,
  );
  assert.notEqual(
    spawnSync("runuser", [
      "-u",
      "issue-fund-signer",
      "--",
      "test",
      "-r",
      "/etc/issue-fund/collector/service.env",
    ]).status,
    0,
  );
  for (const path of [
    "/etc/issue-fund/signer/relay.key",
    "/etc/issue-fund/collector/service.env",
  ])
    assert.equal(statSync(path).mode & 0o077, 0);
  const signerPid = command("systemctl", [
    "show",
    "issue-fund-signer",
    "--property=MainPID",
    "--value",
  ]);
  assert.notEqual(
    readlinkSync(`/proc/${signerPid}/ns/net`),
    readlinkSync("/proc/1/ns/net"),
  );
  await assert.rejects(
    new SignerClient("/run/issue-fund-ipc/signer.sock").sign({
      chainId: 1,
      to: "0x1111111111111111111111111111111111111111",
      value: "0",
      gas: "21000",
      gasPrice: "1",
      nonce: 0,
      data: "0x",
    }),
    { code: "signer_policy_rejected" },
  );
  command("systemctl", ["start", "issue-fund-backup.service"]);
  const backupReport = "/var/lib/issue-fund-health/backup.json";
  assert.equal(statSync(backupReport).uid, 0);
  assert.equal(
    spawnSync("runuser", ["-u", "issue-fund", "--", "test", "-r", backupReport])
      .status,
    0,
  );
  assert.notEqual(
    spawnSync("runuser", ["-u", "issue-fund", "--", "test", "-w", backupReport])
      .status,
    0,
  );
  assert.notEqual(
    spawnSync("runuser", [
      "-u",
      "issue-fund",
      "--",
      "test",
      "-w",
      "/var/lib/issue-fund-health",
    ]).status,
    0,
  );
  const operational = await fetch(
    "http://127.0.0.1:4320/v1/health/operational",
  );
  assert.equal(operational.status, 200);
  assert.equal((await operational.json()).checks.backup, true);
  const backups = readdirSync("/var/backups/issue-fund")
    .filter((x) => x.endsWith(".sqlite"))
    .sort();
  const directory = mkdtempSync("/var/tmp/issue-fund-restore-");
  const results = [];
  try {
    for (const [index, role] of ["collector", "signer"].entries()) {
      const name = backups.filter((x) => x.endsWith(`-${index}.sqlite`)).at(-1);
      assert.ok(name);
      const path = join(directory, role + ".sqlite");
      copyFileSync(join("/var/backups/issue-fund", name), path);
      const store = new Store(
        path,
        keyFile(`/etc/issue-fund/${role}/storage.key`),
      );
      try {
        assert.equal(store.get("PRAGMA integrity_check").integrity_check, "ok");
        // Opening Store already authenticated the encrypted key marker in the restored DB.
        results.push({
          role,
          restore: "ok",
          bounties: store.get("SELECT COUNT(*) AS n FROM bounties").n,
          transactions: store.get("SELECT COUNT(*) AS n FROM transactions").n,
        });
      } finally {
        store.close();
      }
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
  console.log(
    JSON.stringify({
      service: "healthy",
      secretIsolation: "passed",
      signerNetworkIsolation: "passed",
      invalidSignRequest: "rejected",
      operationalProbe: "healthy",
      backupReportIsolation: "passed",
      restore: results,
    }),
  );
} catch (error) {
  console.error(
    JSON.stringify({ verification: "failed", check: error.code ?? error.name }),
  );
  process.exitCode = 1;
}
