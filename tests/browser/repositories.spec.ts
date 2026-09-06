import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import AxeBuilder from "@axe-core/playwright";
const account = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const abi = JSON.parse(
  fs.readFileSync("out/MergeBounty.sol/MergeBounty.json", "utf8"),
).abi;
const issue = (number = 7, state = "open") => ({
  id: 300 + number,
  number,
  state,
  title: number === 7 ? "Fix parser for empty input" : `Issue ${number}`,
  body: "Acceptance: return an empty result.\n<script>window.pwned = true</script>",
  labels: [{ name: "good first issue" }],
  html_url: `https://github.com/Public/project/issues/${number}`,
});
async function setup(page: Page, bounties: unknown[] = []) {
  const data = {
    private: false,
    closed: false,
    branch: "trunk",
    repoId: 101,
    apiStatus: 200,
    extraIssue: false,
    requests: [] as string[],
    transactions: 0,
  };
  await page.route("**/api/**", (r) =>
    r.fulfill({
      json:
        new URL(r.request().url()).pathname === "/api/config"
          ? {
              chainId: 31337,
              chainTime: Math.floor(Date.now() / 1000),
              chainName: "Anvil",
              contract: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
              local: true,
              abi,
            }
          : new URL(r.request().url()).pathname === "/api/bounties"
            ? bounties
            : { amount: "0" },
    }),
  );
  await page.route("**/rpc", (r) => {
    const req = r.request().postDataJSON();
    if (req.method === "eth_sendTransaction") data.transactions++;
    return r.fulfill({
      json: {
        jsonrpc: "2.0",
        id: req.id,
        result: req.method === "eth_accounts" ? [account] : "0x7a69",
      },
    });
  });
  await page.route("https://api.github.com/**", async (r) => {
    const url = new URL(r.request().url());
    data.requests.push(url.toString());
    expect(r.request().headers().authorization).toBeUndefined();
    expect(r.request().method()).toBe("GET");
    if (data.apiStatus !== 200)
      return r.fulfill({
        status: data.apiStatus,
        headers: { "x-ratelimit-remaining": "0" },
        json: {},
      });
    if (url.pathname === "/search/issues")
      return r.fulfill({
        json: { items: [issue(8)], total_count: 1, incomplete_results: false },
      });
    if (url.pathname.endsWith("/issues"))
      return r.fulfill({
        json:
          url.searchParams.get("page") === "2"
            ? [issue(9)]
            : url.searchParams.get("state") === "closed"
              ? [issue(10, "closed")]
              : [
                  issue(),
                  { ...issue(11), pull_request: {} },
                  ...(data.extraIssue ? [issue(12)] : []),
                ],
        headers:
          url.searchParams.get("page") === "1"
            ? {
                link: '<https://api.github.com/repos/Public/project/issues?page=2>; rel="next"',
                "access-control-expose-headers": "Link",
              }
            : {},
      });
    if (url.pathname.includes("/issues/"))
      return r.fulfill({
        json: issue(
          Number(url.pathname.split("/").at(-1)),
          data.closed ? "closed" : "open",
        ),
      });
    if (url.pathname.includes("/branches/"))
      return r.fulfill({ json: { name: data.branch } });
    return r.fulfill({
      json: {
        id: data.repoId,
        full_name: "Public/project",
        private: data.private,
        has_issues: true,
        default_branch: data.branch,
        description: "A useful public project",
      },
    });
  });
  await page.goto("/#repositories");
  return data;
}
async function addRepo(page: Page) {
  await page
    .getByLabel("Public GitHub repository")
    .fill("https://github.com/public/project");
  await page
    .getByRole("button", { name: "Add repository", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Choose an issue" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Fix parser for empty input",
      exact: true,
    }),
  ).toBeVisible();
}
async function connect(page: Page) {
  await page
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  await page.getByRole("button", { name: /Local test wallet/ }).click();
  await page.getByRole("button", { name: /Test wallet 1/ }).click();
}
async function review(page: Page) {
  await page.getByRole("button", { name: "Fund issue", exact: true }).click();
  await expect(page.getByText("OPEN · PUBLIC REPOSITORY")).toBeVisible();
  await page.getByLabel("Reward in ETH").fill("0.01");
  await page.getByRole("checkbox", { name: /I understand the escrow/ }).check();
}
test("public repo onboarding persists canonical identity and renders issue text safely", async ({
  page,
}) => {
  await setup(page);
  await addRepo(page);
  await expect(
    page.getByRole("heading", { name: "Public/project", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("trunk · default branch", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Issue 11", { exact: true })).toHaveCount(0);
  await page
    .getByRole("button", { name: "Fix parser for empty input", exact: true })
    .click();
  await expect(page.locator(".issue-body")).toContainText("<script>");
  expect(await page.evaluate(() => (window as any).pwned)).toBeUndefined();
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Public/project Browse issues" }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Remove Public/project from saved repositories",
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "Add your first repository" }),
  ).toBeVisible();
});
test("public-only rejection and rate limit failure recover without a GitHub connection", async ({
  page,
}) => {
  const data = await setup(page);
  data.private = true;
  await page.getByLabel("Public GitHub repository").fill("Public/project");
  await page
    .getByRole("button", { name: "Add repository", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Only public repositories",
  );
  data.private = false;
  data.apiStatus = 429;
  await page
    .getByRole("button", { name: "Add repository", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("public API limit");
  data.apiStatus = 200;
  await addRepo(page);
  await expect(
    page.getByRole("button", { name: /Connect GitHub/ }),
  ).toHaveCount(0);
});
test("issues paginate, search across the repository, and prevent funding closed issues", async ({
  page,
}) => {
  const data = await setup(page);
  await addRepo(page);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Issue 9", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Next", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Search GitHub issues").fill("parser");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Issue 8", exact: true }),
  ).toBeVisible();
  expect(
    data.requests.some(
      (url) =>
        new URL(url).searchParams.get("q") ===
        'repo:Public/project is:issue is:open "parser"',
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await page
    .getByRole("button", { name: "Closed issues", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Issue closed", exact: true }),
  ).toBeDisabled();
});
test("issue creation hands off to GitHub and refreshes the returned issue", async ({
  page,
}) => {
  const data = await setup(page);
  await addRepo(page);
  await page.getByRole("button", { name: "Create issue", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Open GitHub issue form" }),
  ).toHaveAttribute(
    "href",
    "https://github.com/Public/project/issues/new/choose",
  );
  await expect(
    page.getByRole("link", { name: "Open GitHub issue form" }),
  ).toHaveAttribute("target", "_blank");
  data.extraIssue = true;
  await page
    .getByRole("button", { name: "Refresh issue list", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Issue 12", exact: true }),
  ).toBeVisible();
});
test("final preflight catches an issue closed after review before any wallet transaction", async ({
  page,
}) => {
  const data = await setup(page);
  await connect(page);
  await addRepo(page);
  await review(page);
  await expect(page.getByLabel("Target branch")).toHaveCount(0);
  data.closed = true;
  await page.getByRole("button", { name: "Fund bounty", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("This issue is closed");
  expect(data.transactions).toBe(0);
  await expect(page.getByLabel("Reward in ETH")).toHaveValue("0.01");
});
test("final preflight catches a changed default branch and private visibility", async ({
  page,
}) => {
  const data = await setup(page);
  await connect(page);
  await addRepo(page);
  await review(page);
  data.branch = "main";
  await page.getByRole("button", { name: "Fund bounty", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("default branch changed");
  data.branch = "trunk";
  data.private = true;
  await page.getByRole("button", { name: "Fund bounty", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Only public repositories",
  );
  expect(data.transactions).toBe(0);
});
test("changing an issue URL invalidates its reviewed payment terms", async ({
  page,
}) => {
  await setup(page);
  await addRepo(page);
  await page.getByRole("button", { name: "Fund issue", exact: true }).click();
  await expect(page.getByText("OPEN · PUBLIC REPOSITORY")).toBeVisible();
  await page
    .getByLabel("GitHub issue URL")
    .fill("https://github.com/Public/project/issues/8");
  await expect(page.getByLabel("Reward in ETH")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Fund bounty", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Review issue", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Issue 8", exact: true }),
  ).toBeVisible();
});
test("duplicate bounty review is explicit and links back to existing escrow", async ({
  page,
}) => {
  await setup(page, [
    {
      id: 2,
      issue: 7,
      repo: "Public/project",
      status: 0,
      funder: account,
      amount: "10000000000000000",
      deadline: 9999999999,
    },
  ]);
  await connect(page);
  await addRepo(page);
  await review(page);
  await expect(
    page.getByRole("button", { name: "Fund bounty", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("checkbox", { name: "Create a separate bounty for this issue" })
    .check();
  await expect(
    page.getByRole("button", { name: "Fund bounty", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("dialog").getByRole("link", { name: "View bounty #2" }),
  ).toHaveAttribute("href", "#bounty-2");
});
test("repo and funding screens fit mobile and pass accessibility checks", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await addRepo(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: ".local/public-repo-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Fund issue", exact: true }).click();
  await expect(page.getByText("OPEN · PUBLIC REPOSITORY")).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: ".local/public-funding-mobile.png",
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
