import { readFileSync, statSync } from "node:fs";

export function operationalHealth({
  store,
  now = Date.now(),
  mailboxExpected = false,
  relayExpected = false,
  disclosureAuthorized = false,
  backupStatusFile = null,
}) {
  let backup = null;
  if (backupStatusFile) {
    backup = false;
    try {
      if (statSync(backupStatusFile).size <= 4096) {
        const report = JSON.parse(readFileSync(backupStatusFile, "utf8"));
        backup =
          report.version === 1 &&
          report.ok === true &&
          report.databases === 2 &&
          Number.isSafeInteger(report.checkedAt) &&
          report.checkedAt <= now &&
          now - report.checkedAt <= 30 * 3600_000;
      }
    } catch {
      /* Missing, invalid or unreadable reports are unhealthy. */
    }
  }
  // The worker heartbeat covers each completed loop. Relay results are event-
  // driven: an idle relay has no result, but a reported failure needs attention.
  const relay = store.get("SELECT ok FROM health WHERE name='relay'");
  const checks = {
    worker: store.healthy("worker", 120_000, now),
    chain: store.healthy("chain", 120_000, now),
    mailbox:
      mailboxExpected || relayExpected
        ? store.healthy("mailbox", 120_000, now)
        : null,
    disclosure: relayExpected ? disclosureAuthorized : null,
    relay: relayExpected && relay ? relay.ok === 1 : null,
    repositories: relayExpected
      ? store.get(
          "SELECT COUNT(*) AS n FROM repositories WHERE enabled=1 AND error_code IS NOT NULL",
        ).n === 0
      : null,
    backup,
  };
  const problems = Object.entries(checks)
    .filter(([, ok]) => ok === false)
    .map(([name]) => name);
  return {
    status: problems.length ? "degraded" : "ok",
    mode: relayExpected ? "automatic" : "setup",
    checks,
    problems,
    checkedAt: now,
  };
}
