import { DatabaseSync, backup } from "node:sqlite";
import {
  mkdirSync,
  chmodSync,
  renameSync,
  rmSync,
  readdirSync,
  statSync,
  existsSync,
} from "node:fs";
import { resolve, join } from "node:path";
import { safeCode } from "./errors.mjs";

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
  console.log(
    JSON.stringify({
      event: "backup_verified",
      databases: sources.length,
      at: stamp,
    }),
  );
} catch (error) {
  console.error(
    JSON.stringify({ event: "backup_failed", code: safeCode(error) }),
  );
  process.exitCode = 1;
}
