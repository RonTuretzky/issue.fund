import { parseIssueUrl, assertPublicRepo } from "./github.mjs";
import { fail, safeCode } from "./errors.mjs";

export class Registry {
  constructor({
    store,
    github,
    now = Date.now,
    maxRepos = 500,
    maxIssues = 5000,
    validationId = null,
  }) {
    Object.assign(this, {
      store,
      github,
      now,
      maxRepos,
      maxIssues,
      validationId,
    });
  }
  async prepare(url, { allowClosed = false } = {}) {
    const input = parseIssueUrl(url);
    const { data: repo } = await this.github.request(`/repos/${input.repo}`);
    assertPublicRepo(repo);
    if (!/^[\w./-]{1,64}$/.test(repo.default_branch ?? ""))
      fail("branch_unsupported", 422);
    const { data: issue } = await this.github.request(
      `/repos/${repo.full_name}/issues/${input.number}`,
    );
    if (
      !Number.isSafeInteger(issue.id) ||
      issue.number !== input.number ||
      issue.pull_request ||
      (!allowClosed && issue.state !== "open")
    )
      fail("open_issue_required", 422);
    // A public sponsor does not authorize modifying repository conversations.
    // Installation is explicit maintainer consent, checked before admission/watch.
    const install = await this.github.installation(repo.full_name);
    const at = this.now();
    this.store.transaction(() => {
      const previous = this.store.get(
        "SELECT * FROM repositories WHERE id=?",
        repo.id,
      );
      if (previous && previous.full_name !== repo.full_name)
        fail("repository_renamed", 409);
      if (
        !previous &&
        this.store.get("SELECT count(*) AS n FROM repositories").n >=
          this.maxRepos
      )
        fail("repository_capacity_reached", 429);
      const otherName = this.store.get(
        "SELECT id FROM repositories WHERE full_name=?",
        repo.full_name,
      );
      if (otherName && otherName.id !== repo.id)
        fail("repository_identity_changed", 409);
      const previousIssue = this.store.get(
        "SELECT id FROM issues WHERE repo_id=? AND number=?",
        repo.id,
        issue.number,
      );
      if (previousIssue && previousIssue.id !== issue.id)
        fail("issue_identity_changed", 409);
      if (
        !this.store.get("SELECT id FROM issues WHERE id=?", issue.id) &&
        this.store.get("SELECT count(*) AS n FROM issues").n >= this.maxIssues
      )
        fail("issue_capacity_reached", 429);
      this.store.run(
        `INSERT INTO repositories(id,full_name,owner_id,branch,installation_id,prepared_at) VALUES (?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET installation_id=excluded.installation_id, branch=excluded.branch`,
        repo.id,
        repo.full_name,
        repo.owner.id,
        repo.default_branch,
        install.id,
        at,
      );
      this.store.run(
        "INSERT INTO issues VALUES (?,?,?,?,?) ON CONFLICT(id) DO NOTHING",
        issue.id,
        repo.id,
        issue.number,
        `https://github.com/${repo.full_name}/issues/${issue.number}`,
        at,
      );
    });
    await this.reconcile(repo.id);
    return this.status(issue.id);
  }
  async reconcile(repoId) {
    const row = this.store.get("SELECT * FROM repositories WHERE id=?", repoId);
    if (!row?.enabled) return;
    try {
      const { data: repo } = await this.github.request(
        `/repos/${row.full_name}`,
      );
      assertPublicRepo(repo);
      if (
        repo.id !== row.id ||
        repo.full_name !== row.full_name ||
        repo.owner.id !== row.owner_id
      )
        fail("repository_identity_changed", 409);
      const install = await this.github.installation(row.full_name);
      const token = await this.github.installationToken(install.id, repo.id);
      const collector = await this.github.collectorIdentity();
      await this.github.assertOutsideCollector(repo, token, collector);
      await this.github.watch(repo.full_name);
      this.store.run(
        "UPDATE repositories SET watched_at=COALESCE(watched_at,?), checked_at=?, installation_id=?, error_code=NULL WHERE id=?",
        this.now(),
        this.now(),
        install.id,
        row.id,
      );
      this.store.setMeta("collector-identity", collector);
    } catch (error) {
      // A lapse invalidates readiness until new delivery demonstrates recovery.
      this.store.run(
        "UPDATE repositories SET checked_at=?, error_code=?, watched_at=NULL, delivered_at=NULL WHERE id=?",
        this.now(),
        safeCode(error),
        row.id,
      );
    }
  }
  status(issueId) {
    const issue = this.store.get("SELECT * FROM issues WHERE id=?", issueId);
    if (!issue) fail("issue_not_prepared", 404);
    const repo = this.store.get(
      "SELECT * FROM repositories WHERE id=?",
      issue.repo_id,
    );
    const at = this.now();
    let state = "preparing",
      code = "waiting_for_first_notification";
    if (!repo.enabled) [state, code] = ["attention", "repository_disabled"];
    else if (repo.error_code) [state, code] = ["attention", repo.error_code];
    else if (!repo.checked_at || at - repo.checked_at > 5 * 60_000)
      [state, code] = ["attention", "subscription_check_stale"];
    else if (!this.store.healthy("mailbox", 120_000, at))
      [state, code] = ["attention", "mailbox_unavailable"];
    else if (!this.validationId)
      [state, code] = ["attention", "disclosure_validation_pending"];
    else if (repo.delivered_at >= repo.watched_at && repo.watched_at)
      [state, code] = ["ready", null];
    return {
      issueId: issue.id,
      repoId: repo.id,
      repo: repo.full_name,
      issue: issue.number,
      issueUrl: issue.url,
      branch: repo.branch,
      state,
      code,
      watchedAt: repo.watched_at,
      lastCheckedAt: repo.checked_at,
      lastDeliveryAt: repo.delivered_at,
    };
  }
}
