import express from "express";
import { parseIssueUrl } from "./github.mjs";
import { bountyKey } from "./indexer.mjs";
import { ServiceError, safeCode } from "./errors.mjs";
import { operationalHealth } from "./operational-health.mjs";

export function createApi({
  store,
  registry,
  origins = ["https://issue.fund"],
  installUrl = null,
  now = Date.now,
  monitoring = {},
}) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", "loopback");
  const buckets = new Map();
  function admitted(key, limit) {
    const minute = Math.floor(now() / 60_000);
    let bucket = buckets.get(key);
    if (!bucket || bucket.minute !== minute) {
      if (buckets.size > 10_000)
        for (const [k, b] of buckets)
          if (b.minute !== minute) buckets.delete(k);
      if (buckets.size > 10_000) return false;
      bucket = { minute, count: 0 };
      buckets.set(key, bucket);
    }
    return ++bucket.count <= limit;
  }
  app.use((req, res, next) => {
    res.set({
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    });
    const origin = req.get("origin");
    if (origin && !origins.includes(origin))
      return res.status(403).json({ code: "origin_not_allowed" });
    if (origin) {
      res.set("Access-Control-Allow-Origin", origin);
      res.vary("Origin");
    }
    if (req.method === "OPTIONS") {
      res.set({
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      });
      return res.sendStatus(204);
    }
    if (!admitted(`read:${req.ip}`, 120))
      return res.status(429).json({ code: "request_rate_limited" });
    next();
  });
  app.get("/healthz", (_req, res) =>
    res.json({ status: "ok", service: "issue.fund-automation" }),
  );
  app.get("/v1/health", (_req, res) => {
    const health = store.all("SELECT name,checked_at,ok,code FROM health");
    res.json({
      components: health,
      disclosureValidated: Boolean(registry.validationId),
      installUrl,
    });
  });
  app.get("/v1/health/operational", (_req, res) => {
    const report = operationalHealth({
      ...monitoring,
      store,
      now: now(),
      disclosureValidated: Boolean(registry.validationId),
    });
    res.status(report.status === "ok" ? 200 : 503).json(report);
  });
  app.post(
    "/v1/issues/prepare",
    express.json({ limit: "2kb", strict: true }),
    async (req, res) => {
      if (!admitted(`prepare:${req.ip}`, 6) || !admitted("prepare:global", 100))
        return res.status(429).json({ code: "preparation_rate_limited" });
      if (typeof req.body?.url !== "string" || req.body.url.length > 256)
        throw new ServiceError("issue_url_invalid", 422);
      res.json(await registry.prepare(req.body.url));
    },
  );
  app.get("/v1/issues/status", (req, res) => {
    const input = parseIssueUrl(req.query.url);
    const issue = store.get(
      "SELECT i.id FROM issues i JOIN repositories r ON i.repo_id=r.id WHERE r.full_name=? AND i.number=?",
      input.repo,
      input.number,
    );
    if (!issue) throw new ServiceError("issue_not_prepared", 404);
    res.json(registry.status(issue.id));
  });
  app.get("/v1/bounties/:chain/:escrow/:id/status", (req, res) => {
    const { chain, escrow, id } = req.params;
    if (
      !/^[1-9][0-9]{0,8}$/.test(chain) ||
      !/^0x[0-9a-fA-F]{40}$/.test(escrow) ||
      !/^[1-9][0-9]{0,19}$/.test(id)
    )
      throw new ServiceError("bounty_identity_invalid", 422);
    const key = bountyKey(Number(chain), escrow, id);
    const job = store.get(
      "SELECT state,code,tx_hash,updated_at FROM jobs WHERE bounty_key=?",
      key,
    );
    const b = store.get("SELECT canonical,data FROM bounties WHERE key=?", key);
    if (!job || !b)
      return res.json({
        state: "waiting",
        code: "funding_not_indexed",
        transactionHash: null,
      });
    const data = JSON.parse(b.data);
    res.json({
      state: b.canonical ? job.state : "attention",
      code: b.canonical ? job.code : "chain_reorganization",
      transactionHash: job.tx_hash,
      updatedAt: job.updated_at,
      recipient: data.status === 1 ? data.recipient : null,
    });
  });
  app.use((_req, res) => res.status(404).json({ code: "not_found" }));
  app.use((error, _req, res, _next) => {
    const status =
      error instanceof ServiceError
        ? error.status
        : ["entity.too.large", "entity.parse.failed"].includes(error.type)
          ? 400
          : 503;
    res.status(status).json({
      code: safeCode(error),
      ...(error.code === "maintainer_installation_required"
        ? { installUrl }
        : {}),
    });
  });
  return app;
}
