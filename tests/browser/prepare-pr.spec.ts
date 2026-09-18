import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
const wallet = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const other = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
const config = {
  ...JSON.parse(fs.readFileSync("public/deployment.gnosis.json", "utf8")),
  chainTime: Date.now() / 1000,
  local: false,
  automationUrl: "https://collector.example.invalid",
};
const bounty = {
  id: 77,
  contract: config.contract,
  chainId: 100,
  feeBps: 100,
  funder: other,
  amount: "1000000000000000000",
  createdAt: Date.now() / 1000 - 100,
  deadline: Date.now() / 1000 + 3600,
  issue: 42,
  status: 0,
  recipient: "0x" + "0".repeat(40),
  pr: 0,
  repo: "Public/project",
  branch: "main",
  bountyRef: "0x" + "ab".repeat(32),
  keyHash: config.keyHash,
};
const publicRepo = {
  id: 1,
  full_name: bounty.repo,
  private: false,
  has_issues: true,
  default_branch: "main",
};
async function fixture(page: Page, connected = true) {
  const state = {
    branchMissing: false,
    githubUnavailable: false,
    ready: true,
    hold: undefined as Promise<void> | undefined,
    pr: {
      number: 9,
      html_url: "https://github.com/Public/project/pull/9",
      title: `[bounty ${bounty.bountyRef}] [wallet ${wallet}] Fix input`,
      body: "Closes #42\n\n## Tests\nExisting checklist",
      state: "open",
      merged: false,
      base: { ref: "main", repo: publicRepo },
    },
  };
  await page.addInitScript(
    ({ wallet, connected }) => {
      let accounts = connected ? [wallet] : [];
      const events: Record<string, Function> = {};
      (window as any).changePrWallet = (address: string) => {
        accounts = address ? [address] : [];
        events.accountsChanged?.(accounts);
      };
      window.ethereum = {
        request: async ({ method }) => {
          if (method === "eth_requestAccounts") {
            accounts = [wallet];
            return accounts;
          }
          if (method === "eth_accounts") return accounts;
          if (method === "eth_chainId") return "0x64";
          throw Error("Unexpected wallet method " + method);
        },
        on: (name, fn) => {
          events[name] = fn;
        },
        removeListener: (name) => {
          delete events[name];
        },
      };
    },
    { wallet, connected },
  );
  await page.route("**/api/**", (route) => {
    const p = new URL(route.request().url()).pathname;
    return route.fulfill({
      json:
        p === "/api/config"
          ? config
          : p === "/api/bounties"
            ? [bounty]
            : { amount: "0", escrows: [] },
    });
  });
  await page.route("https://collector.example.invalid/**", (route) =>
    route.fulfill({
      json: new URL(route.request().url()).pathname.includes("/issues/")
        ? {
            state: state.ready ? "ready" : "attention",
            code: state.ready ? null : "mailbox_unavailable",
          }
        : { state: "waiting" },
    }),
  );
  await page.route("https://api.github.com/**", async (route) => {
    expect(route.request().method()).toBe("GET");
    expect(route.request().headers()["authorization"]).toBeUndefined();
    const p = new URL(route.request().url()).pathname;
    if (state.githubUnavailable)
      return route.fulfill({ status: 429, json: { message: "rate limit" } });
    if (p.endsWith("/pulls/9")) {
      if (state.hold) await state.hold;
      return route.fulfill({ json: state.pr });
    }
    if (p.includes("/branches/") && state.branchMissing)
      return route.fulfill({ status: 404, json: { message: "not found" } });
    const template = "## Project checklist\n- [ ] Tests pass";
    const data = p.endsWith("/issues/42")
      ? {
          id: 42,
          number: 42,
          title: "Fix input",
          html_url: "https://github.com/Public/project/issues/42",
          state: "open",
          labels: [],
        }
      : p.endsWith("/branches")
        ? [{ name: "fix/input" }, { name: "main" }]
        : p.includes("/branches/")
          ? {
              name: decodeURIComponent(p.split("/branches/")[1]),
              commit: { sha: "abc123" },
            }
          : p.endsWith("/contents/.github")
            ? [
                {
                  type: "file",
                  name: "PULL_REQUEST_TEMPLATE.md",
                  path: ".github/PULL_REQUEST_TEMPLATE.md",
                },
              ]
            : p.endsWith("/contents/.github/PULL_REQUEST_TEMPLATE.md")
              ? {
                  type: "file",
                  size: template.length,
                  encoding: "base64",
                  content: Buffer.from(template).toString("base64"),
                }
              : p.includes("/contents")
                ? []
                : p === "/repos/Contributor/fork"
                  ? {
                      id: 2,
                      full_name: "Contributor/fork",
                      private: false,
                      fork: true,
                      source: { id: 1 },
                    }
                  : publicRepo;
    return route.fulfill({ json: data });
  });
  await page.goto("/");
  await page.getByRole("button", { name: /Public\/project/ }).click();
  if (connected) {
    await page
      .getByRole("button", { name: "Connect wallet", exact: true })
      .click();
    await page.getByRole("button", { name: /Browser wallet/ }).click();
  }
  await page.getByRole("button", { name: "Prepare PR", exact: true }).click();
  return state;
}
async function fill(page: Page) {
  await page
    .getByLabel("Describe your fix", { exact: true })
    .fill("Fix input & edge cases");
  await page.getByLabel("Source branch", { exact: true }).fill("fix/input");
}

test("connects a payout wallet inside preparation and opens an exact prefilled GitHub URL", async ({
  page,
  context,
}) => {
  await fixture(page, false);
  await expect(
    page.getByRole("button", { name: "Prepare GitHub PR", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Connect payout wallet", exact: true })
    .click();
  await page.getByRole("button", { name: /Browser wallet/ }).click();
  await expect(
    page.getByRole("dialog", { name: "Prepare your pull request" }),
  ).toBeVisible();
  await fill(page);
  await page
    .getByRole("button", { name: "Load branches", exact: true })
    .click();
  await expect(page.locator("datalist option")).toHaveCount(2);
  await page
    .getByLabel("Description & repository checklist", { exact: true })
    .fill("My description");
  await page
    .getByLabel("Repository PR template", { exact: true })
    .selectOption(".github/PULL_REQUEST_TEMPLATE.md");
  await page
    .getByRole("button", { name: "Insert template", exact: true })
    .click();
  await expect(
    page.getByLabel("Description & repository checklist", { exact: true }),
  ).toHaveValue(/My description\n\n## Project checklist/);
  await page
    .getByRole("button", { name: "Prepare GitHub PR", exact: true })
    .click();
  const link = page.getByRole("link", {
    name: "Open prefilled PR on GitHub",
    exact: true,
  });
  await expect(link).toBeVisible();
  const url = new URL((await link.getAttribute("href"))!);
  expect(url.pathname).toBe("/Public/project/compare/main...fix%2Finput");
  expect(url.searchParams.get("title")).toBe(
    `[bounty ${bounty.bountyRef}] [wallet ${wallet}] Fix input & edge cases`,
  );
  expect(url.searchParams.get("body")).toBe(
    "Closes #42\n\nMy description\n\n## Project checklist\n- [ ] Tests pass",
  );
  await expect(page.getByText("0.99 xDAI after the claim fee")).toBeVisible();
  await context.route("https://github.com/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<h1>GitHub handoff</h1>",
    }),
  );
  const popupEvent = page.waitForEvent("popup");
  await link.click();
  const popup = await popupEvent;
  await popup.waitForLoadState();
  expect(popup.url()).toBe(url.href);
  await popup.close();
});
test("supports public forks and invalidates generated links on form or wallet changes", async ({
  page,
}) => {
  await fixture(page);
  await fill(page);
  await page
    .getByLabel("Source repository", { exact: true })
    .fill("Contributor/fork");
  await page.getByLabel("Source branch", { exact: true }).fill("fix/input");
  await page
    .getByRole("button", { name: "Prepare GitHub PR", exact: true })
    .click();
  const link = page.getByRole("link", {
    name: "Open prefilled PR on GitHub",
    exact: true,
  });
  await expect(link).toHaveAttribute(
    "href",
    /main\.\.\.Contributor:fix%2Finput/,
  );
  await page
    .getByLabel("Describe your fix", { exact: true })
    .fill("Changed description");
  await expect(link).toHaveCount(0);
  await page
    .getByRole("button", { name: "Prepare GitHub PR", exact: true })
    .click();
  await expect(link).toBeVisible();
  await page.evaluate(
    (address) => (window as any).changePrWallet(address),
    other,
  );
  await expect(link).toHaveCount(0);
  await page
    .getByRole("button", { name: "Prepare GitHub PR", exact: true })
    .click();
  await expect(link).toBeVisible();
  expect(
    new URL((await link.getAttribute("href"))!).searchParams.get("title"),
  ).toContain(other);
});
test("checks existing PRs, preserves descriptions for fixes, and separates collection readiness", async ({
  page,
}) => {
  const state = await fixture(page);
  state.pr.title = state.pr.title.replace(wallet, other);
  state.pr.body = "<!-- Closes #42 -->\n\nExisting checklist";
  state.ready = false;
  await page
    .getByRole("button", { name: "Check existing PR", exact: true })
    .click();
  await page
    .getByLabel("GitHub PR URL", { exact: true })
    .fill(state.pr.html_url);
  await page.getByRole("button", { name: "Check PR", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Update the PR before merge" }),
  ).toBeVisible();
  await expect(
    page.getByText("Payout wallet: needs attention", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Issue-closing line: needs attention", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("PR description", { exact: true })).toHaveValue(
    "Closes #42\n\n<!-- Closes #42 -->\n\nExisting checklist",
  );
  await expect(
    page.getByText("Collector needs attention", { exact: true }),
  ).toBeVisible();
  state.pr.title = state.pr.title.replace(other, wallet);
  state.pr.body = "Fixes #42";
  state.ready = true;
  await page.getByRole("button", { name: "Check PR", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "PR details match" }),
  ).toBeVisible();
  await expect(
    page.getByText("Collector: notifications ready", { exact: true }),
  ).toBeVisible();
  state.pr.merged = true;
  state.pr.state = "closed";
  await page.getByRole("button", { name: "Check PR", exact: true }).click();
  await expect(
    page.getByText("PR is open and unmerged: needs attention"),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "This PR is already merged or closed" }),
  ).toBeVisible();
  await expect(
    page
      .getByLabel("PR preparation result")
      .getByRole("button", { name: "Copy PR title", exact: true }),
  ).toHaveCount(0);
});
test("late lookup responses cannot restore a review after the wallet changes", async ({
  page,
}) => {
  const state = await fixture(page);
  let release!: () => void;
  state.hold = new Promise((resolve) => {
    release = resolve;
  });
  await page
    .getByRole("button", { name: "Check existing PR", exact: true })
    .click();
  await page
    .getByLabel("GitHub PR URL", { exact: true })
    .fill(state.pr.html_url);
  await page.getByRole("button", { name: "Check PR", exact: true }).click();
  await page.evaluate(
    (address) => (window as any).changePrWallet(address),
    other,
  );
  release();
  await expect(page.getByLabel("PR preparation result")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Check PR", exact: true }),
  ).toBeEnabled();
});
test("missing branches and API limits allow retry and manual-copy recovery", async ({
  page,
}) => {
  const state = await fixture(page);
  await fill(page);
  state.branchMissing = true;
  await page
    .getByRole("button", { name: "Prepare GitHub PR", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Not found");
  state.branchMissing = false;
  state.githubUnavailable = true;
  await page
    .getByRole("button", { name: "Prepare GitHub PR", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("API limit");
  await page
    .getByText("Copy the required text manually", { exact: true })
    .click();
  await expect(page.getByLabel("Closing line", { exact: true })).toHaveValue(
    "Closes #42",
  );
  state.githubUnavailable = false;
  await page
    .getByRole("button", { name: "Prepare GitHub PR", exact: true })
    .click();
  await expect(
    page.getByRole("link", {
      name: "Open prefilled PR on GitHub",
      exact: true,
    }),
  ).toBeVisible();
});
test("long templates retain copy controls and give a usable compare link; clipboard failure is actionable", async ({
  page,
}) => {
  await fixture(page);
  await fill(page);
  await page
    .getByLabel("Description & repository checklist", { exact: true })
    .fill("x".repeat(12000));
  await page
    .getByRole("button", { name: "Prepare GitHub PR", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Open comparison on GitHub", exact: true }),
  ).toHaveAttribute(
    "href",
    "https://github.com/Public/project/compare/main...fix%2Finput?quick_pull=1",
  );
  await expect(page.getByLabel("PR description", { exact: true })).toHaveValue(
    "Closes #42\n\n" + "x".repeat(12000),
  );
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: () => Promise.reject(Error("blocked")) },
      configurable: true,
    }),
  );
  await page
    .getByRole("button", { name: "Copy PR description", exact: true })
    .click();
  await expect(
    page.getByText("Select the text above and copy it manually.", {
      exact: true,
    }),
  ).toBeVisible();
});
test("preparation remains keyboard accessible and fits mobile after review", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fixture(page);
  await fill(page);
  await page
    .getByRole("button", { name: "Prepare GitHub PR", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your PR is prepared" }),
  ).toBeVisible();
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    result.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.failureSummary),
    })),
  ).toEqual([]);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      await page
        .locator("dialog[open]")
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("dialog[open]").evaluate((el) => (el.scrollTop = 0));
  await page.screenshot({ path: ".local/prepare-pr-mobile.png" });
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.screenshot({ path: ".local/prepare-pr-desktop.png" });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Prepare PR", exact: true }),
  ).toBeFocused();
});
