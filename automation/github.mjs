import { sign } from "node:crypto";
import { fail, ServiceError } from "./errors.mjs";

export class GitHub {
  constructor({
    collectorToken,
    appId,
    appPrivateKey,
    fetcher = fetch,
    now = Date.now,
  }) {
    this.collectorToken = collectorToken;
    this.appId = appId;
    this.appPrivateKey = appPrivateKey;
    this.fetcher = fetcher;
    this.now = now;
    this.tokens = new Map();
  }
  async request(
    path,
    { token = this.collectorToken, method = "GET", body, ok = [200] } = {},
  ) {
    if (!/^\/(?:repos|user|app|installation)(?:\/|$|\?)/.test(path))
      fail("github_path_invalid", 500);
    let response;
    try {
      response = await this.fetcher(`https://api.github.com${path}`, {
        method,
        redirect: "error",
        signal: AbortSignal.timeout(15_000),
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2026-03-10",
          "User-Agent": "issue.fund-collector",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      fail("github_unavailable");
    }
    if (
      response.status === 429 ||
      (response.status === 403 &&
        (response.headers.get("x-ratelimit-remaining") === "0" ||
          response.headers.has("retry-after")))
    )
      throw new ServiceError("github_rate_limited", 429);
    if (!ok.includes(response.status)) {
      if ([401, 403].includes(response.status))
        fail("github_permissions_missing", 503);
      if (response.status === 404) fail("github_not_found", 404);
      fail("github_unavailable");
    }
    const data =
      response.status === 204 || response.status === 404
        ? null
        : await response.json();
    return { status: response.status, data };
  }
  jwt() {
    if (!this.appId || !this.appPrivateKey)
      fail("maintainer_installation_required", 409);
    const now = Math.floor(this.now() / 1000);
    const encode = (value) =>
      Buffer.from(JSON.stringify(value)).toString("base64url");
    const input = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({ iat: now - 60, exp: now + 540, iss: this.appId })}`;
    return `${input}.${sign("RSA-SHA256", Buffer.from(input), this.appPrivateKey).toString("base64url")}`;
  }
  async installation(repo) {
    const { data } = await this.request(`/repos/${repo}/installation`, {
      token: this.jwt(),
      ok: [200, 404],
    });
    if (
      !data ||
      data.suspended_at ||
      data.permissions?.issues !== "write" ||
      data.permissions?.pull_requests !== "write"
    )
      fail("maintainer_installation_required", 409);
    return data;
  }
  async installationToken(installationId, repoId) {
    const cacheKey = `${installationId}:${repoId}`;
    const old = this.tokens.get(cacheKey);
    if (old && old.until > this.now() + 120_000) return old.token;
    const { data } = await this.request(
      `/app/installations/${installationId}/access_tokens`,
      {
        token: this.jwt(),
        method: "POST",
        ok: [201],
        body: {
          repository_ids: [repoId],
          permissions: {
            metadata: "read",
            issues: "write",
            pull_requests: "write",
          },
        },
      },
    );
    if (!data.token || !Number.isFinite(Date.parse(data.expires_at)))
      fail("github_unavailable");
    this.tokens.set(cacheKey, {
      token: data.token,
      until: Date.parse(data.expires_at),
    });
    return data.token;
  }
  async collectorIdentity() {
    if (!this.collectorToken) fail("collector_token_missing");
    const { data } = await this.request("/user");
    return { id: data.id, login: data.login };
  }
  async watch(repo) {
    if (!this.collectorToken) fail("collector_token_missing");
    // Fine-grained tokens cannot use this endpoint, even with Watching read.
    if (this.collectorToken.startsWith("github_pat_"))
      fail("classic_watch_token_required");
    const current = await this.request(`/repos/${repo}/subscription`, {
      ok: [200, 404],
    });
    if (current.data?.subscribed && !current.data.ignored) return current.data;
    const { data } = await this.request(`/repos/${repo}/subscription`, {
      method: "PUT",
      body: { subscribed: true, ignored: false },
    });
    if (!data.subscribed || data.ignored) fail("notifications_not_subscribed");
    return data;
  }
  async assertOutsideCollector(repo, token, collector) {
    if (
      repo.owner.id === collector.id ||
      repo.owner.login.toLowerCase() === collector.login.toLowerCase()
    )
      fail("collector_has_repository_privileges", 409);
    // Listing with installation credentials proves the permission check actually
    // worked; a bare 404 from the membership endpoint could hide denied access.
    for (let page = 1; page <= 100; page++) {
      const { data } = await this.request(
        `/repos/${repo.full_name}/collaborators?affiliation=all&per_page=100&page=${page}`,
        { token },
      );
      if (!Array.isArray(data)) fail("collector_permissions_unverified");
      if (
        data.some(
          (user) =>
            user.id === collector.id ||
            user.login.toLowerCase() === collector.login.toLowerCase(),
        )
      )
        fail("collector_has_repository_privileges", 409);
      if (data.length < 100) return;
    }
    fail("collector_permissions_unverified");
  }
}

export function assertPublicRepo(repo) {
  if (
    !Number.isSafeInteger(repo?.id) ||
    !Number.isSafeInteger(repo.owner?.id) ||
    !/^[\w.-]+\/[\w.-]+$/.test(repo.full_name ?? "") ||
    repo.private !== false ||
    repo.visibility !== "public" ||
    repo.archived ||
    repo.disabled ||
    !repo.has_issues
  )
    fail("public_repository_required", 422);
}

export function parseIssueUrl(input) {
  let url;
  try {
    url = new URL(input);
  } catch {
    fail("issue_url_invalid", 422);
  }
  if (
    url.protocol !== "https:" ||
    url.hostname !== "github.com" ||
    url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    fail("issue_url_invalid", 422);
  const match = /^\/([\w.-]+)\/([\w.-]+)\/issues\/([1-9][0-9]{0,11})\/?$/.exec(
    url.pathname,
  );
  if (!match) fail("issue_url_invalid", 422);
  return { repo: `${match[1]}/${match[2]}`, number: Number(match[3]) };
}
