import test from "node:test";
import assert from "node:assert/strict";
import {
  createGithubClient,
  parseIssue,
  parseRepo,
} from "../shared/github.mjs";

const repo = {
  id: 101,
  full_name: "Public/project",
  private: false,
  visibility: "public",
  has_issues: true,
  default_branch: "trunk",
  description: "A public project",
};
const issue = {
  id: 303,
  number: 7,
  title: "Fix parser",
  body: "Clear acceptance criteria",
  state: "open",
  html_url: "https://github.com/Public/project/issues/7",
  labels: [{ name: "bug" }],
};
function fixture(overrides = {}) {
  const requests = [];
  const client = createGithubClient(async (url, options) => {
    const path = new URL(url).pathname;
    requests.push({ url, options });
    assert.equal(new URL(url).origin, "https://api.github.com");
    assert.equal(options.credentials, "omit");
    assert.equal(options.headers.Authorization, undefined);
    assert.equal(options.method, undefined);
    const result =
      overrides[path] ??
      (path.endsWith("/issues/7")
        ? issue
        : path.includes("/branches/")
          ? { name: "trunk" }
          : repo);
    return result instanceof Response ? result : Response.json(result);
  });
  return { client, requests };
}
test("repository and issue inputs cannot escape github.com or contract name limits", () => {
  assert.equal(
    parseRepo(" https://github.com/Public/project.git/ "),
    "Public/project",
  );
  assert.deepEqual(
    parseIssue("https://github.com/Public/project/issues/7#issuecomment-1"),
    { repo: "Public/project", number: 7 },
  );
  for (const name of [
    "https://evil.test/a/b",
    "a/../b",
    "a/b/issues/7",
    "https://github.com@evil.test/a/b",
    "a/..",
    "a/" + "x".repeat(140),
  ])
    assert.throws(() => parseRepo(name));
  for (const url of [
    "https://github.com/Public/project/pull/7",
    "https://github.com/Public/project/issues/0",
    "https://github.com/Public/project/issues/9007199254740993",
    "https://evil.test/Public/project/issues/7",
  ])
    assert.throws(() => parseIssue(url));
});
test("preflight resolves canonical case, open issue and actual default branch without credentials", async () => {
  const { client, requests } = fixture();
  const result = await client.inspectIssue(
    "https://github.com/public/project/issues/7",
  );
  assert.equal(result.repo.name, "Public/project");
  assert.equal(result.repo.branch, "trunk");
  assert.equal(result.issue.id, 303);
  assert.equal(requests.length, 3);
  assert.ok(requests.some((r) => r.url.endsWith("/branches/trunk")));
});
test("private, archived, disabled, issue-less and incompatible repositories fail before issue lookup", async () => {
  for (const patch of [
    { private: true },
    { visibility: "internal" },
    { archived: true },
    { disabled: true },
    { has_issues: false },
    { default_branch: "" },
    { default_branch: "rélease" },
    { default_branch: "x".repeat(65) },
  ]) {
    const { client, requests } = fixture({
      "/repos/Public/project": { ...repo, ...patch },
    });
    await assert.rejects(client.inspectIssue(issue.html_url));
    assert.equal(requests.length, 1);
  }
});
test("closed issues, pull requests and transferred issues cannot be funded", async () => {
  for (const patch of [
    { state: "closed" },
    { pull_request: {} },
    { html_url: "https://github.com/Other/project/issues/7" },
  ]) {
    const { client } = fixture({
      "/repos/Public/project/issues/7": { ...issue, ...patch },
    });
    await assert.rejects(client.inspectIssue(issue.html_url));
  }
});
test("final funding check rejects replacement repos, renames, branch changes and replacement issues", async () => {
  const expected = await fixture().client.inspectIssue(issue.html_url);
  for (const patch of [
    { id: 102 },
    { full_name: "Public/renamed" },
    { default_branch: "main" },
  ]) {
    await assert.rejects(
      fixture({
        "/repos/Public/project": { ...repo, ...patch },
      }).client.inspectIssue(issue.html_url, expected),
      /changed/,
    );
  }
  await assert.rejects(
    fixture({
      "/repos/Public/project/issues/7": { ...issue, id: 304 },
    }).client.inspectIssue(issue.html_url, expected),
    /identity changed/,
  );
});
test("missing default branch and API outage fail closed", async () => {
  await assert.rejects(
    fixture({
      "/repos/Public/project/branches/trunk": new Response("", { status: 404 }),
    }).client.inspectIssue(issue.html_url),
    /Not found/,
  );
  await assert.rejects(
    createGithubClient(async () => {
      throw new Error("offline");
    }).inspectIssue(issue.html_url),
    /No funds were sent/,
  );
  await assert.rejects(
    fixture({
      "/repos/Public/project": new Response("", {
        status: 429,
        headers: { "x-ratelimit-reset": "1800000000" },
      }),
    }).client.inspectIssue(issue.html_url),
    /API limit/,
  );
});
test("issue pagination excludes pull requests but retains the next page", async () => {
  const { client } = fixture({
    "/repos/Public/project/issues": Response.json(
      [
        { ...issue, pull_request: {} },
        {
          ...issue,
          id: 400,
          number: 8,
          html_url: "https://github.com/Public/project/issues/8",
        },
      ],
      {
        headers: {
          link: '<https://api.github.com/repos/Public/project/issues?page=2>; rel="next"',
        },
      },
    ),
  });
  const result = await client.listIssues(
    await client.getRepo("Public/project"),
  );
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].number, 8);
  assert.equal(result.more, true);
});
test("search remains scoped to the selected repo and reports partial/limited results", async () => {
  const { client, requests } = fixture({
    "/search/issues": Response.json(
      { items: [issue], total_count: 1200, incomplete_results: true },
      {
        headers: {
          link: '<https://api.github.com/search/issues?page=2>; rel="next"',
        },
      },
    ),
  });
  const result = await client.listIssues(
    await client.getRepo("Public/project"),
    { query: "parser repo:evil/repo", page: 1 },
  );
  const q = new URL(requests.at(-1).url).searchParams.get("q");
  assert.equal(
    q,
    'repo:Public/project is:issue is:open "parser" "repo:evil/repo"',
  );
  assert.equal(result.more, true);
  assert.equal(result.limited, true);
  assert.equal(result.incomplete, true);
});
