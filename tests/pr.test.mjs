import test from "node:test";
import assert from "node:assert/strict";
import {
  bodyFor,
  checkPull,
  compareUrl,
  createPrClient,
  hasClosingReference,
  parsePull,
  titleFor,
  validateBranch,
} from "../shared/pr.mjs";
const wallet = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const bounty = {
  repo: "Public/project",
  issue: 42,
  branch: "main",
  bountyRef: "0x" + "ab".repeat(32),
  status: 0,
  deadline: Date.now() / 1000 + 3600,
  contract: "0x" + "12".repeat(20),
};
const repo = {
  id: 1,
  full_name: bounty.repo,
  private: false,
  has_issues: true,
  default_branch: "main",
};
const good = {
  number: 9,
  html_url: "https://github.com/Public/project/pull/9",
  title: titleFor(bounty, wallet, "Fix empty input"),
  body: "Closes #42",
  state: "open",
  merged: false,
  base: { ref: "main", repo },
};
function fixture(overrides = {}) {
  const requests = [];
  const client = createPrClient(async (url, options) => {
    requests.push(url);
    assert.equal(new URL(url).origin, "https://api.github.com");
    assert.equal(options.credentials, "omit");
    assert.equal(options.headers.Authorization, undefined);
    assert.equal(options.method, undefined);
    const path = new URL(url).pathname;
    const data =
      overrides[path] ??
      (path.endsWith("/pulls/9")
        ? good
        : path.endsWith("/issues/42")
          ? {
              id: 42,
              number: 42,
              state: "open",
              title: "Fix input",
              html_url: "https://github.com/Public/project/issues/42",
            }
          : path.includes("/branches/")
            ? {
                name: decodeURIComponent(path.split("/branches/")[1]),
                commit: { sha: "abc" },
              }
            : repo);
    return data instanceof Response ? data : Response.json(data);
  });
  return { client, requests };
}
test("prefill binds the exact bounty/wallet and safely encodes text and fork branches", () => {
  const title = titleFor(bounty, wallet, "Fix input & edge #1?");
  const body = bodyFor(bounty, "## Tests\n- [x] Parser passes");
  const result = compareUrl(
    bounty,
    "Contributor/renamed-project",
    "fix/ä-input",
    title,
    body,
  );
  const url = new URL(result.url);
  assert.equal(url.origin, "https://github.com");
  assert.equal(
    url.pathname,
    "/Public/project/compare/main...Contributor:fix%2F%C3%A4-input",
  );
  assert.equal(url.searchParams.get("title"), title);
  assert.equal(url.searchParams.get("body"), body);
  assert.equal(url.searchParams.get("quick_pull"), "1");
  assert.equal(body, "Closes #42\n\n## Tests\n- [x] Parser passes");
  assert(
    compareUrl(bounty, bounty.repo, "fix/parser", title, body).url.includes(
      "main...fix%2Fparser",
    ),
  );
});
test("invalid addresses, injected markers and unsupported title/branch inputs cannot generate a handoff", () => {
  for (const address of [
    undefined,
    "0x" + "0".repeat(40),
    bounty.contract,
    "person.eth",
    "0x123",
  ])
    assert.throws(() => titleFor(bounty, address, "Fix"));
  for (const title of [
    "",
    "é",
    "x".repeat(101),
    "Fix [wallet 0x123]",
    "Fix [bounty junk]",
    "Fix\ninput",
  ])
    assert.throws(() => titleFor(bounty, wallet, title));
  for (const branch of [
    "main...evil",
    "../main",
    "main~1",
    "main^",
    "https://github.com/x",
    "a?x=1",
    "a%2Fmain",
    "x.lock",
    "a//b",
    "a b",
    "a@{1}",
    "-x",
    "a\\b",
  ])
    assert.throws(() => validateBranch(branch), branch);
  for (const url of [
    "https://evil.test/a/b/pull/9",
    "https://github.com@evil.test/a/b/pull/9",
    "https://user@github.com/a/b/pull/9",
    "https://github.com/a/b/issues/9",
    "https://github.com/a/b/pull/0",
  ])
    assert.throws(() => parsePull(url));
});
test("closing keywords reject quoted code/comments, other issues and repos; inserted lines escape unclosed blocks", () => {
  for (const body of [
    "Closes #42",
    "Fixes Public/project#42.",
    "Resolves https://github.com/Public/project/issues/42",
    "Closes: #42",
  ])
    assert(hasClosingReference(body, bounty), body);
  for (const body of [
    "Closes #420",
    "Closes Other/project#42",
    "Closes https://github.com/Other/project/issues/42",
    "<!-- Closes #42 -->",
    "> Closes #42",
    "    Closes #42",
    "```\nCloses #42\n```",
    "`Closes #42`",
    "~~~\nCloses #42\n~~~",
  ])
    assert(!hasClosingReference(body, bounty), body);
  assert.equal(bodyFor(bounty, "Fixes #42"), "Fixes #42");
  assert(
    hasClosingReference(bodyFor(bounty, "```\nunclosed code block"), bounty),
  );
  assert(hasClosingReference(bodyFor(bounty, "<!-- unclosed comment"), bounty));
});
test("long bodies preserve the entire template and use the copy fallback", () => {
  const body = bodyFor(bounty, "x".repeat(15000));
  const out = compareUrl(
    bounty,
    bounty.repo,
    "fix/input",
    titleFor(bounty, wallet, "Fix"),
    body,
  );
  assert.equal(out.url, null);
  assert(out.tooLong);
  assert.equal(
    out.compareUrl,
    "https://github.com/Public/project/compare/main...fix%2Finput?quick_pull=1",
  );
  assert(body.endsWith("x".repeat(15000)));
});
test("PR checks reject wrong terms, duplicate/incomplete markers, edited payouts and merged PRs", () => {
  assert(checkPull(bounty, wallet, good).every((c) => c.ok));
  for (const [patch, id] of [
    [{ title: good.title + " [wallet 0x" }, "wallet"],
    [{ title: good.title + " [bounty 0x" }, "bounty"],
    [{ title: good.title.replace(wallet, "0x" + "34".repeat(20)) }, "wallet"],
    [
      { title: good.title.replace(bounty.bountyRef, "0x" + "cd".repeat(32)) },
      "bounty",
    ],
    [{ body: "<!-- Closes #42 -->" }, "issue"],
    [{ merged: true, state: "closed" }, "state"],
    [{ base: { ...good.base, ref: "release" } }, "branch"],
    [
      { base: { ...good.base, repo: { ...repo, full_name: "Other/project" } } },
      "repo",
    ],
  ])
    assert.equal(
      checkPull(bounty, wallet, { ...good, ...patch }).find((c) => c.id === id)
        .ok,
      false,
      id,
    );
  assert.equal(
    checkPull({ ...bounty, deadline: 0 }, wallet, good).find(
      (c) => c.id === "window",
    ).ok,
    false,
  );
});
test("public preflight verifies branches, fork network and the open issue without credentials or writes", async () => {
  const { client } = fixture({
    "/repos/Contributor/renamed": {
      id: 2,
      full_name: "Contributor/renamed",
      private: false,
      fork: true,
      source: { id: 1 },
    },
  });
  assert.equal((await client.context(bounty)).issue.number, 42);
  assert.equal(
    (await client.source(bounty, "Contributor/renamed", "fix/input")).sha,
    "abc",
  );
  assert.equal((await client.pull(good.html_url)).number, 9);
  await assert.rejects(
    client.source(bounty, bounty.repo, "main"),
    /work branch/,
  );
  await assert.rejects(
    fixture({
      "/repos/Contributor/renamed": {
        id: 2,
        full_name: "Contributor/renamed",
        private: false,
        fork: true,
        source: { id: 3 },
      },
    }).client.source(bounty, "Contributor/renamed", "fix/input"),
    /network/,
  );
  await assert.rejects(
    fixture({
      "/repos/Public/project": { ...repo, default_branch: "trunk" },
    }).client.context(bounty),
    /changed/,
  );
  await assert.rejects(
    fixture({
      "/repos/Public/project/issues/42": {
        id: 42,
        number: 42,
        state: "closed",
        html_url: "https://github.com/Public/project/issues/42",
      },
    }).client.context(bounty),
    /no longer open/,
  );
});
test("API failures and missing branches are actionable; missing template folders are optional", async () => {
  await assert.rejects(
    fixture({
      "/repos/Public/project/branches/fix%2Finput": new Response("", {
        status: 404,
      }),
    }).client.source(bounty, bounty.repo, "fix/input"),
    /Not found/,
  );
  await assert.rejects(
    createPrClient(async () => {
      throw Error("offline");
    }).context(bounty),
    /Cannot reach GitHub/,
  );
  await assert.rejects(
    fixture({
      "/repos/Public/project": new Response("", { status: 429 }),
    }).client.context(bounty),
    /API limit/,
  );
  assert.deepEqual(
    await createPrClient(
      async () => new Response("", { status: 404 }),
    ).templates(bounty),
    [],
  );
});
test("templates are bounded UTF-8 and never fetched from arbitrary download URLs", async () => {
  const text = "## Checklist\n- [ ] Tests pass ✓";
  const { client, requests } = fixture({
    "/repos/Public/project/contents": [],
    "/repos/Public/project/contents/docs": [],
    "/repos/Public/project/contents/.github": [
      {
        type: "file",
        name: "PULL_REQUEST_TEMPLATE.md",
        path: ".github/PULL_REQUEST_TEMPLATE.md",
        download_url: "https://evil.test/template",
      },
    ],
    "/repos/Public/project/contents/.github/PULL_REQUEST_TEMPLATE.md": {
      type: "file",
      encoding: "base64",
      size: Buffer.byteLength(text),
      content: Buffer.from(text).toString("base64"),
    },
  });
  const list = await client.templates(bounty);
  assert.equal(list[0].path, ".github/PULL_REQUEST_TEMPLATE.md");
  assert.equal(await client.template(bounty, list[0].path), text);
  assert(requests.every((u) => u.startsWith("https://api.github.com/")));
  await assert.rejects(
    client.template(bounty, "../secrets"),
    /Choose a repository/,
  );
});
