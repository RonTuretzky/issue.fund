import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { fixture, rpc, restore } from "../helpers/chain.mjs";
import { parseEther } from "viem";
import fs from "node:fs";

test.use({ actionTimeout: 10000 });

test("funding opened before configuration arrives defaults to automatic collection", async ({
  page,
}) => {
  let releaseConfig!: () => void;
  const ready = new Promise<void>((resolve) => {
    releaseConfig = resolve;
  });
  const config = JSON.parse(
    fs.readFileSync("public/deployment.gnosis.json", "utf8"),
  );
  await page.route("**/api/**", async (route) => {
    if (new URL(route.request().url()).pathname === "/api/config") {
      await ready;
      await route.fulfill({
        json: { ...config, automationUrl: "https://collector.example.invalid" },
      });
    } else await route.fulfill({ json: [] });
  });
  await page.route("https://api.github.com/**", (route) =>
    route.fulfill({
      json: new URL(route.request().url()).pathname.endsWith("/issues/7")
        ? issue
        : new URL(route.request().url()).pathname.includes("/branches/")
          ? { name: "main" }
          : publicRepo,
    }),
  );
  await page.route("https://collector.example.invalid/**", (route) =>
    route.fulfill({
      json: {
        state: "ready",
        repoId: 901,
        issueId: 902,
        branch: "main",
        lastDeliveryAt: Date.now(),
      },
    }),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Fund an issue", exact: true })
    .first()
    .click();
  await page.getByLabel("GitHub issue URL").fill(issue.html_url);
  await page.getByRole("button", { name: "Review issue", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Reward in ETH" }),
  ).toBeVisible();
  await expect(
    page.getByRole("radio", { name: "Automatically through the collector" }),
  ).toHaveCount(0);
  releaseConfig();
  await expect(
    page.getByRole("radio", { name: "Automatically through the collector" }),
  ).toBeChecked();
  await expect(
    page.getByText("Notifications ready", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("radio", { name: "I’ll arrange the emails and submit manually" })
    .check();
  await page.getByRole("textbox", { name: "Reward in xDAI" }).fill("0.001");
  await expect(
    page.getByRole("radio", {
      name: "I’ll arrange the emails and submit manually",
    }),
  ).toBeChecked();
});

async function connect(page: Page, n = 1) {
  await page.locator(".wallet-button").click();
  await page.getByRole("button", { name: /Local test wallet/ }).click();
  await page
    .getByRole("button", { name: new RegExp(`Test wallet ${n}`) })
    .click();
}
const publicRepo = {
  id: 901,
  full_name: "Public/project",
  name: "project",
  owner: { login: "Public" },
  default_branch: "main",
  private: false,
  visibility: "public",
  has_issues: true,
  archived: false,
  disabled: false,
  html_url: "https://github.com/Public/project",
};
const issue = {
  id: 902,
  number: 7,
  state: "open",
  title: "Handle empty input",
  body: "Return an empty result",
  labels: [],
  html_url: "https://github.com/Public/project/issues/7",
};
async function autoSetup(page: Page) {
  const f = await fixture(1024, { version: 2 });
  const data = {
    state: "preparing",
    code: "waiting_for_first_notification",
    requests: [] as string[],
    getsFail: false,
  };
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    await route.fulfill({
      json:
        path === "/api/config"
          ? { ...f.config, automationUrl: "https://collector.example.invalid" }
          : path === "/api/bounties"
            ? []
            : { amount: "0" },
    });
  });
  await page.route("https://api.github.com/**", (route) =>
    route.fulfill({
      json: new URL(route.request().url()).pathname.endsWith("/issues/7")
        ? issue
        : new URL(route.request().url()).pathname.includes("/branches/")
          ? { name: "main" }
          : publicRepo,
    }),
  );
  await page.route("https://collector.example.invalid/**", (route) => {
    data.requests.push(route.request().method() + " " + route.request().url());
    expect(route.request().postData() ?? "").not.toContain("signature");
    return route.fulfill({
      json: {
        state:
          data.getsFail && route.request().method() === "GET"
            ? "attention"
            : data.state,
        code: data.code,
        repoId: 901,
        issueId: 902,
        repo: "Public/project",
        issue: 7,
        branch: "main",
        lastCheckedAt: Date.now(),
        ...(data.state === "ready" ? { lastDeliveryAt: Date.now() } : {}),
      },
    });
  });
  await page.goto("/");
  await connect(page);
  await page
    .getByRole("button", { name: /Fund an issue/, exact: true })
    .first()
    .click();
  await page.getByLabel("GitHub issue URL").fill(issue.html_url);
  await page.getByRole("button", { name: "Review issue", exact: true }).click();
  await page.getByRole("textbox", { name: "Reward in ETH" }).fill("2");
  await page
    .getByRole("checkbox", { name: /I understand the escrow terms/ })
    .check();
  return { f, data };
}

test("automatic funding waits for delivery readiness, shows exact fee/net and rechecks before sending", async ({
  page,
}) => {
  test.setTimeout(120000);
  const snapshot = await rpc("evm_snapshot");
  try {
    const { f, data } = await autoSetup(page);
    await expect(
      page.getByRole("button", { name: "Fund bounty", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByLabel("Claim fee and contributor reward"),
    ).toContainText("1% · 0.02 ETH");
    await expect(
      page.getByLabel("Claim fee and contributor reward"),
    ).toContainText("1.98 ETH");
    data.state = "ready";
    data.code = "";
    await page.getByRole("button", { name: "Retry setup" }).click();
    await expect(
      page.getByText("Notifications ready", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Fund bounty", exact: true }),
    ).toBeEnabled();
    const next = await f.read("nextId");
    data.getsFail = true;
    await page
      .getByRole("button", { name: "Fund bounty", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText(
      "Notification readiness changed",
    );
    await expect(
      page.getByText("Notifications ready", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Fund bounty", exact: true }),
    ).toBeDisabled();
    expect(await f.read("nextId")).toBe(next);
    expect(data.requests.some((r) => r.startsWith("GET"))).toBe(true);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: ".local/automation-funding-mobile.png",
      fullPage: true,
    });
  } finally {
    await restore(snapshot);
  }
});

test("explicit manual collection can fund when automatic preparation is unavailable", async ({
  page,
}) => {
  test.setTimeout(120000);
  const snapshot = await rpc("evm_snapshot");
  try {
    const { f } = await autoSetup(page);
    const next = await f.read("nextId");
    await page
      .getByRole("radio", {
        name: "I’ll arrange the emails and submit manually",
      })
      .check();
    await expect(
      page.getByRole("button", { name: "Fund bounty", exact: true }),
    ).toBeEnabled();
    await page
      .getByRole("button", { name: "Fund bounty", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 60000 });
    expect(await f.read("nextId")).toBe(next + 1n);
    expect((await f.read("getBounty", [next])).repo).toBe("Public/project");
  } finally {
    await restore(snapshot);
  }
});

test("legacy links claim against V1 and each escrow balance withdraws independently", async ({
  page,
}) => {
  test.setTimeout(150000);
  const snapshot = await rpc("evm_snapshot");
  try {
    const old = await fixture();
    const current = await fixture(1024, { version: 2 });
    await current.write("claim", [
      1n,
      current.merged.receipt,
      current.closed.receipt,
    ]);
    const config = {
      ...current.config,
      legacyLinkContract: old.config.contract,
      legacyDeployments: [old.config],
    };
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      let body: unknown = {};
      if (path === "/api/config") body = config;
      if (path === "/api/bounties")
        body = (
          await Promise.all(
            [old, current].map(async (f) =>
              (await f.bounties()).map((b) => ({
                ...b,
                chainId: 31337,
                contract: f.config.contract,
              })),
            ),
          )
        ).flat();
      if (path.startsWith("/api/credits/")) {
        const address = path.slice(13);
        const escrows = await Promise.all(
          [current, old].map(async (f) => ({
            contract: f.config.contract,
            amount: String(await f.read("credits", [address])),
          })),
        );
        body = {
          escrows,
          amount: escrows.reduce((n, b) => n + BigInt(b.amount), 0n).toString(),
        };
      }
      await route.fulfill({ json: body });
    });
    await page.goto("/#bounty-1");
    await expect(page.locator(".facts")).toContainText(
      "0% on a successful claim",
    );
    await expect(page.locator(".facts")).toContainText("earlier version");
    await connect(page, 3);
    await page.getByLabel("Merged PR email", { exact: true }).setInputFiles({
      name: "merge.eml",
      mimeType: "message/rfc822",
      buffer: old.merged.raw,
    });
    await page
      .getByLabel("Issue closure email", { exact: true })
      .setInputFiles({
        name: "closure.eml",
        mimeType: "message/rfc822",
        buffer: old.closed.raw,
      });
    await page
      .getByRole("button", { name: "Check receipts", exact: true })
      .click();
    await page
      .getByRole("checkbox", { name: /Submitting makes these emails public/ })
      .check();
    await page
      .getByRole("button", { name: "Submit claim", exact: true })
      .click();
    await expect(page.getByText("This bounty has been paid.")).toBeVisible({
      timeout: 60000,
    });
    expect(await old.read("credits", [old.accounts[1]])).toBe(
      parseEther("0.01"),
    );
    expect(await current.read("credits", [current.accounts[1]])).toBe(
      parseEther("0.0099"),
    );
    await connect(page, 2);
    await expect(page.getByText("0.0199 ETH ready to withdraw")).toBeVisible();
    await page
      .getByRole("button", { name: "Withdraw ETH", exact: true })
      .click();
    await page
      .getByRole("combobox", { name: /Balance to withdraw/ })
      .selectOption(old.config.contract);
    await expect(page.locator(".modal-intro")).toContainText(
      "Withdraw 0.01 ETH",
    );
    await page
      .getByRole("button", { name: "Confirm withdrawal", exact: true })
      .click();
    await expect(
      page.getByText("Withdrawal confirmed. The ETH is in your wallet."),
    ).toBeVisible({ timeout: 60000 });
    expect(await old.read("credits", [old.accounts[1]])).toBe(0n);
    expect(await current.read("credits", [current.accounts[1]])).toBe(
      parseEther("0.0099"),
    );
    await page.goto(
      `/#bounty/31337/${current.config.contract.toLowerCase()}/1`,
    );
    await expect(page.locator(".facts")).toContainText(
      "1% on a successful claim",
    );
    await expect(page.getByText(/PR #43 earned 0.0099 ETH/)).toBeVisible();
    await expect(page.locator(".detail-reward")).toContainText("0.0099");
    await page.screenshot({
      path: ".local/automation-v2-bounty.png",
      fullPage: true,
    });
  } finally {
    await restore(snapshot);
  }
});

test("static API reads both deployed escrows and rejects changed immutable fees", async ({
  page,
}) => {
  test.setTimeout(120000);
  const snapshot = await rpc("evm_snapshot");
  try {
    const old = await fixture();
    const current = await fixture(1024, { version: 2 });
    const config = {
      ...current.config,
      rpcUrl: "http://127.0.0.1:8547",
      legacyDeployments: [old.config],
      legacyLinkContract: old.config.contract,
    };
    await page.route("**/api/**", (route) =>
      route.fulfill({
        json:
          new URL(route.request().url()).pathname === "/api/config"
            ? config
            : [],
      }),
    );
    await page.goto("/");
    const run = async (path: string) =>
      page.evaluate(async (path) => {
        // Exercise the exact browser RPC implementation, using isolated local escrows.
        const module = await import("/src/static-api.ts");
        return module.staticApi(path);
      }, path);
    const checked = await run("/config");
    expect(checked.feeBps).toBe(100);
    await current.write(
      "setFeeRecipient",
      [current.accounts[3]],
      current.accounts[2],
    );
    const rotated = await run("/config");
    expect(rotated.feeRecipient.toLowerCase()).toBe(
      current.accounts[3].toLowerCase(),
    );
    expect(rotated.feeOwner.toLowerCase()).toBe(
      current.accounts[2].toLowerCase(),
    );
    expect(rotated.initialFeeRecipient.toLowerCase()).toBe(
      current.accounts[2].toLowerCase(),
    );
    const list = await run("/bounties");
    expect(list).toHaveLength(2);
    expect(new Set(list.map((b: any) => b.contract.toLowerCase())).size).toBe(
      2,
    );
    expect(list.map((b: any) => b.id)).toEqual([1, 1]);
    const direct = await run(`/bounties/${old.config.contract}/1`);
    expect(direct.bountyRef).toBe((await old.bounties())[0].bountyRef);
    const credits = await run(`/credits/${old.accounts[1]}`);
    expect(credits.escrows).toHaveLength(2);
    expect(credits.amount).toBe("0");
    config.feeBps = 200;
    await page.reload();
    await expect(run("/config")).rejects.toThrow(/deployed fee differs/);
    await expect(
      run("/bounties/0x1111111111111111111111111111111111111111/1"),
    ).rejects.toThrow(/not listed/);
  } finally {
    await restore(snapshot);
  }
});

test("automatic claim progress keeps manual recovery and reconciles settlement with chain state", async ({
  page,
}) => {
  test.setTimeout(120000);
  const snapshot = await rpc("evm_snapshot");
  try {
    const f = await fixture(1024, { version: 2 });
    let progress: any = { state: "waiting" };
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      return route.fulfill({
        status: path.includes("/bounties/") ? 404 : 200,
        json:
          path === "/api/config"
            ? {
                ...f.config,
                automationUrl: "https://collector.example.invalid",
              }
            : path === "/api/bounties"
              ? await f.bounties()
              : { amount: "0" },
      });
    });
    await page.route("https://collector.example.invalid/**", (route) =>
      route.fulfill({ json: progress }),
    );
    for (const [state, title] of Object.entries({
      waiting: "Waiting for GitHub emails",
      queued: "Receipts collected",
      submitted: "Claim submitted",
      credited: "Checking settlement",
      attention: "Automatic claim needs attention",
    })) {
      progress = {
        state,
        code: state === "attention" ? "relay_needs_gas" : null,
      };
      await page.goto("/#bounty-1");
      await page.reload();
      const box = page.getByLabel("Automatic claim status");
      await expect(box).toContainText(title);
      await expect(box).toContainText(
        "You can also submit your own original receipts below",
      );
      if (state === "attention")
        await expect(box).toContainText("relay needs gas funds");
    }
    await page.goto("/#bounty-999");
    await expect(
      page.getByRole("heading", { name: "Bounty unavailable" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "All bounties", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Find your next contribution" }),
    ).toBeVisible();
  } finally {
    await restore(snapshot);
  }
});

test("fee owner rotates recipient, cancels a transfer, and hands control to the accepting wallet", async ({
  page,
}) => {
  test.setTimeout(120000);
  const snapshot = await rpc("evm_snapshot");
  try {
    const f = await fixture(1024, { version: 2 });
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      await route.fulfill({
        json:
          path === "/api/config"
            ? f.config
            : path === "/api/bounties"
              ? await f.bounties()
              : { amount: "0" },
      });
    });
    await page.goto("/");
    await connect(page, 1);
    await expect(page.locator(".fee-settings")).toHaveCount(0);
    await connect(page, 3);
    await page.locator(".fee-settings summary").click();
    const panel = page.locator(".fee-settings");
    const update = panel.getByRole("button", {
      name: "Update fee recipient",
      exact: true,
    });
    await panel
      .getByLabel("New fee recipient")
      .fill("0x0000000000000000000000000000000000000000");
    await expect(update).toBeDisabled();
    await panel.getByLabel("New fee recipient").fill(f.config.contract);
    await expect(update).toBeDisabled();
    await panel.getByLabel("New fee recipient").fill(f.accounts[0]);
    await update.click();
    await expect(panel.getByRole("status")).toContainText(
      "Fee recipient updated",
      { timeout: 30000 },
    );
    expect((await f.read("feeRecipient")).toLowerCase()).toBe(
      f.accounts[0].toLowerCase(),
    );
    expect((await f.read("owner")).toLowerCase()).toBe(
      f.accounts[2].toLowerCase(),
    );
    await panel.getByLabel("New owner wallet").fill(f.accounts[1]);
    await panel.getByRole("button", { name: "Propose owner transfer" }).click();
    await expect(
      panel.getByRole("button", { name: "Cancel owner transfer" }),
    ).toBeEnabled({ timeout: 30000 });
    await panel.getByRole("button", { name: "Cancel owner transfer" }).click();
    await expect(panel.getByRole("status")).toHaveText(
      "Pending owner transfer cancelled.",
      { timeout: 30000 },
    );
    await panel.getByLabel("New owner wallet").fill(f.accounts[1]);
    await panel.getByRole("button", { name: "Propose owner transfer" }).click();
    await expect(panel.getByRole("status")).toContainText("Transfer proposed", {
      timeout: 30000,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: ".local/fee-settings-mobile.png",
      fullPage: true,
    });
    await connect(page, 2);
    await expect(
      panel.getByRole("button", { name: "Update fee recipient" }),
    ).toHaveCount(0);
    await panel.getByRole("button", { name: "Accept ownership" }).click();
    await expect(
      panel.getByRole("button", { name: "Update fee recipient" }),
    ).toBeVisible({ timeout: 30000 });
    expect((await f.read("owner")).toLowerCase()).toBe(
      f.accounts[1].toLowerCase(),
    );
    await connect(page, 3);
    await expect(panel).toHaveCount(0);
  } finally {
    await restore(snapshot);
  }
});
