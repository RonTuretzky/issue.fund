import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, chmodSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  readSecret,
  readValidation,
  readRiskAcceptance,
} from "../../automation/config.mjs";
import { SignerClient, serveSigner } from "../../automation/signer-ipc.mjs";
import { ServiceError } from "../../automation/errors.mjs";

test("Unix signer IPC carries requests privately and exposes only enumerated errors", async () => {
  const dir = mkdtempSync("/tmp/issue-fund-ipc-");
  const socket = join(dir, "s.sock");
  const seen = [];
  const signer = {
    async sign(input) {
      seen.push(input);
      if (input.fail) throw new ServiceError("signer_policy_rejected", 422);
      return "0x1234";
    },
  };
  const server = await serveSigner(socket, signer);
  try {
    const client = new SignerClient(socket);
    assert.equal(await client.sign({ chainId: 31337 }), "0x1234");
    assert.deepEqual(seen, [{ chainId: 31337 }]);
    await assert.rejects(client.sign({ fail: true }), {
      code: "signer_policy_rejected",
    });
    await assert.rejects(serveSigner(socket, signer), {
      code: "signer_socket_already_exists",
    });
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  }
});

test("group/world-readable secret files and incomplete live-validation records fail closed", () => {
  const dir = mkdtempSync("/tmp/issue-fund-config-");
  try {
    const path = join(dir, "secret");
    writeFileSync(path, "only-a-local-test-value", { mode: 0o600 });
    assert.equal(readSecret(path), "only-a-local-test-value");
    chmodSync(path, 0o640);
    assert.throws(() => readSecret(path), { code: "secret_file_permissions" });
    writeFileSync(
      path,
      JSON.stringify({
        version: 1,
        collectorId: 78,
        mailHost: "imap.gmail.com",
        mailAddress: "collector@example.invalid",
        tests: {},
      }),
    );
    const mailbox = {
      githubId: 78,
      host: "imap.gmail.com",
      address: "collector@example.invalid",
    };
    assert.equal(readValidation(null, mailbox), null);
    assert.throws(() => readValidation(path, mailbox), {
      code: "disclosure_validation_incomplete",
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("operator risk acceptance is explicit and scoped to the exact collector mailbox", () => {
  const dir = mkdtempSync("/tmp/issue-fund-acceptance-");
  const path = join(dir, "acceptance.json");
  const mailbox = {
    githubId: 78,
    host: "imap.gmail.com",
    address: "collector@example.invalid",
  };
  const record = {
    version: 1,
    mode: "operator-risk-accepted",
    collectorId: 78,
    mailHost: mailbox.host,
    mailAddress: mailbox.address,
    acceptCollectorReplyTokenExposure: true,
    acceptReversibleLocks: true,
    acceptedAt: "2026-09-10T15:00:00Z",
  };
  try {
    assert.equal(readRiskAcceptance(null, mailbox), null);
    for (const change of [
      { collectorId: 79 },
      { mailAddress: "other@example.invalid" },
      { mailHost: "other.example" },
      { acceptCollectorReplyTokenExposure: false },
      { acceptReversibleLocks: false },
      { mode: "validated" },
      { acceptedAt: "invalid" },
    ]) {
      writeFileSync(path, JSON.stringify({ ...record, ...change }), {
        mode: 0o600,
      });
      assert.throws(() => readRiskAcceptance(path, mailbox), {
        code: "disclosure_acceptance_invalid",
      });
    }
    writeFileSync(path, JSON.stringify(record), { mode: 0o600 });
    assert.match(readRiskAcceptance(path, mailbox), /^0x[0-9a-f]{64}$/);
    assert.throws(() => readValidation(path, mailbox), {
      code: "disclosure_validation_incomplete",
    });
    chmodSync(path, 0o644);
    assert.throws(() => readRiskAcceptance(path, mailbox), {
      code: "secret_file_permissions",
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
