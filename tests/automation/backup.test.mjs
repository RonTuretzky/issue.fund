import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, statSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Store } from "../../automation/store.mjs";

test("online backup restores encrypted records and metadata while the writer stays open", async () => {
  const dir = mkdtempSync(join(tmpdir(), "issue-fund-backup-"));
  const key = randomBytes(32);
  const store = new Store(join(dir, "live.sqlite"), key);
  try {
    store.setMeta("progress", { uid: 123 });
    store.setMeta(
      "encrypted",
      store.seal({ secret: "original bytes" }, "fixture").toString("base64"),
    );
    const output = join(dir, "backups");
    await promisify(execFile)(process.execPath, ["automation/backup.mjs"], {
      env: {
        ...process.env,
        BACKUP_DIRECTORY: output,
        BACKUP_SOURCES: join(dir, "live.sqlite"),
      },
    });
    const files = readdirSync(output).filter((x) => x.endsWith(".sqlite"));
    assert.equal(files.length, 1);
    const path = join(output, files[0]);
    assert.equal(statSync(path).mode & 0o077, 0);
    const restored = new Store(path, key);
    try {
      assert.deepEqual(restored.getMeta("progress"), { uid: 123 });
      assert.deepEqual(
        restored.open(
          Buffer.from(restored.getMeta("encrypted"), "base64"),
          "fixture",
        ),
        { secret: "original bytes" },
      );
      store.setMeta("progress", { uid: 124 });
      assert.equal(restored.getMeta("progress").uid, 123);
    } finally {
      restored.close();
    }
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
