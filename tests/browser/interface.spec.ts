import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import AxeBuilder from "@axe-core/playwright";
const account = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const recipient = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const now = Math.floor(Date.now() / 1000);
const abi = JSON.parse(
  fs.readFileSync("out/MergeBounty.sol/MergeBounty.json", "utf8"),
).abi;
const config = {
  chainId: 31337,
  chainTime: now,
  chainName: "Anvil · test ETH",
  contract: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  verifier: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  keyHash: "123",
  experimental: true,
  local: true,
  abi,
};
const open = {
  id: 1,
  funder: account,
  amount: "50000000000000000",
  createdAt: now - 100,
  deadline: now + 86400,
  issue: 42,
  status: 0,
  recipient: "0x" + "0".repeat(40),
  pr: 0,
  repo: "example/parser",
  branch: "main",
  bountyRef: "0x" + "ab".repeat(32),
  keyHash: "123",
};
const paid = {
  ...open,
  id: 2,
  status: 1,
  repo: "example/client",
  issue: 7,
  recipient,
  pr: 8,
};
async function fixture(page: Page) {
  await page.route("https://api.github.com/**", (route) => {
    const p = new URL(route.request().url()).pathname;
    const number = Number(p.match(/\/issues\/(\d+)$/)?.[1]);
    return route.fulfill({
      json: number
        ? {
            id: 300 + number,
            number,
            html_url: `https://github.com/example/parser/issues/${number}`,
            title: "Fix the parser",
            state: "open",
            labels: [],
          }
        : p.includes("/branches/")
          ? { name: "main" }
          : {
              id: 101,
              full_name: "example/parser",
              private: false,
              has_issues: true,
              default_branch: "main",
            },
    });
  });
  await page.route("**/api/**", async (route) => {
    const p = new URL(route.request().url()).pathname;
    const response =
      p === "/api/config"
        ? config
        : p === "/api/bounties"
          ? [paid, open]
          : p.startsWith("/api/credits/")
            ? { amount: "0" }
            : undefined;
    await route.fulfill({
      status: response ? 200 : 400,
      json: response ?? {
        error: "This is not a native merge or issue-closure receipt.",
      },
    });
  });
  await page.route("**/rpc", async (route) => {
    const r = route.request().postDataJSON();
    await route.fulfill({
      json: {
        jsonrpc: "2.0",
        id: r.id,
        result: r.method === "eth_accounts" ? [account, recipient] : "0x7a69",
      },
    });
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Find your next contribution" }),
  ).toBeVisible();
}
async function local(page: Page, n = 1) {
  await page
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  await page.getByRole("button", { name: /Local test wallet/ }).click();
  await page
    .getByRole("button", { name: new RegExp(`Test wallet ${n}`) })
    .click();
}
test("explore filters, search and paid bounty details", async ({ page }) => {
  await fixture(page);
  await expect(
    page.getByRole("heading", { name: /Resolve issue #42/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /Resolve issue #7/ }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Paid", exact: true }).click();
  await page.getByRole("button", { name: /example\/client/ }).click();
  await expect(page.getByText("This bounty has been paid.")).toBeVisible();
  await page.getByRole("button", { name: "All bounties", exact: true }).click();
  await page.getByRole("button", { name: "All", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Search bounties" })
    .fill("no-such-project");
  await expect(
    page.getByRole("heading", { name: "No matching bounties" }),
  ).toBeVisible();
});
test("local wallet connection and disconnect keep recipient instructions clear", async ({
  page,
}) => {
  await fixture(page);
  await local(page, 2);
  await page.getByRole("button", { name: /example\/parser/ }).click();
  await expect(page.locator(".title-template")).toContainText(recipient);
  await expect(
    page.getByRole("button", { name: "Check receipts", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Submit claim", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "0x7099…79C8", exact: true }).click();
  await page.getByRole("button", { name: /Disconnect/ }).click();
  await expect(page.locator(".title-template")).toContainText(
    "YOUR_WALLET_ADDRESS",
  );
});
test("funding form rejects non-issue URLs before offering a payment", async ({
  page,
}) => {
  await fixture(page);
  await local(page);
  await page
    .getByRole("button", { name: "Fund an issue", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "GitHub issue URL" })
    .fill("https://github.com/example/parser/pull/42");
  await page.getByRole("button", { name: "Review issue", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Enter a GitHub issue URL",
  );
  await expect(
    page.getByRole("button", { name: "Fund bounty", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("nested connect dialog returns to funding form", async ({ page }) => {
  await fixture(page);
  await page
    .getByRole("button", { name: "Fund an issue", exact: true })
    .click();
  await page
    .getByLabel("GitHub issue URL")
    .fill("https://github.com/example/parser/issues/43");
  await page.getByRole("button", { name: "Review issue", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  await page.getByRole("button", { name: /Local test wallet/ }).click();
  await page.getByRole("button", { name: /Test wallet 1/ }).click();
  await expect(
    page.getByRole("heading", { name: "Fund a GitHub issue" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Fund bounty", exact: true }),
  ).toBeEnabled();
});
test("missing browser wallet produces an actionable error", async ({
  page,
}) => {
  await fixture(page);
  await page
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  await page.getByRole("button", { name: /Browser wallet/ }).click();
  await expect(page.getByRole("alert")).toContainText(
    "No browser wallet found",
  );
});
test("wallet rejection can be retried", async ({ page }) => {
  await page.addInitScript(() => {
    window.ethereum = {
      request: async () => {
        throw { code: 4001, message: "User rejected" };
      },
    };
  });
  await fixture(page);
  await page
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  await page.getByRole("button", { name: /Browser wallet/ }).click();
  await expect(page.getByRole("alert")).toContainText(
    "cancelled in your wallet",
  );
  await expect(
    page.getByRole("button", { name: /Browser wallet/ }),
  ).toBeEnabled();
});
test("wrong wallet network is visible and can be switched", async ({
  page,
}) => {
  await page.addInitScript((a) => {
    let activeChain = "0x1";
    const listeners: Record<string, (x: any) => void> = {};
    window.ethereum = {
      on: (k, f) => {
        listeners[k] = f;
      },
      removeListener: () => {},
      request: async ({ method }) => {
        if (method === "eth_requestAccounts") return [a];
        if (method === "eth_chainId") return activeChain;
        if (method === "wallet_switchEthereumChain") {
          activeChain = "0x7a69";
          listeners.chainChanged?.(activeChain);
          return null;
        }
        return null;
      },
    };
  }, account);
  await fixture(page);
  await page
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  await page.getByRole("button", { name: /Browser wallet/ }).click();
  await expect(page.getByRole("alert")).toContainText("different network");
  await page.getByRole("button", { name: /Switch to Anvil/ }).click();
  await expect(
    page.getByText("Your wallet is on a different network."),
  ).toHaveCount(0);
});
test("invalid receipt uploads never reach the claim state", async ({
  page,
}) => {
  await fixture(page);
  await page.getByRole("button", { name: /example\/parser/ }).click();
  for (const name of ["Merged PR email", "Issue closure email"])
    await page.getByLabel(name, { exact: true }).setInputFiles({
      name: "invalid.eml",
      mimeType: "message/rfc822",
      buffer: Buffer.from("Not a signed GitHub notification"),
    });
  await page
    .getByRole("button", { name: "Check receipts", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("original GitHub .eml");
  await expect(
    page.getByRole("button", { name: "Submit claim", exact: true }),
  ).toHaveCount(0);
});
test("oversized receipts report errors", async ({ page }) => {
  await fixture(page);
  await page.getByRole("button", { name: /example\/parser/ }).click();
  await page.getByLabel("Merged PR email", { exact: true }).setInputFiles({
    name: "large.eml",
    mimeType: "message/rfc822",
    buffer: Buffer.alloc(100001),
  });
  await expect(page.getByRole("alert")).toContainText("under 100 KB");
  await expect(
    page.getByRole("button", { name: "Submit claim", exact: true }),
  ).toHaveCount(0);
});
test("connection errors expose retry and recover", async ({ page }) => {
  await fixture(page);
  let fail = true;
  await page.route("**/api/config", (r) =>
    r.fulfill({
      status: fail ? 503 : 200,
      json: fail ? { error: "Local chain is offline." } : config,
    }),
  );
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("Local chain is offline");
  fail = false;
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
});
test("mobile pages and guide fit the viewport and support keyboard dismissal", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fixture(page);
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.screenshot({ path: ".local/frontend-mobile.png", fullPage: true });
  await page
    .getByRole("button", { name: "Protocol & privacy", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: /example\/parser/ }).click();
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.screenshot({
    path: ".local/frontend-mobile-detail.png",
    fullPage: true,
  });
});
test("key screens meet automated WCAG accessibility checks", async ({
  page,
}) => {
  await fixture(page);
  for (const screen of ["explore", "detail", "guide"]) {
    if (screen === "detail")
      await page.getByRole("button", { name: /example\/parser/ }).click();
    if (screen === "guide")
      await page
        .getByRole("button", { name: "View the guide", exact: true })
        .click();
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    fs.writeFileSync(
      `.local/accessibility-${screen}.json`,
      JSON.stringify(result.violations, null, 2),
    );
    expect(
      result.violations.map((v) => ({
        id: v.id,
        description: v.description,
        nodes: v.nodes.map((n) => ({
          html: n.html,
          summary: n.failureSummary,
        })),
      })),
    ).toEqual([]);
  }
});
test("withdrawal rejects invalid destinations before asking the wallet", async ({
  page,
}) => {
  await fixture(page);
  await page.route("**/api/credits/**", (r) =>
    r.fulfill({ json: { amount: "50000000000000000" } }),
  );
  await local(page);
  await page.getByRole("button", { name: "Withdraw ETH", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Withdraw your ETH" }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Destination wallet" })
    .fill("0x" + "0".repeat(40));
  await page
    .getByRole("button", { name: "Confirm withdrawal", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "nonzero Ethereum destination",
  );
});
test("rejected funding transaction preserves the form for retry", async ({
  page,
}) => {
  await page.addInitScript((a) => {
    window.ethereum = {
      request: async ({ method }) => {
        if (method === "eth_requestAccounts") return [a];
        if (method === "eth_chainId") return "0x7a69";
        if (method === "eth_sendTransaction")
          throw { code: 4001, message: "User rejected transaction" };
        return null;
      },
    };
  }, account);
  await fixture(page);
  await page.route("**/rpc", (r) => {
    const x = r.request().postDataJSON();
    return r.fulfill({
      json: {
        jsonrpc: "2.0",
        id: x.id,
        result:
          x.method === "eth_getBlockByNumber"
            ? {
                timestamp: `0x${now.toString(16)}`,
                number: "0x1",
                transactions: [],
              }
            : x.method === "eth_call"
              ? "0x" + "1".padStart(64, "0")
              : "0x7a69",
      },
    });
  });
  await page
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  await page.getByRole("button", { name: /Browser wallet/ }).click();
  await page
    .getByRole("button", { name: "Fund an issue", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "GitHub issue URL" })
    .fill("https://github.com/example/parser/issues/43");
  await page.getByRole("button", { name: "Review issue", exact: true }).click();
  await page.getByRole("textbox", { name: "Reward in ETH" }).fill("0.03");
  await page.getByRole("checkbox", { name: /I understand the escrow/ }).check();
  await page.getByRole("button", { name: "Fund bounty", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "cancelled in your wallet",
  );
  await expect(
    page.getByRole("textbox", { name: "Reward in ETH" }),
  ).toHaveValue("0.03");
  await expect(
    page.getByRole("button", { name: "Fund bounty", exact: true }),
  ).toBeEnabled();
});
