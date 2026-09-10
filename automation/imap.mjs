import { ImapFlow } from "imapflow";
import { ServiceError, safeCode } from "./errors.mjs";

export class MailboxWorker {
  constructor({
    store,
    collector,
    config,
    now = Date.now,
    clientFactory = (options) => new ImapFlow(options),
  }) {
    Object.assign(this, { store, collector, config, now, clientFactory });
  }
  async poll() {
    const {
      host,
      address,
      password,
      accessToken,
      folder = "INBOX",
    } = this.config;
    if (!host || !address || (!password && !accessToken)) {
      this.store.health("mailbox", false, "mailbox_not_configured", this.now());
      return;
    }
    const client = this.clientFactory({
      host,
      port: 993,
      secure: true,
      auth: {
        user: address,
        ...(accessToken ? { accessToken } : { pass: password }),
      },
      tls: { rejectUnauthorized: true, minVersion: "TLSv1.2" },
      logger: false,
      emitLogs: false,
      disableAutoIdle: true,
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 30_000,
    });
    // IMAP error events can include server/user data. Never log the object.
    let connectionFailed = false;
    client.on("error", () => {
      connectionFailed = true;
    });
    let lock;
    try {
      await client.connect();
      lock = await client.getMailboxLock(folder, { readOnly: true });
      const validity = String(client.mailbox.uidValidity);
      const cursorKey = `imap:${host}:${address}:${folder}`;
      const old = this.store.getMeta(cursorKey);
      const last = old?.validity === validity ? old.uid : 0;
      const highest = Number(client.mailbox.uidNext) - 1;
      // Freeze this poll's upper bound. Never use last:*: IMAP reverses empty
      // ranges and can fetch the last message repeatedly when no mail is new.
      if (highest > last) {
        const upper = Math.min(highest, last + 100);
        // Filter at Gmail before downloading any message bodies. This is only
        // an intake filter; the collector still verifies transport and DKIM.
        const candidates = await client.search(
          { uid: `${last + 1}:${upper}`, from: "notifications@github.com" },
          { uid: true },
        );
        const messages = candidates.length
          ? await client.fetchAll(
              candidates,
              { uid: true, size: true },
              { uid: true },
            )
          : [];
        for (const message of messages.sort((a, b) => a.uid - b.uid)) {
          if (message.size <= 100_000) {
            const fetched = await client.fetchOne(
              String(message.uid),
              { source: { start: 0, maxLength: 100_001 } },
              { uid: true },
            );
            if (fetched?.source) {
              try {
                await this.collector.ingest(fetched.source);
              } catch (error) {
                // Reject malformed/unrelated mail without retaining its contents.
                // Transient DB/service errors keep the cursor before this UID.
                if (!(error instanceof ServiceError) || error.status >= 500)
                  throw error;
              }
            }
          }
          this.store.setMeta(cursorKey, { validity, uid: message.uid });
        }
        // Expunged UIDs cannot stall the cursor on gaps.
        this.store.setMeta(cursorKey, { validity, uid: upper });
      }
      if (connectionFailed) throw new ServiceError("mailbox_unavailable");
      this.store.health("mailbox", true, null, this.now());
    } catch (error) {
      this.store.health("mailbox", false, safeCode(error), this.now());
    } finally {
      lock?.release();
      try {
        await client.logout();
      } catch {
        client.close();
      }
    }
  }
}
