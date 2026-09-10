import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { Store } from "../../automation/store.mjs";
import { Registry } from "../../automation/registry.mjs";
import { GitHub, parseIssueUrl } from "../../automation/github.mjs";
import { DisclosureGate } from "../../automation/disclosure.mjs";
import { createApi } from "../../automation/api.mjs";

const now = 1809700000000;
const repo = {
  id: 1,
  owner: { id: 2, login: "example" },
  full_name: "example/parser",
  default_branch: "main",
  private: false,
  visibility: "public",
  has_issues: true,
};
function fixture() {
  const store = new Store(":memory:", randomBytes(32));
  let watchWrites = 0,
    issueNumber = 42,
    collab = false,
    locked = false,
    locksFail = false;
  const github = {
    async request(path, options = {}) {
      if (path === "/repos/example/parser") return { data: repo };
      if (path.includes("/lock")) {
        if (!locksFail) locked = true;
        return { status: 204 };
      }
      if (path.includes("/pulls/"))
        return {
          data: {
            number: 43,
            merged: true,
            locked,
            base: { repo, ref: "main" },
          },
        };
      if (path.includes("/issues/"))
        return {
          data: {
            id: 100 + issueNumber,
            number: issueNumber,
            state: this.closed ? "closed" : "open",
            locked,
          },
        };
      throw Error(`unexpected test request: ${path}`);
    },
    async installation() {
      return { id: 3 };
    },
    async installationToken() {
      return "synthetic-app-token";
    },
    async collectorIdentity() {
      return { id: 78, login: "collector" };
    },
    async assertOutsideCollector() {
      if (collab)
        throw Object.assign(Error("not eligible"), { secret: "do-not-log" });
    },
    async watch() {
      if (!this.watching) watchWrites++;
      this.watching = true;
      return { subscribed: true };
    },
  };
  const registry = new Registry({
    store,
    github,
    now: () => now,
    validationId: "test-only",
  });
  return {
    store,
    registry,
    github,
    watches: () => watchWrites,
    issue: (n) => {
      issueNumber = n;
    },
    setCollaborator: (b) => {
      collab = b;
    },
    failLocks: () => {
      locksFail = true;
    },
  };
}

test("issue-first admission is durable and reuses one repository subscription", async () => {
  const f = fixture();
  await f.registry.prepare("https://github.com/example/parser/issues/42");
  f.issue(44);
  await f.registry.prepare("https://github.com/example/parser/issues/44");
  assert.equal(f.watches(), 1);
  assert.equal(f.store.get("SELECT count(*) AS n FROM repositories").n, 1);
  assert.equal(f.store.get("SELECT count(*) AS n FROM issues").n, 2);
  f.setCollaborator(true);
  await f.registry.reconcile(1);
  assert.equal(f.registry.status(142).state, "attention");
  assert.equal(f.registry.status(142).watchedAt, null);
  f.store.close();
});

test("public sponsors cannot enable locks without installation and admission limits are atomic", async () => {
  const f = fixture();
  f.registry.maxIssues = 1;
  await f.registry.prepare("https://github.com/example/parser/issues/42");
  f.issue(44);
  await assert.rejects(
    f.registry.prepare("https://github.com/example/parser/issues/44"),
    { code: "issue_capacity_reached" },
  );
  assert.equal(f.store.get("SELECT count(*) AS n FROM issues").n, 1);
  f.github.installation = async () => {
    throw Error("installation missing");
  };
  await assert.rejects(
    f.registry.prepare("https://github.com/example/parser/issues/42"),
  );
  f.store.close();
});

test("fine-grained PAT verifies an existing public watch without claiming write support", async () => {
  let state = "SUBSCRIBED",
    calls = 0;
  const github = new GitHub({
    collectorToken: "github_pat_not-a-real-token",
    fetcher: async (url, options) => {
      calls++;
      assert.equal(url, "https://api.github.com/graphql");
      const body = JSON.parse(options.body);
      assert.match(body.query, /^query/);
      assert.deepEqual(body.variables, { owner: "example", name: "parser" });
      return Response.json({
        data: {
          repository: {
            nameWithOwner: "example/parser",
            isPrivate: false,
            viewerSubscription: state,
          },
        },
      });
    },
  });
  assert.deepEqual(await github.watch("example/parser"), {
    subscribed: true,
    ignored: false,
  });
  for (state of ["UNSUBSCRIBED", "IGNORED", null, "UNAVAILABLE"])
    await assert.rejects(github.watch("example/parser"), {
      code: "classic_watch_token_required",
    });
  assert.equal(calls, 5);
  for (const url of [
    "http://github.com/example/parser/issues/1",
    "https://user:pass@github.com/example/parser/issues/1",
    "https://github.com.example/parser/issues/1",
    "https://github.com/example/parser/pull/1",
  ])
    assert.throws(() => parseIssueUrl(url));
});

test("GraphQL partial errors, private repos and mismatched identities never establish watching", async () => {
  const valid = {
    nameWithOwner: "example/parser",
    isPrivate: false,
    viewerSubscription: "SUBSCRIBED",
  };
  for (const [body, code] of [
    [
      {
        data: { repository: valid },
        errors: [{ type: "FORBIDDEN", message: "private provider details" }],
      },
      "github_permissions_missing",
    ],
    [{ errors: [{ type: "RATE_LIMITED" }] }, "github_rate_limited"],
    [
      { data: { repository: { ...valid, isPrivate: true } } },
      "repository_identity_changed",
    ],
    [
      { data: { repository: { ...valid, nameWithOwner: "someone/else" } } },
      "repository_identity_changed",
    ],
    [{ data: { repository: null } }, "repository_identity_changed"],
  ]) {
    const github = new GitHub({
      collectorToken: "github_pat_test",
      fetcher: async () => Response.json(body),
    });
    await assert.rejects(
      github.watch("example/parser"),
      (error) =>
        error.code === code &&
        !error.message.includes("private provider details"),
    );
  }
});

test("no disclosure passes until both conversations are locked and the collector is outside", async () => {
  const f = fixture();
  await f.registry.prepare("https://github.com/example/parser/issues/42");
  f.github.closed = true;
  const gate = new DisclosureGate({
    github: f.github,
    store: f.store,
    mailbox: { login: "collector", githubId: 78 },
    validationId: "test-only",
    now: () => now,
  });
  f.failLocks();
  await assert.rejects(
    gate.check({ repo: repo.full_name, issue: 42, branch: "main" }, { pr: 43 }),
    { code: "conversation_lock_required" },
  );
  gate.validationId = null;
  await assert.rejects(
    gate.check({ repo: repo.full_name, issue: 42, branch: "main" }, { pr: 43 }),
    { code: "disclosure_validation_pending" },
  );
  f.store.close();
});

test("public API limits preparation, rejects foreign origins, and never returns provider errors", async () => {
  const f = fixture();
  const app = createApi({
    store: f.store,
    registry: f.registry,
    now: () => now,
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await fetch(base + "/healthz")).status, 200);
    assert.equal(
      (
        await fetch(base + "/v1/health", {
          headers: { Origin: "https://evil.example" },
        })
      ).status,
      403,
    );
    f.registry.prepare = async () => {
      throw Error("RAW EMAIL AND SECRET CREDENTIAL");
    };
    const result = await fetch(base + "/v1/issues/prepare", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://issue.fund",
      },
      body: JSON.stringify({
        url: "https://github.com/example/parser/issues/42",
      }),
    });
    assert.equal(
      result.headers.get("access-control-allow-origin"),
      "https://issue.fund",
    );
    assert.deepEqual(await result.json(), { code: "service_unavailable" });
    for (let i = 0; i < 5; i++)
      await fetch(base + "/v1/issues/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: '{"url":"https://github.com/example/parser/issues/42"}',
      });
    assert.equal(
      (
        await fetch(base + "/v1/issues/prepare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: '{"url":"https://github.com/example/parser/issues/42"}',
        })
      ).status,
      429,
    );
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    f.store.close();
  }
});
