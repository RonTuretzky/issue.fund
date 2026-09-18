// Operator-only, loopback manifest handoff. Never mount this in the public API.
import http from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
const port = 4331;
const base = `http://127.0.0.1:${port}`;
const state = randomBytes(32).toString("hex");
const output = ".local/secrets/github-app.json";
if (existsSync(output))
  throw Error("An App configuration already exists. Reuse it.");
const manifest = {
  name: "issue-fund-collector",
  url: "https://issue.fund",
  description:
    "Collect GitHub bounty receipts and lock completed conversations before automatic submission.",
  public: true,
  redirect_url: base + "/callback",
  hook_attributes: {
    url: "https://api.issue.fund/github/events",
    active: false,
  },
  request_oauth_on_install: false,
  default_permissions: {
    metadata: "read",
    issues: "write",
    pull_requests: "write",
  },
  default_events: [],
};
const escaped = JSON.stringify(manifest)
  .replaceAll("&", "&amp;")
  .replaceAll('"', "&quot;")
  .replaceAll("<", "&lt;");
let exchanging = false;
const server = http.createServer(async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'none'; form-action https://github.com; frame-ancestors 'none'",
  );
  if (req.headers.host !== `127.0.0.1:${port}` || req.method !== "GET") {
    res.writeHead(403).end("Forbidden");
    return;
  }
  const url = new URL(req.url, base);
  if (url.pathname === "/") {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(
      `<!doctype html><html lang="en"><meta charset="utf-8"><title>issue.fund · Register collector App</title><h1>Register the issue.fund collector App</h1><p>Sign in to your GitHub owner account first. The App needs Metadata read, Issues write and Pull requests write to verify repository access and lock completed bounty conversations. It requests no code access or user OAuth.</p><p>You own the App. Installation is a separate step; select only the public test repository first. Automatic receipt publication stays disabled until the real email security checks pass.</p><form method="post" action="https://github.com/settings/apps/new?state=${state}"><input type="hidden" name="manifest" value="${escaped}"><button>Review and create on GitHub</button></form></html>`,
    );
    return;
  }
  const received = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code") ?? "";
  if (
    url.pathname !== "/callback" ||
    received.length !== state.length ||
    !timingSafeEqual(Buffer.from(received), Buffer.from(state)) ||
    !/^[A-Za-z0-9_-]{20,200}$/.test(code) ||
    exchanging
  ) {
    res.writeHead(400).end("Invalid or already used registration response.");
    return;
  }
  exchanging = true;
  try {
    const r = await fetch(
      `https://api.github.com/app-manifests/${code}/conversions`,
      {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        signal: AbortSignal.timeout(20000),
      },
    );
    if (!r.ok) throw Error("App conversion failed");
    const app = await r.json();
    if (
      !Number.isSafeInteger(app.id) ||
      !app.pem?.startsWith("-----BEGIN RSA PRIVATE KEY-----") ||
      !/^https:\/\/github\.com\/apps\/[a-z0-9-]+$/.test(app.html_url)
    )
      throw Error("Invalid App response");
    mkdirSync(".local/secrets", { recursive: true, mode: 0o700 });
    writeFileSync(output, JSON.stringify(app, null, 2) + "\n", {
      mode: 0o600,
      flag: "wx",
    });
    res.writeHead(303, { Location: app.html_url + "/installations/new" }).end();
    console.log(
      JSON.stringify({
        event: "github_app_registered",
        appId: app.id,
        installUrl: app.html_url + "/installations/new",
      }),
    );
    server.close();
  } catch {
    res
      .writeHead(502)
      .end(
        "Registration exchange could not finish. No credentials were printed. Check whether GitHub created the App before retrying.",
      );
  }
});
server.listen(port, "127.0.0.1", () =>
  console.log(
    "Open " + base + " in the browser where you are signed into GitHub.",
  ),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => server.close());
