import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { Store } from "../../automation/store.mjs";
import {
  ChainIndexer,
  bountyKey,
  referenceFor,
} from "../../automation/indexer.mjs";

function fixture(t, count, batchSize = 3) {
  const directory = mkdtempSync(join(tmpdir(), "issue-fund-indexer-"));
  const key = randomBytes(32),
    path = join(directory, "collector.sqlite");
  let store = new Store(path, key),
    time = 1_000_000,
    fork = false,
    changeDuringScan = false,
    head = 20n;
  const d = {
    chainId: 31337,
    contract: `0x${"11".repeat(20)}`,
    fromBlock: 1,
    abi: [],
    keyHash: `0x${"22".repeat(32)}`,
  };
  const hash = (number) =>
    `0x${(BigInt(number) + (fork && number > 5 ? 10000n : 0n)).toString(16).padStart(64, "0")}`;
  const logs = Array.from({ length: count }, (_, i) => ({
    eventName: "Funded",
    args: {
      id: BigInt(i + 1),
      bountyRef: referenceFor(d.chainId, d.contract, i + 1),
    },
    blockNumber: 2n,
    blockHash: hash(2),
    transactionHash: hash(100 + i),
    logIndex: i,
  }));
  const statuses = new Map(),
    failures = new Set(),
    reads = [],
    registrations = [];
  const client = {
    async getChainId() {
      return d.chainId;
    },
    async getBlockNumber() {
      return head;
    },
    async getBlock({ blockNumber }) {
      return { hash: hash(Number(blockNumber)) };
    },
    async getContractEvents({ fromBlock, toBlock }) {
      if (changeDuringScan) fork = true;
      return logs.filter(
        (l) => l.blockNumber >= fromBlock && l.blockNumber <= toBlock,
      );
    },
    async readContract({ args: [id] }) {
      reads.push(Number(id));
      if (failures.has(Number(id))) throw Error("unavailable RPC result");
      return {
        repo: "example/project",
        issue: 42n,
        branch: "main",
        pr: 0n,
        amount: 1000n,
        createdAt: 900n,
        deadline: 3000n,
        status: statuses.get(Number(id)) ?? 0,
        recipient: `0x${"33".repeat(20)}`,
      };
    },
  };
  const make = () =>
    new ChainIndexer({
      store,
      client,
      deployments: [d],
      collector: { pair() {} },
      registry: {
        async prepare(url) {
          registrations.push(url);
          throw Error("not enrolled");
        },
      },
      confirmations: 0,
      now: () => time,
      batchSize,
    });
  let indexer = make();
  const f = {
    d,
    logs,
    reads,
    failures,
    statuses,
    registrations,
    get store() {
      return store;
    },
    async poll() {
      reads.length = 0;
      await indexer.poll();
    },
    restart() {
      store.close();
      store = new Store(path, key);
      indexer = make();
    },
    advance(ms) {
      time += ms;
    },
    reorg() {
      fork = true;
    },
    reorgDuringScan() {
      changeDuringScan = true;
    },
    advanceHead(value) {
      head = BigInt(value);
    },
    job(id) {
      return store.get(
        "SELECT * FROM jobs WHERE bounty_key=?",
        bountyKey(d.chainId, d.contract, id),
      );
    },
  };
  t.after(() => {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  });
  return f;
}

test("funding backlog survives restart, yields bounded reads, and sweeps every active bounty fairly", async (t) => {
  const f = fixture(t, 13);
  await f.poll();
  assert.equal(f.store.get("SELECT count(*) AS n FROM chain_events").n, 13);
  assert.equal(f.store.get("SELECT count(*) AS n FROM bounties").n, 3);
  assert.equal(f.store.get("SELECT count(*) AS n FROM index_pending").n, 10);
  f.restart();
  for (let i = 0; i < 5; i++) {
    await f.poll();
    assert.ok(f.reads.length <= 6);
  }
  assert.equal(f.store.get("SELECT count(*) AS n FROM bounties").n, 13);
  assert.equal(f.store.get("SELECT count(*) AS n FROM index_pending").n, 0);
  assert.equal(
    f.registrations.length,
    1,
    "unenrolled issue discovery is throttled across restarts",
  );
  const seen = new Set();
  for (let i = 0; i < 7; i++) {
    f.restart();
    await f.poll();
    assert.ok(f.reads.length <= 3);
    for (const id of f.reads) seen.add(id);
  }
  assert.equal(
    seen.size,
    13,
    "sweep progress is durable and wraps without starvation",
  );
});

test("one failed bounty cannot lose its funding event or block later bounties", async (t) => {
  const f = fixture(t, 7);
  f.failures.add(1);
  await f.poll();
  assert.equal(f.store.get("SELECT count(*) AS n FROM bounties").n, 2);
  assert.equal(f.store.get("SELECT ok FROM health WHERE name='chain'").ok, 0);
  f.restart();
  for (let i = 0; i < 4; i++) await f.poll();
  assert.equal(f.store.get("SELECT count(*) AS n FROM bounties").n, 6);
  assert.equal(f.store.get("SELECT count(*) AS n FROM index_pending").n, 1);
  f.failures.clear();
  f.advance(30_001);
  await f.poll();
  assert.equal(f.store.get("SELECT count(*) AS n FROM bounties").n, 7);
  assert.equal(f.store.get("SELECT count(*) AS n FROM chain_events").n, 7);
  assert.equal(f.store.get("SELECT count(*) AS n FROM index_pending").n, 0);
  assert.equal(f.store.get("SELECT ok FROM health WHERE name='chain'").ok, 1);
});

test("reorg rereads settled bounties and clears orphaned settlement without repository enrollment", async (t) => {
  const f = fixture(t, 2);
  f.statuses.set(1, 2);
  f.statuses.set(2, 1);
  await f.poll();
  f.store.run(
    "UPDATE jobs SET state='withdrawn' WHERE bounty_key=?",
    bountyKey(f.d.chainId, f.d.contract, 2),
  );
  assert.equal(f.job(1).state, "refunded");
  assert.equal(f.job(2).state, "withdrawn");
  // Move beyond the rollback window: the funding stays canonical while the
  // later settlement is orphaned. Terminal jobs still need reconciliation.
  f.advanceHead(6020);
  for (let i = 0; i < 12; i++) await f.poll();
  f.statuses.clear();
  f.reorg();
  f.restart();
  await f.poll();
  for (const id of [1, 2]) {
    assert.equal(f.job(id).state, "waiting");
    assert.equal(f.job(id).code, "chain_reorganization");
    assert.equal(f.job(id).terminal_at, null);
  }
});

test("invalid funding evidence cannot commit a partial event range or advance its checkpoint", async (t) => {
  const f = fixture(t, 2);
  f.logs[1].args.bountyRef = `0x${"ff".repeat(32)}`;
  await f.poll();
  assert.equal(f.store.get("SELECT count(*) AS n FROM chain_events").n, 0);
  assert.equal(f.store.get("SELECT count(*) AS n FROM index_pending").n, 0);
  assert.equal(f.store.getMeta(`chain:${f.d.chainId}:${f.d.contract}`), null);
  assert.equal(
    f.store.get("SELECT code FROM health WHERE name='chain'").code,
    "funding_reference_invalid",
  );
});

test("a reorg during log retrieval cannot checkpoint events from the old chain", async (t) => {
  const f = fixture(t, 2);
  f.reorgDuringScan();
  await f.poll();
  assert.equal(f.store.get("SELECT count(*) AS n FROM chain_events").n, 0);
  assert.equal(f.store.getMeta(`chain:${f.d.chainId}:${f.d.contract}`), null);
  assert.equal(
    f.store.get("SELECT code FROM health WHERE name='chain'").code,
    "chain_reorganization",
  );
  await f.poll();
  assert.equal(f.store.get("SELECT count(*) AS n FROM bounties").n, 2);
});
