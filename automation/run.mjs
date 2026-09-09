import { createPublicClient, http, isAddress } from "viem";
import { gnosis, foundry } from "viem/chains";
import { Store } from "./store.mjs";
import {
  keyFile,
  loadDeployments,
  readSecret,
  readValidation,
  verifyDeployments,
} from "./config.mjs";
import { GitHub } from "./github.mjs";
import { Registry } from "./registry.mjs";
import { Collector } from "./collector.mjs";
import { MailboxWorker } from "./imap.mjs";
import { ChainIndexer } from "./indexer.mjs";
import { RelayWorker } from "./relay.mjs";
import { DisclosureGate } from "./disclosure.mjs";
import { SignerClient } from "./signer-ipc.mjs";
import { createApi } from "./api.mjs";
import { safeCode, fail } from "./errors.mjs";

try {
  process.umask(0o077);
  const deployments = loadDeployments(process.env.DEPLOYMENTS_FILE);
  const chain = deployments[0].chainId === 100 ? gnosis : foundry;
  const client = createPublicClient({
    chain,
    transport: http(process.env.RPC_URL ?? deployments[0].rpcUrl, {
      timeout: 15000,
      retryCount: 0,
    }),
    cacheTime: 0,
  });
  await verifyDeployments(client, deployments);
  const store = new Store(
    process.env.COLLECTOR_DATABASE,
    keyFile(process.env.COLLECTOR_STORAGE_KEY_FILE),
  );
  const github = new GitHub({
    collectorToken: process.env.COLLECTOR_GITHUB_TOKEN,
    appId: process.env.GITHUB_APP_ID,
    appPrivateKey: process.env.GITHUB_APP_PRIVATE_KEY_FILE
      ? readSecret(process.env.GITHUB_APP_PRIVATE_KEY_FILE)
      : null,
  });
  const identity = await github.collectorIdentity();
  const mailbox = {
    host: process.env.MAIL_HOST ?? "imap.gmail.com",
    address: process.env.MAIL_ADDRESS,
    password: process.env.MAIL_PASSWORD,
    accessToken: process.env.MAIL_ACCESS_TOKEN,
    folder: process.env.MAIL_FOLDER ?? "INBOX",
    login: identity.login,
    githubId: identity.id,
  };
  const validationId = readValidation(
    process.env.DISCLOSURE_VALIDATION_FILE,
    mailbox,
  );
  const registry = new Registry({ store, github, validationId });
  const collector = new Collector({
    store,
    keys: deployments.map((d) => d.dkimKey),
    mailbox,
  });
  const mail = new MailboxWorker({ store, collector, config: mailbox });
  const indexer = new ChainIndexer({
    store,
    client,
    deployments,
    collector,
    registry,
  });
  const gate = new DisclosureGate({ store, github, mailbox, validationId });
  const account = process.env.RELAY_ADDRESS;
  if (account && !isAddress(account)) fail("relay_address_invalid");
  const relay = account
    ? new RelayWorker({
        store,
        client,
        account,
        deployments,
        gate,
        signer: new SignerClient(process.env.SIGNER_SOCKET),
      })
    : null;
  const app = createApi({
    store,
    registry,
    installUrl: process.env.GITHUB_APP_INSTALL_URL ?? null,
    monitoring: {
      mailboxExpected: Boolean(
        mailbox.address || mailbox.password || mailbox.accessToken,
      ),
      relayExpected: Boolean(relay),
      backupStatusFile: process.env.BACKUP_STATUS_FILE,
    },
  });
  const server = app.listen(Number(process.env.PORT ?? 4320), "127.0.0.1");
  let stopping = false;
  let timer;
  let inFlight;
  const tick = async () => {
    if (stopping) return;
    try {
      await indexer.poll();
      await mail.poll();
      const stale = store.all(
        "SELECT id FROM repositories WHERE enabled=1 AND (checked_at IS NULL OR checked_at<?) ORDER BY checked_at LIMIT 5",
        Date.now() - 120000,
      );
      for (const row of stale) await registry.reconcile(row.id);
      if (relay) await relay.tick();
      store.expireReceipts();
      store.health("worker", true);
    } catch (error) {
      store.health("worker", false, safeCode(error));
    }
  };
  const schedule = () => {
    inFlight = tick().finally(() => {
      if (!stopping) timer = setTimeout(schedule, 15000).unref();
    });
  };
  for (const signal of ["SIGINT", "SIGTERM"])
    process.once(signal, async () => {
      if (stopping) return;
      stopping = true;
      clearTimeout(timer);
      const closed = new Promise((resolve) => server.close(resolve));
      await inFlight;
      await closed;
      store.close();
    });
  console.log(
    JSON.stringify({
      event: "collector_started",
      chainId: chain.id,
      automaticDisclosure: Boolean(validationId),
    }),
  );
  schedule();
} catch (error) {
  console.error(
    JSON.stringify({ event: "collector_start_failed", code: safeCode(error) }),
  );
  process.exit(1);
}
