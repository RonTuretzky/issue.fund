import { DatabaseSync, backup } from "node:sqlite";
import {
  mkdirSync,
  chmodSync,
  renameSync,
  rmSync,
  readdirSync,
  statSync,
  existsSync,
  writeFileSync,
  openSync,
  fsyncSync,
  closeSync,
} from "node:fs";
import { resolve, join, dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { safeCode } from "./errors.mjs";

function report(ok, databases) {
  const path = process.env.BACKUP_STATUS_FILE;
  if (!path) return;
  // The status directory is root-owned; the collector can only read this small
  // report, never the snapshots or backup credentials. Publish after both copies.
  const staging = `${path}.${randomUUID()}.partial`;
  try {
    writeFileSync(
      staging,
      JSON.stringify({ version: 1, ok, databases, checkedAt: Date.now() }) +
        "\n",
      { mode: 0o644, flag: "wx", flush: true },
    );
    chmodSync(staging, 0o644);
    renameSync(staging, path);
    const directory = openSync(dirname(path), "r");
    try {
      fsyncSync(directory);
    } finally {
      closeSync(directory);
    }
  } finally {
    rmSync(staging, { force: true });
  }
}

// Root-owned service timer: database copies never include the separate secret files.
try {
  process.umask(0o077);
  const directory = resolve(
    process.env.BACKUP_DIRECTORY ?? "/var/backups/issue-fund",
  );
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  chmodSync(directory, 0o700);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const sources = process.env.BACKUP_SOURCES?.split(",") ?? [
    "/var/lib/issue-fund/collector.sqlite",
    "/var/lib/issue-fund-signer/signer.sqlite",
  ];
  for (const [index, path] of sources.entries()) {
    if (!existsSync(path)) throw Error("Database missing");
    const target = join(directory, `${stamp}-${index}.sqlite`);
    const staging = target + ".partial";
    const db = new DatabaseSync(path, { readOnly: true });
    try {
      await backup(db, staging);
    } finally {
      db.close();
    }
    chmodSync(staging, 0o600);
    const copy = new DatabaseSync(staging, { readOnly: true });
    try {
      if (copy.prepare("PRAGMA integrity_check").get().integrity_check !== "ok")
        throw Error("Backup verification failed");
    } finally {
      copy.close();
    }
    renameSync(staging, target);
  }
  for (const name of readdirSync(directory)) {
    if (!/^\d{4}-\d{2}-\d{2}T[\dTZ-]+-\d+\.sqlite(?:\.partial)?$/.test(name))
      continue;
    const path = join(directory, name);
    if (statSync(path).mtimeMs < Date.now() - 30 * 86400_000) rmSync(path);
  }
  report(true, sources.length);
  console.log(
    JSON.stringify({
      event: "backup_verified",
      databases: sources.length,
      at: stamp,
    }),
  );
} catch (error) {
  try {
    report(false, 0);
  } catch {
    /* A stale/missing report also fails the probe. */
  }
  console.error(
    JSON.stringify({ event: "backup_failed", code: safeCode(error) }),
  );
  process.exitCode = 1;
}
