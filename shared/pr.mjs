import { createGithubClient, parseRepo } from "./github.mjs";

export function parsePull(value) {
  let url;
  try {
    url = new URL(String(value).trim());
  } catch {
    /* validated below */
  }
  const match =
    url?.origin === "https://github.com" &&
    !url.username &&
    !url.password &&
    url.pathname.match(/^\/([^/]+\/[^/]+)\/pull\/([1-9]\d*)\/?$/);
  if (!match || !Number.isSafeInteger(Number(match[2])))
    throw Error(
      "Paste a GitHub PR URL, such as https://github.com/owner/repo/pull/42.",
    );
  return { repo: parseRepo(match[1]), number: Number(match[2]) };
}

export function validateBranch(value) {
  const branch = String(value).trim();
  if (
    !branch ||
    branch.length > 200 ||
    /[\s\x00-\x1f\x7f~^:?*\[\\%]/u.test(branch) ||
    branch.includes("..") ||
    branch.includes("@{") ||
    branch.startsWith("-") ||
    branch
      .split("/")
      .some(
        (p) =>
          !p || p.startsWith(".") || p.endsWith(".") || p.endsWith(".lock"),
      ) ||
    branch === "@"
  )
    throw Error(
      "Enter a pushed branch name, such as fix/parser. Do not paste a URL or a commit expression.",
    );
  return branch;
}

export function validateWallet(wallet, bounty) {
  if (
    !/^0x[0-9a-fA-F]{40}$/.test(wallet ?? "") ||
    /^0x0{40}$/i.test(wallet) ||
    wallet.toLowerCase() === bounty.contract?.toLowerCase()
  )
    throw Error(
      "Connect the payout wallet you control. It must be a nonzero address, not the escrow.",
    );
  return wallet;
}

export function titleFor(bounty, wallet, description) {
  validateWallet(wallet, bounty);
  if (!/^0x[0-9a-fA-F]{64}$/.test(bounty.bountyRef))
    throw Error("This bounty has an invalid reference. Reload its page.");
  const text = String(description).trim();
  if (
    !text ||
    text.length > 100 ||
    /[^\x20-\x7e]/.test(text) ||
    /\[(?:wallet|bounty)\b/i.test(text)
  )
    throw Error(
      "Describe the fix in 1–100 plain ASCII characters, without adding wallet or bounty markers.",
    );
  return `[bounty ${bounty.bountyRef}] [wallet ${wallet}] ${text}`;
}

const escape = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export function hasClosingReference(body, bounty) {
  // Only recognize visible prose. A quoted checklist/example is not evidence of a link.
  let fence = "";
  const prose = String(body)
    .replace(/<!--[\s\S]*?(?:-->|$)/g, "")
    .split(/\r?\n/)
    .map((line) => {
      const delimiter = line.match(/^ {0,3}(`{3,}|~{3,})/);
      if (delimiter) {
        if (!fence) fence = delimiter[1];
        else if (
          delimiter[1][0] === fence[0] &&
          delimiter[1].length >= fence.length
        )
          fence = "";
        return "";
      }
      if (fence || /^(?: {4}|\t|\s*>)/.test(line)) return "";
      return line.replace(/(`+)[\s\S]*?\1/g, "");
    })
    .join("\n");
  const repo = escape(bounty.repo),
    issue = bounty.issue;
  return new RegExp(
    `\\b(?:close[sd]?|fix(?:es|ed)?|resolve[sd]?)\\s*:?\\s*(?:https://github\\.com/${repo}/issues/${issue}|${repo}#${issue}|#${issue})(?![\\w/#])`,
    "i",
  ).test(prose);
}

export function bodyFor(bounty, description = "") {
  const body = String(description).trim();
  if (body.length > 20000)
    throw Error(
      "Keep the description under 20,000 characters, or copy the closing line into GitHub separately.",
    );
  return hasClosingReference(body, bounty)
    ? body
    : `Closes #${bounty.issue}${body ? "\n\n" + body : ""}`;
}

export function compareUrl(bounty, sourceRepo, branch, title, body) {
  const repo = parseRepo(bounty.repo),
    source = parseRepo(sourceRepo);
  validateBranch(branch);
  validateBranch(bounty.branch);
  const head =
    source.toLowerCase() === repo.toLowerCase()
      ? encodeURIComponent(branch)
      : `${source.split("/")[0]}:${encodeURIComponent(branch)}`;
  const compare = `https://github.com/${repo}/compare/${encodeURIComponent(bounty.branch)}...${head}`;
  const url = `${compare}?${new URLSearchParams({ quick_pull: "1", title, body })}`;
  // GitHub documents a URI size limit. Keep long templates intact using Copy instead.
  return {
    url: url.length <= 7500 ? url : null,
    compareUrl: `${compare}?quick_pull=1`,
    tooLong: url.length > 7500,
  };
}

export function checkPull(bounty, wallet, pr, now = Date.now() / 1000) {
  validateWallet(wallet, bounty);
  const markers =
    String(pr.title).match(/\[(?:wallet|bounty)\b[^\]]*\]/gi) ?? [];
  const walletCount = (String(pr.title).match(/\[wallet\b/gi) ?? []).length;
  const referenceCount = (String(pr.title).match(/\[bounty\b/gi) ?? []).length;
  const wallets = markers.filter((m) => /^\[wallet\b/i.test(m));
  const refs = markers.filter((m) => /^\[bounty\b/i.test(m));
  return [
    {
      id: "window",
      ok: bounty.status === 0 && now <= bounty.deadline,
      label: "Bounty completion window",
      detail:
        "The bounty must be open and merged before its completion deadline.",
    },
    {
      id: "repo",
      ok:
        pr.base?.repo?.private === false &&
        pr.base.repo.full_name === bounty.repo,
      label: "Funded repository",
      detail: `Use a PR in ${bounty.repo}.`,
    },
    {
      id: "branch",
      ok:
        pr.base?.ref === bounty.branch &&
        pr.base?.repo?.default_branch === bounty.branch,
      label: "Target branch",
      detail: `Target ${bounty.branch}; it must still be the default branch.`,
    },
    {
      id: "state",
      ok: pr.state === "open" && pr.merged === false,
      label: "PR is open and unmerged",
      detail:
        "Already merged or closed PRs cannot be prepared again. Check the bounty’s claim status.",
    },
    {
      id: "title",
      ok: /^[\x20-\x7e]+$/.test(pr.title),
      label: "Supported title text",
      detail:
        "Use plain ASCII text so the merge email matches the deployed verifier.",
    },
    {
      id: "bounty",
      ok:
        referenceCount === 1 &&
        refs.length === 1 &&
        refs[0].startsWith("[bounty 0x") &&
        refs[0].toLowerCase() === `[bounty ${bounty.bountyRef}]`.toLowerCase(),
      label: "Bounty reference",
      detail: "Copy this bounty’s title, with exactly one bounty marker.",
    },
    {
      id: "wallet",
      ok:
        walletCount === 1 &&
        wallets.length === 1 &&
        wallets[0].startsWith("[wallet 0x") &&
        wallets[0].toLowerCase() === `[wallet ${wallet}]`.toLowerCase(),
      label: "Payout wallet",
      detail: `The title must designate ${wallet}, with exactly one wallet marker.`,
    },
    {
      id: "issue",
      ok: hasClosingReference(pr.body, bounty),
      label: "Issue-closing line",
      detail: `Add Closes #${bounty.issue} to the description, outside comments, quotes and code blocks. Confirm the linked issue on GitHub before merge.`,
    },
  ];
}

export function createPrClient(fetcher = fetch) {
  const github = createGithubClient(fetcher);
  const read = async (path) => (await github.request(path)).data;
  async function context(bounty) {
    const repo = await github.getRepo(bounty.repo);
    if (repo.name !== bounty.repo || repo.branch !== bounty.branch)
      throw Error(
        "The repository name or default branch changed since funding. Ask the maintainer to check the bounty’s fixed terms.",
      );
    const issue = await github.getIssue(repo, bounty.issue);
    if (issue.number !== bounty.issue || issue.state !== "open")
      throw Error(
        "The funded issue is no longer open. Check its claim status before preparing another PR.",
      );
    return { repo, issue };
  }
  async function branches(value) {
    const repo = parseRepo(value);
    const { data, more } = await github.request(
      `/repos/${repo}/branches?per_page=100`,
    );
    if (!Array.isArray(data))
      throw Error("GitHub returned an invalid branch list.");
    return {
      names: data.map((b) => b.name).filter((n) => typeof n === "string"),
      more,
    };
  }
  async function source(bounty, value, branch) {
    const repo = parseRepo(value),
      ref = validateBranch(branch);
    const data = await read(`/repos/${repo}`);
    if (
      !Number.isSafeInteger(data.id) ||
      data.id < 1 ||
      data.private !== false ||
      data.archived ||
      data.disabled ||
      parseRepo(data.full_name).toLowerCase() !== repo.toLowerCase()
    )
      throw Error("Choose an active public source repository.");
    if (repo.toLowerCase() !== bounty.repo.toLowerCase()) {
      const base = await read(`/repos/${parseRepo(bounty.repo)}`);
      if (
        !Number.isSafeInteger(base.id) ||
        base.id < 1 ||
        base.private !== false ||
        !data.fork ||
        (data.source?.id ?? data.parent?.id) !== (base.source?.id ?? base.id)
      )
        throw Error(
          "The source repository must be a fork in the funded repository’s network.",
        );
      // Owner-qualified compare links cannot unambiguously identify a same-owner fork.
      if (
        repo.split("/")[0].toLowerCase() ===
        bounty.repo.split("/")[0].toLowerCase()
      )
        throw Error(
          "For a fork owned by the same account, select the exact fork on GitHub’s compare page and use the title/description copy controls.",
        );
    } else if (ref === bounty.branch)
      throw Error("Choose your work branch, not the target branch.");
    const resolved = await read(
      `/repos/${parseRepo(data.full_name)}/branches/${encodeURIComponent(ref)}`,
    );
    if (resolved.name !== ref || !resolved.commit?.sha)
      throw Error(
        "The source branch changed or was not found. Push it to GitHub and retry.",
      );
    return { repo: data.full_name, branch: ref, sha: resolved.commit.sha };
  }
  async function templates(bounty) {
    const paths = ["", ".github", "docs"];
    const listing = async (path) => {
      try {
        const data = await read(
          `/repos/${parseRepo(bounty.repo)}/contents${path ? "/" + path : ""}?ref=${encodeURIComponent(bounty.branch)}`,
        );
        if (!Array.isArray(data))
          throw Error("GitHub returned an invalid template directory.");
        return data;
      } catch (error) {
        if (error.status === 404) return [];
        throw error;
      }
    };
    const dirs = await Promise.all(paths.map(listing));
    const found = [];
    for (let index = 0; index < dirs.length; index++) {
      for (const file of dirs[index]) {
        if (
          file.type === "file" &&
          /^pull_request_template\.(?:md|txt)$/i.test(file.name)
        )
          found.push(file);
        if (file.type === "dir" && /^pull_request_template$/i.test(file.name)) {
          const nested = await listing(
            [paths[index], file.name].filter(Boolean).join("/"),
          );
          found.push(
            ...nested.filter(
              (f) => f.type === "file" && /\.(md|txt)$/i.test(f.name),
            ),
          );
        }
      }
    }
    return found.slice(0, 30).map((f) => ({ path: f.path, name: f.path }));
  }
  async function template(bounty, path) {
    if (
      !/^(?:(?:\.github|docs)\/)?(?:pull_request_template\.(?:md|txt)|pull_request_template\/[^/]+\.(?:md|txt))$/i.test(
        path,
      )
    )
      throw Error("Choose a repository PR template from the list.");
    const data = await read(
      `/repos/${parseRepo(bounty.repo)}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(bounty.branch)}`,
    );
    if (
      data.type !== "file" ||
      data.encoding !== "base64" ||
      data.size > 20000 ||
      typeof data.content !== "string" ||
      data.content.length > 30000
    )
      throw Error(
        "This template is too large to prefill. Open it on GitHub and copy its checklist into the PR.",
      );
    return new TextDecoder().decode(
      Uint8Array.from(atob(data.content.replace(/\s/g, "")), (c) =>
        c.charCodeAt(0),
      ),
    );
  }
  async function pull(value) {
    const ref = parsePull(value);
    const data = await read(`/repos/${ref.repo}/pulls/${ref.number}`);
    const canonical = parsePull(data.html_url);
    if (
      data.number !== ref.number ||
      canonical.number !== ref.number ||
      canonical.repo.toLowerCase() !== ref.repo.toLowerCase() ||
      data.base?.repo?.private !== false
    )
      throw Error(
        "The PR identity changed or is not public. Paste its current GitHub URL.",
      );
    return data;
  }
  return { context, branches, source, templates, template, pull };
}
