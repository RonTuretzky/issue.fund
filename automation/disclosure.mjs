import { assertPublicRepo } from "./github.mjs";
import { fail } from "./errors.mjs";

export class DisclosureGate {
  constructor({ github, store, mailbox, validationId, now = Date.now }) {
    Object.assign(this, { github, store, mailbox, validationId, now });
  }
  async check(bounty, pair) {
    if (!this.validationId) fail("disclosure_validation_pending", 409);
    const registered = this.store.get(
      "SELECT * FROM repositories WHERE full_name=? AND enabled=1",
      bounty.repo,
    );
    if (!registered) fail("repository_not_prepared", 409);
    const { data: repo } = await this.github.request(`/repos/${bounty.repo}`);
    assertPublicRepo(repo);
    if (
      repo.id !== registered.id ||
      repo.full_name !== bounty.repo ||
      repo.owner.id !== registered.owner_id
    )
      fail("repository_identity_changed", 409);
    const collector = await this.github.collectorIdentity();
    if (
      collector.login.toLowerCase() !== this.mailbox.login.toLowerCase() ||
      collector.id !== this.mailbox.githubId
    )
      fail("collector_identity_changed", 409);
    const installation = await this.github.installation(repo.full_name);
    const token = await this.github.installationToken(installation.id, repo.id);
    await this.github.assertOutsideCollector(repo, token, collector);
    const { data: issue } = await this.github.request(
      `/repos/${repo.full_name}/issues/${bounty.issue}`,
      { token },
    );
    const { data: pr } = await this.github.request(
      `/repos/${repo.full_name}/pulls/${pair.pr}`,
      { token },
    );
    const registeredIssue = this.store.get(
      "SELECT id FROM issues WHERE repo_id=? AND number=?",
      repo.id,
      bounty.issue,
    );
    if (
      !registeredIssue ||
      issue.id !== registeredIssue.id ||
      issue.pull_request ||
      issue.state !== "closed" ||
      !pr.merged ||
      pr.base?.repo?.id !== repo.id ||
      pr.base?.ref !== bounty.branch
    )
      fail("completed_conversations_unverified", 409);
    for (const conversation of [issue, pr]) {
      if (!conversation.locked)
        await this.github.request(
          `/repos/${repo.full_name}/issues/${conversation.number}/lock`,
          {
            token,
            method: "PUT",
            body: { lock_reason: "resolved" },
            ok: [204],
          },
        );
    }
    // Re-read both locks after mutations. No receipt bytes are sent to GitHub.
    for (const number of [bounty.issue, pair.pr]) {
      const { data } = await this.github.request(
        `/repos/${repo.full_name}/issues/${number}`,
        { token },
      );
      if (!data.locked || data.state !== "closed")
        fail("conversation_lock_required", 409);
    }
    // GitHub state remains reversible after this check. Record operational
    // evidence; never describe it as an on-chain or permanent privacy guarantee.
    return {
      checkedAt: this.now(),
      repoId: repo.id,
      collectorId: collector.id,
      validationId: this.validationId,
    };
  }
}
