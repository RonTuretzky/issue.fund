// Public GitHub metadata only. This client never accepts credentials and never
// mutates GitHub. Its checks improve funding UX; the escrow verifies receipts.
export function parseRepo(value) {
  let name = String(value).trim();
  if (name.startsWith("https://")) {
    const url = new URL(name);
    if (url.origin !== "https://github.com")
      throw new Error("Use a public repository on github.com.");
    name = url.pathname.replace(/^\//, "").replace(/\/$/, "");
  }
  name = name.replace(/\.git$/, "");
  if (
    !/^[A-Za-z0-9-]+\/[A-Za-z0-9_.-]+$/.test(name) ||
    name.length > 140 ||
    /\/(\.|\.\.)$/.test(name)
  )
    throw new Error(
      "Enter a repository as owner/repo or https://github.com/owner/repo.",
    );
  return name;
}

export function parseIssue(value) {
  let url;
  try {
    url = new URL(String(value).trim());
  } catch {
    /* handled below */
  }
  const match =
    url?.origin === "https://github.com" &&
    url.pathname.match(/^\/([^/]+\/[^/]+)\/issues\/([1-9]\d*)\/?$/);
  if (!match || !Number.isSafeInteger(Number(match[2])))
    throw new Error(
      "Enter a GitHub issue URL, such as https://github.com/owner/repo/issues/42.",
    );
  return { repo: parseRepo(match[1]), number: Number(match[2]) };
}

export function repoProblem(repo) {
  if (
    repo.private !== false ||
    (repo.visibility && repo.visibility !== "public")
  )
    return "Only public repositories are supported.";
  if (repo.archived)
    return "This repository is archived. Choose an active repository.";
  if (repo.disabled) return "This repository is disabled on GitHub.";
  if (!repo.has_issues) return "Issues are disabled for this repository.";
  if (!repo.default_branch)
    return "This repository has no default branch. Add its first commit on GitHub.";
  if (!/^[a-zA-Z0-9_./-]{1,64}$/.test(repo.default_branch))
    return "This default branch is not supported by the deployed receipt verifier (1–64 ASCII letters, digits, dots, slashes, underscores or hyphens).";
  return "";
}

export function createGithubClient(fetcher = fetch) {
  async function request(path) {
    let response;
    try {
      response = await fetcher(`https://api.github.com${path}`, {
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        credentials: "omit",
        referrerPolicy: "no-referrer",
        cache: "no-store",
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      throw new Error(
        "Cannot reach GitHub. Check your connection and try again. No funds were sent.",
      );
    }
    if (!response.ok) {
      if (response.status === 404)
        throw Object.assign(
          new Error(
            "Not found on public GitHub. Check the URL; private repositories are not supported.",
          ),
          { status: 404 },
        );
      if (response.status === 410)
        throw new Error(
          "Issues are disabled or this resource was removed from GitHub.",
        );
      if (
        response.status === 429 ||
        (response.status === 403 &&
          response.headers.get("x-ratelimit-remaining") === "0")
      ) {
        const reset = Number(response.headers.get("x-ratelimit-reset"));
        throw new Error(
          `GitHub’s public API limit has been reached.${reset ? ` Try again after ${new Date(reset * 1000).toLocaleTimeString()}.` : " Wait a few minutes and retry."} Retry the check before continuing.`,
        );
      }
      if (response.status === 403)
        throw new Error(
          "GitHub temporarily refused this request. Wait a few minutes and retry, or check the repository on GitHub.",
        );
      throw new Error(
        `GitHub could not complete the lookup (${response.status}). Please retry.`,
      );
    }
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error("GitHub returned an unreadable response. Please retry.");
    }
    return {
      data,
      more: /rel="next"/.test(response.headers.get("link") ?? ""),
    };
  }
  async function getRepo(value) {
    const name = parseRepo(value);
    const { data } = await request(`/repos/${name}`);
    const problem = repoProblem(data);
    if (problem) throw new Error(problem);
    if (
      !Number.isSafeInteger(data.id) ||
      data.id < 1 ||
      !data.full_name ||
      parseRepo(data.full_name) !== data.full_name
    )
      throw new Error("GitHub returned an invalid repository identity.");
    return {
      id: data.id,
      name: data.full_name,
      description: String(data.description ?? ""),
      branch: data.default_branch,
      url: `https://github.com/${data.full_name}`,
    };
  }
  function issueFrom(data, repo) {
    if (data.pull_request)
      throw new Error("This is a pull request. Choose a GitHub issue to fund.");
    const ref = parseIssue(data.html_url);
    if (
      ref.repo.toLowerCase() !== repo.name.toLowerCase() ||
      ref.number !== data.number ||
      !Number.isSafeInteger(data.id)
    )
      throw new Error(
        "This issue moved to another repository. Open its current GitHub URL and add that repository first.",
      );
    return {
      id: data.id,
      number: data.number,
      title: String(data.title),
      body: String(data.body ?? ""),
      state: data.state,
      url: `${repo.url}/issues/${data.number}`,
      comments: Number(data.comments ?? 0),
      labels: (data.labels ?? [])
        .map((l) => (typeof l === "string" ? l : l.name))
        .filter((l) => typeof l === "string"),
      updatedAt: data.updated_at,
    };
  }
  async function getIssue(repo, number) {
    if (!Number.isSafeInteger(number) || number < 1)
      throw new Error("Choose a valid issue number.");
    const { data } = await request(
      `/repos/${parseRepo(repo.name)}/issues/${number}`,
    );
    return issueFrom(data, repo);
  }
  async function inspectIssue(url, expected) {
    const ref = parseIssue(url);
    const repo = await getRepo(ref.repo);
    if (
      expected &&
      (repo.id !== expected.repo.id ||
        repo.name !== expected.repo.name ||
        repo.branch !== expected.repo.branch)
    )
      throw new Error(
        "The repository identity, name or default branch changed. Check the issue again before funding.",
      );
    const [issue, branchResult] = await Promise.all([
      getIssue(repo, ref.number),
      request(
        `/repos/${repo.name}/branches/${encodeURIComponent(repo.branch)}`,
      ),
    ]);
    if (branchResult.data.name !== repo.branch)
      throw new Error("The default branch changed. Check the issue again.");
    if (issue.state !== "open")
      throw new Error(
        "This issue is closed. Choose an open issue before funding.",
      );
    if (expected && issue.id !== expected.issue.id)
      throw new Error(
        "The issue identity changed. Check its current GitHub URL before funding.",
      );
    return { repo, issue, checkedAt: Date.now() };
  }
  async function listIssues(
    repo,
    { state = "open", query = "", page = 1 } = {},
  ) {
    if (
      !["open", "closed", "all"].includes(state) ||
      !Number.isSafeInteger(page) ||
      page < 1
    )
      throw new Error("Invalid issue filters.");
    const name = parseRepo(repo.name);
    if (query.trim()) {
      // Quote search words so typed qualifiers cannot widen the selected repo.
      const words = query
        .trim()
        .slice(0, 180)
        .replace(/["\\]/g, " ")
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => `"${w}"`)
        .join(" ");
      const q = `repo:${name} is:issue${state === "all" ? "" : ` is:${state}`} ${words}`;
      const { data, more } = await request(
        `/search/issues?${new URLSearchParams({ q, sort: "created", order: "desc", per_page: "20", page: String(page) })}`,
      );
      return {
        items: data.items
          .filter((i) => !i.pull_request)
          .map((i) => issueFrom(i, repo)),
        more: more && page < 50,
        limited: data.total_count > 1000,
        incomplete: !!data.incomplete_results,
      };
    }
    const { data, more } = await request(
      `/repos/${name}/issues?state=${state}&sort=created&direction=desc&per_page=20&page=${page}`,
    );
    if (!Array.isArray(data))
      throw new Error("GitHub returned an invalid issue list.");
    return {
      items: data.filter((i) => !i.pull_request).map((i) => issueFrom(i, repo)),
      more,
      limited: false,
      incomplete: false,
    };
  }
  return { getRepo, getIssue, inspectIssue, listIssues, request };
}
