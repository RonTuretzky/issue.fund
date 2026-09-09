import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import net from "node:net";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import { createPublicClient, createWalletClient, http, parseEther } from "viem";
import { foundry } from "viem/chains";
import { mnemonicToAccount } from "viem/accounts";
import { signer as emailSigner } from "../helpers/receipts.mjs";
import { Store } from "../../automation/store.mjs";
import { Collector } from "../../automation/collector.mjs";
import { ChainIndexer } from "../../automation/indexer.mjs";
import { RelayWorker } from "../../automation/relay.mjs";
import { RestrictedSigner } from "../../automation/signer.mjs";
import { ServiceError } from "../../automation/errors.mjs";

const artifact = (name) =>
  JSON.parse(fs.readFileSync(`out/${name}.sol/${name}.json`));
const accounts = [0, 1, 2, 3].map((addressIndex) =>
  mnemonicToAccount(
    "test test test test test test test test test test test junk",
    { addressIndex },
  ),
);
const mailbox = {
  host: "imap.gmail.com",
  address: "collector@example.invalid",
  login: "collector",
  githubId: 78,
};

async function setup() {
  const server = net.createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  const anvil = spawn(
    "anvil",
    [
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      "--chain-id",
      "31337",
      "--gas-limit",
      "30000000",
      "--silent",
    ],
    { stdio: "ignore" },
  );
  const transport = http(`http://127.0.0.1:${port}`, {
    timeout: 15000,
    retryCount: 0,
  });
  const real = createPublicClient({ chain: foundry, transport, cacheTime: 0 });
  const wallet = createWalletClient({
    account: accounts[0],
    chain: foundry,
    transport,
  });
  for (let i = 0; i < 100; i++) {
    try {
      if ((await real.getChainId()) === 31337) break;
    } catch {
      /* startup only */
    }
    if (i === 99) {
      anvil.kill();
      throw Error("Anvil did not start");
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  const receipts = emailSigner();
  const deploy = async (name, args) => {
    const a = artifact(name);
    const hash = await wallet.deployContract({
      abi: a.abi,
      bytecode: a.bytecode.object,
      args,
    });
    return real.waitForTransactionReceipt({ hash });
  };
  const v = await deploy("GithubDkimVerifier", [receipts.key.modulus]);
  const e = await deploy("MergeBountyV2", [
    v.contractAddress,
    accounts[2].address,
    100n,
  ]);
  const d = {
    chainId: 31337,
    contract: e.contractAddress,
    abi: artifact("MergeBountyV2").abi,
    keyHash: receipts.key.keyHash,
    fromBlock: Number(e.blockNumber),
  };
  const read = (functionName, args = []) =>
    real.readContract({ address: d.contract, abi: d.abi, functionName, args });
  const now = Number((await real.getBlock()).timestamp);
  await wallet.writeContract({
    address: d.contract,
    abi: d.abi,
    functionName: "create",
    args: ["example/parser", 42n, "main", BigInt(now + 3600)],
    value: parseEther("1"),
  });
  const bounty = await read("getBounty", [1n]);
  const bountyRef = await read("referenceFor", [1n]);
  let clock = Number(bounty.createdAt) * 1000 + 1000;
  const store = new Store(":memory:", randomBytes(32)),
    signingStore = new Store(":memory:", randomBytes(32));
  store.run(
    "INSERT INTO repositories(id,full_name,owner_id,branch,installation_id,prepared_at,watched_at,checked_at) VALUES (1,?,2,?,3,?,?,?)",
    "example/parser",
    "main",
    clock - 2000,
    clock - 2000,
    clock,
  );
  store.run(
    "INSERT INTO issues VALUES (10,1,42,?,?)",
    "https://github.com/example/parser/issues/42",
    clock - 2000,
  );
  const collector = new Collector({
    store,
    keys: [receipts.key],
    mailbox,
    now: () => clock,
  });
  const indexer = new ChainIndexer({
    store,
    client: real,
    deployments: [d],
    collector,
    confirmations: 0,
    now: () => clock,
  });
  await indexer.poll();
  assert.equal(store.get("SELECT count(*) AS n FROM bounties").n, 1);
  const raw = (kind) =>
    Buffer.concat([
      Buffer.from(
        `Delivered-To: ${mailbox.address}\r\nAuthentication-Results: mx.google.com; dkim=pass header.i=@github.com header.s=pf2023; spf=pass smtp.mailfrom=noreply@github.com\r\nX-GitHub-Recipient: ${mailbox.login}\r\nX-GitHub-Recipient-Address: ${mailbox.address}\r\n`,
      ),
      receipts.email({
        kind,
        timestamp: Number(bounty.createdAt),
        bountyRef,
        wallet: accounts[3].address,
      }).raw,
    ]);
  await collector.ingest(raw("closure"));
  await collector.ingest(raw("merge"));
  assert.equal(store.get("SELECT state FROM jobs").state, "queued");
  const events = [];
  let denied = false,
    uncertain = false;
  const client = new Proxy(real, {
    get(target, name) {
      if (["simulateContract", "estimateContractGas"].includes(name))
        return async (...args) => {
          events.push(name);
          return target[name](...args);
        };
      if (name === "sendRawTransaction")
        return async (...args) => {
          events.push("broadcast");
          const result = await target[name](...args);
          if (uncertain) throw Error("response lost after acceptance");
          return result;
        };
      return target[name];
    },
  });
  const gate = {
    async check() {
      events.push("gate");
      if (denied) throw new ServiceError("conversation_lock_required", 409);
    },
  };
  const restricted = new RestrictedSigner({
    account: accounts[1],
    store: signingStore,
    deployments: [d],
    chainId: 31337,
  });
  const makeRelay = () =>
    new RelayWorker({
      store,
      client,
      signer: restricted,
      account: accounts[1].address,
      deployments: [d],
      gate,
      confirmations: 0,
      now: () => clock,
    });
  return {
    anvil,
    store,
    signingStore,
    indexer,
    client: real,
    wallet,
    d,
    read,
    makeRelay,
    events,
    deny: (value) => {
      denied = value;
    },
    loseResponse: (value) => {
      uncertain = value;
    },
    advance: (ms) => {
      clock += ms;
    },
    close: async () => {
      store.close();
      signingStore.close();
      const exited = once(anvil, "exit");
      anvil.kill("SIGTERM");
      await exited;
    },
  };
}

test(
  "locally signed RSA receipts pass collector → durable relay → V2 fee credits → withdrawal; restart recovers lost broadcast response",
  { timeout: 120000 },
  async () => {
    const f = await setup();
    try {
      f.deny(true);
      await f.makeRelay().tick();
      assert.deepEqual(f.events, ["gate"]);
      assert.equal(
        f.store.get("SELECT code FROM jobs").code,
        "conversation_lock_required",
      );
      assert.equal(await f.read("credits", [accounts[3].address]), 0n);
      f.deny(false);
      f.advance(60000);
      f.loseResponse(true);
      await f.makeRelay().tick();
      assert.deepEqual(f.events.slice(1), [
        "gate",
        "simulateContract",
        "estimateContractGas",
        "gate",
        "broadcast",
      ]);
      assert.equal(
        f.store.get("SELECT state FROM transactions").state,
        "signed",
      );
      assert.equal(
        await f.read("credits", [accounts[3].address]),
        parseEther("0.99"),
      );
      assert.equal(
        await f.read("credits", [accounts[2].address]),
        parseEther("0.01"),
      );
      const txCount = f.store.get("SELECT count(*) AS n FROM transactions").n;
      await f.makeRelay().tick();
      assert.equal(f.store.get("SELECT state FROM jobs").state, "credited");
      await f.makeRelay().tick();
      assert.equal(
        f.store.get("SELECT count(*) AS n FROM transactions").n,
        txCount,
      );
      await f.wallet.writeContract({
        account: accounts[3],
        address: f.d.contract,
        abi: f.d.abi,
        functionName: "withdraw",
        args: [accounts[3].address],
      });
      await f.indexer.poll();
      assert.equal(f.store.get("SELECT state FROM jobs").state, "withdrawn");
      assert.equal(await f.read("credits", [accounts[3].address]), 0n);
      assert.equal(
        await f.read("credits", [accounts[2].address]),
        parseEther("0.01"),
      );
    } finally {
      await f.close();
    }
  },
);

test(
  "depleted relay gas stops before signing and nonce reservation",
  { timeout: 120000 },
  async () => {
    const f = await setup();
    try {
      await f.client.request({
        method: "anvil_setBalance",
        params: [accounts[1].address, "0x0"],
      });
      await f.makeRelay().tick();
      assert.equal(
        f.store.get("SELECT code FROM jobs").code,
        "relay_needs_gas",
      );
      assert.equal(f.store.get("SELECT count(*) AS n FROM transactions").n, 0);
      assert.equal(await f.read("credits", [accounts[3].address]), 0n);
    } finally {
      await f.close();
    }
  },
);

test(
  "a pending claim is replaced at the same nonce and settles exactly once",
  { timeout: 120000 },
  async () => {
    const f = await setup();
    try {
      await f.client.request({ method: "evm_setAutomine", params: [false] });
      await f.makeRelay().tick();
      const first = f.store.get("SELECT * FROM transactions");
      assert.equal(first.state, "submitted");
      f.advance(180000);
      await f.makeRelay().tick();
      const rows = f.store.all(
        "SELECT hash,nonce,state FROM transactions ORDER BY created_at",
      );
      assert.equal(rows.length, 2);
      assert.equal(rows[0].nonce, rows[1].nonce);
      assert.equal(rows[0].state, "replaced");
      await f.client.request({ method: "evm_mine", params: [] });
      await f.makeRelay().tick();
      assert.equal(f.store.get("SELECT state FROM jobs").state, "credited");
      assert.equal(
        await f.read("credits", [accounts[3].address]),
        parseEther("0.99"),
      );
      assert.equal(
        await f.read("credits", [accounts[2].address]),
        parseEther("0.01"),
      );
    } finally {
      await f.close();
    }
  },
);

test(
  "a competing claim causes safe zero-value cancellation of our unused nonce",
  { timeout: 120000 },
  async () => {
    const f = await setup();
    try {
      await f.client.request({ method: "evm_setAutomine", params: [false] });
      await f.makeRelay().tick();
      const original = f.store.get("SELECT * FROM transactions");
      await f.client.request({
        method: "anvil_dropTransaction",
        params: [original.hash],
      });
      await f.client.request({ method: "evm_setAutomine", params: [true] });
      const job = f.store.get("SELECT * FROM jobs");
      const merged = f.store.receipt(job.merge_id).prepared.receipt;
      const closed = f.store.receipt(job.closure_id).prepared.receipt;
      await f.wallet.writeContract({
        address: f.d.contract,
        abi: f.d.abi,
        functionName: "claim",
        args: [1n, merged, closed],
      });
      await f.makeRelay().tick();
      assert.equal(f.store.get("SELECT count(*) AS n FROM transactions").n, 2);
      await f.makeRelay().tick();
      await f.indexer.poll();
      assert.equal(f.store.get("SELECT state FROM jobs").state, "credited");
      assert.equal(
        await f.read("credits", [accounts[2].address]),
        parseEther("0.01"),
      );
      assert.equal(
        await f.client.getTransactionCount({ address: accounts[1].address }),
        original.nonce + 1,
      );
    } finally {
      await f.close();
    }
  },
);

test(
  "an orphaned claim is re-observed and relayed again without a second final payout",
  { timeout: 120000 },
  async () => {
    const f = await setup();
    try {
      const snapshot = await f.client.request({
        method: "evm_snapshot",
        params: [],
      });
      await f.makeRelay().tick();
      await f.makeRelay().tick();
      await f.indexer.poll();
      assert.equal(f.store.get("SELECT state FROM jobs").state, "credited");
      await f.client.request({ method: "evm_revert", params: [snapshot] });
      await f.client.request({ method: "evm_mine", params: [] });
      await f.indexer.poll();
      assert.equal(await f.read("credits", [accounts[3].address]), 0n);
      for (let i = 0; i < 5; i++) {
        await f.makeRelay().tick();
        if (f.store.get("SELECT state FROM jobs").state === "credited") break;
      }
      assert.equal(f.store.get("SELECT state FROM jobs").state, "credited");
      assert.equal(
        await f.read("credits", [accounts[3].address]),
        parseEther("0.99"),
      );
      assert.equal(
        await f.read("credits", [accounts[2].address]),
        parseEther("0.01"),
      );
    } finally {
      await f.close();
    }
  },
);
