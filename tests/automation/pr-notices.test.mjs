import test from "node:test";
import assert from "node:assert/strict";
import { Store } from "../../automation/store.mjs";
import {
  noticeFor,
  noticeMarker,
  PrNoticeWorker,
} from "../../automation/pr-notices.mjs";

const bounty = {
  repo: "example/project",
  issue: 42,
  status: 0,
  deadline: 9999999999,
  branch: "main",
  chainId: 100,
  contract: `0x${"11".repeat(20)}`,
  id: 2,
  bountyRef: `0x${"22".repeat(32)}`,
};
const pr = () => ({
  number: 8,
  state: "open",
  title: `[bounty ${bounty.bountyRef}] [wallet 0x${"33".repeat(20)}] Fix bug`,
  body: "Closes #42",
  base: {
    ref: "main",
    repo: { private: false, full_name: bounty.repo, default_branch: "main" },
  },
});

test("notice explains closure, conditional settlement, wallet and locking; flags invalid preparation", () => {
  const body = noticeFor(pr(), [bounty]);
  assert.match(body, /will close/);
  assert.match(body, /start the bounty claim process/);
  assert.match(body, /not a guarantee/);
  assert.match(body, /Lock the closed issue/);
  assert.match(body, /Any subscriber/);
  assert.match(body, /33333333/);
  assert.match(
    noticeFor({ ...pr(), base: { ...pr().base, ref: "develop" } }, [bounty]),
    /Not claim-ready:\*\* Target branch/,
  );
  assert.match(
    noticeFor({ ...pr(), title: "Fix bug" }, [bounty]),
    /wallet marker missing/,
  );
  for (const body of [
    "Fixes other/repo#42",
    "<!-- Closes #42 -->",
    "```\nCloses #42\n```",
    "> Closes #42",
    "Closes #420",
  ])
    assert.equal(noticeFor({ ...pr(), body }, [bounty]), null);
  assert.equal(noticeFor(pr(), [{ ...bounty, status: 1 }]), null);
  assert.equal(noticeFor(pr(), [{ ...bounty, deadline: 1 }]), null);
});

test("worker creates one App-owned comment, updates edits, ignores spoofed markers and withdraws stale notices", async (t) => {
  const store = new Store(":memory:", Buffer.alloc(32));
  t.after(() => store.close());
  store.run(
    "INSERT INTO repositories(id,full_name,owner_id,branch,installation_id,prepared_at) VALUES (1,?,2,'main',9,0)",
    bounty.repo,
  );
  store.run(
    "INSERT INTO bounties VALUES (?,?,?,?,?,?,?,?,?,?,1,?)",
    "test",
    100,
    bounty.contract,
    "2",
    1,
    42,
    bounty.bountyRef,
    JSON.stringify(bounty),
    1,
    "hash",
    0,
  );
  let time = Date.now(),
    pull = pr();
  const comments = [
      {
        id: 1,
        body: noticeMarker + " fake",
        performed_via_github_app: { id: 999 },
      },
    ],
    writes = [];
  const github = {
    appId: "7",
    async installation() {
      return { id: 9 };
    },
    async installationToken() {
      return "app-token";
    },
    async request(path, opts) {
      assert.equal(opts.token, "app-token");
      if (opts.method === "POST") {
        writes.push("POST");
        comments.push({
          id: 2,
          body: opts.body.body,
          performed_via_github_app: { id: 7 },
        });
        // GitHub accepted the comment, but the response was lost.
        throw Error("connection interrupted after POST");
      }
      if (opts.method === "PATCH") {
        writes.push("PATCH");
        comments[1].body = opts.body.body;
        return { data: comments[1] };
      }
      return { data: path.includes("/pulls?") ? [pull] : comments };
    },
  };
  const worker = new PrNoticeWorker({ store, github, now: () => time });
  const poll = async () => {
    time += 120001;
    await worker.poll();
  };
  await poll();
  assert.equal(store.get("SELECT ok FROM health WHERE name='pr-notices'").ok, 0);
  await poll();
  assert.equal(store.get("SELECT ok FROM health WHERE name='pr-notices'").ok, 1);
  assert.deepEqual(writes, ["POST"]);
  pull = { ...pull, title: "Fix bug" };
  await poll();
  assert.match(comments[1].body, /Not claim-ready/);
  pull.body = "No closing reference";
  await poll();
  await poll();
  assert.match(comments[1].body, /no longer applicable/);
  assert.deepEqual(writes, ["POST", "PATCH", "PATCH"]);
});
