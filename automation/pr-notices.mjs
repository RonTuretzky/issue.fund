import { hasClosingReference, checkPull } from "../shared/pr.mjs";
import { safeCode } from "./errors.mjs";

export const noticeMarker = "<!-- issue.fund:merge-notice -->";

export function noticeFor(pr, bounties, now = Date.now()) {
  const matches = bounties.filter(
    (b) =>
      b.status === 0 &&
      b.deadline * 1000 >= now &&
      hasClosingReference(pr.body, b),
  );
  if (!matches.length) return null;
  const lines = [
    noticeMarker,
    "### issue.fund bounty notice",
    "",
    "Maintainers: this PR references funded issues. **Merging into the repository’s default branch will close the referenced issues and start the bounty claim process.** Payment requires valid GitHub merge and closure receipts and the bounty’s claim conditions.",
  ];
  for (const b of matches) {
    const url = `https://issue.fund/#bounty/${b.chainId}/${b.contract}/${b.id}`;
    const wallet = /^\[wallet (0x[0-9a-fA-F]{40})\]$/.exec(
      (pr.title.match(/\[wallet\b[^\]]*\]/g) ?? [])[0] ?? "",
    )?.[1];
    let problems;
    try {
      problems = checkPull(b, wallet, { ...pr, merged: false }, now / 1000)
        .filter((c) => !c.ok)
        .map((c) => c.label);
    } catch {
      problems = ["Payout wallet marker missing or invalid"];
    }
    lines.push(
      "",
      `- [${b.repo}#${b.issue}](https://github.com/${b.repo}/issues/${b.issue}) — [bounty ${b.id}](${url})${wallet ? `; title designates payout wallet \`${wallet}\`` : ""}.`,
      problems.length
        ? `  **Not claim-ready:** ${problems.join("; ")}. Use the bounty page’s Prepare PR flow before merging.`
        : "  PR metadata matches this bounty’s preparation checks; this is not a guarantee of settlement.",
    );
  }
  lines.push(
    "",
    "Before merging, confirm the intended payout wallet and closing links. Automatic submission starts after the collector receives and verifies both receipts. Lock the closed issue and merged PR before publishing receipts; exposed email reply tokens can enable impersonated comments. Any subscriber can also submit valid receipts independently.",
  );
  return lines.join("\n");
}

export class PrNoticeWorker {
  constructor({ store, github, now = Date.now }) {
    Object.assign(this, { store, github, now });
  }
  async poll() {
    const repos = this.store.all(
      "SELECT * FROM repositories WHERE enabled=1 AND installation_id IS NOT NULL ORDER BY id",
    );
    const last = this.store.getMeta("pr-notices:repo") ?? 0;
    const repo = repos.find((r) => r.id > last) ?? repos[0];
    if (!repo) return;
    this.store.setMeta("pr-notices:repo", repo.id);
    if ((this.store.getMeta(`pr-notices:next:${repo.id}`) ?? 0) > this.now())
      return;
    try {
      // Revalidate current installation permissions; never use collector identity to post.
      const installation = await this.github.installation(repo.full_name);
      const token = await this.github.installationToken(
        installation.id,
        repo.id,
      );
      const page = this.store.getMeta(`pr-notices:page:${repo.id}`) ?? 1;
      const { data: prs } = await this.github.request(
        `/repos/${repo.full_name}/pulls?state=open&sort=created&direction=asc&per_page=100&page=${page}`,
        { token },
      );
      const bounties = this.store
        .all(
          "SELECT data FROM bounties WHERE repo_id=? AND canonical=1 ORDER BY key",
          repo.id,
        )
        .map((r) => JSON.parse(r.data));
      for (const pr of prs) {
        const key = `pr-notice:${repo.id}:${pr.number}`;
        const previous = this.store.getMeta(key);
        const body = noticeFor(pr, bounties, this.now());
        if (!body && !previous) continue;
        const desired =
          body ??
          `${noticeMarker}\nThis PR no longer references an active funded issue. The previous bounty notice is no longer applicable.`;
        // Read comments before every mutation, including after uncertain POST outcomes.
        let own;
        for (let p = 1; ; p++) {
          const { data: comments } = await this.github.request(
            `/repos/${repo.full_name}/issues/${pr.number}/comments?per_page=100&page=${p}`,
            { token },
          );
          own = comments.find(
            (c) =>
              c.performed_via_github_app?.id === Number(this.github.appId) &&
              c.body?.startsWith(noticeMarker),
          );
          if (own || comments.length < 100) break;
        }
        if (own && own.body !== desired)
          await this.github.request(
            `/repos/${repo.full_name}/issues/comments/${own.id}`,
            { token, method: "PATCH", body: { body: desired } },
          );
        else if (!own && body)
          await this.github.request(
            `/repos/${repo.full_name}/issues/${pr.number}/comments`,
            { token, method: "POST", body: { body: desired }, ok: [201] },
          );
        this.store.setMeta(key, { checkedAt: this.now() });
      }
      this.store.setMeta(
        `pr-notices:page:${repo.id}`,
        prs.length === 100 ? page + 1 : 1,
      );
      this.store.setMeta(`pr-notices:next:${repo.id}`, this.now() + 120_000);
      this.store.health("pr-notices", true);
    } catch (error) {
      this.store.setMeta(`pr-notices:next:${repo.id}`, this.now() + 120_000);
      this.store.health("pr-notices", false, safeCode(error));
    }
  }
}
