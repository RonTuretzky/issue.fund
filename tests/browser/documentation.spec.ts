import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { pages } from "../../shared/documentation.mjs";

async function offlineDocs(page: Page, path = "") {
  await page.route("**/api/**", (route) =>
    route.fulfill({ status: 503, json: { error: "RPC unavailable" } }),
  );
  await page.goto("/#docs" + (path ? "/" + path : ""));
}

test("the hub lists and opens every maintainer, contributor and reference guide without a wallet or RPC", async ({
  page,
}) => {
  await offlineDocs(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "A guide for every step.",
  );
  await expect(page.getByRole("alert")).toHaveCount(0);
  const catalogue = page.getByLabel("All documentation guides");
  await expect(catalogue.getByRole("link")).toHaveCount(pages.length);
  for (const doc of pages) {
    await catalogue
      .getByRole("link", {
        name: new RegExp(
          "^" + doc.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        ),
      })
      .click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(doc.title);
    await expect(page).toHaveTitle(doc.title + " · issue.fund");
    await expect(
      page
        .getByRole("navigation", { name: "Documentation pages" })
        .getByRole("link", { name: doc.title, exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: "Documentation", exact: true })
      .click();
  }
  const brokenLinks = await page.locator('a[href^="#docs/"]').evaluateAll(
    (links, ids) =>
      links
        .map((a) => a.getAttribute("href")!.slice(6))
        .filter((id) => !ids.includes(id)),
    pages.map((p) => p.id),
  );
  expect(brokenLinks).toEqual([]);
});

test("documentation deep links reload, preserve history, recover from unknown routes and return to the app", async ({
  page,
}) => {
  await offlineDocs(page, "contributors/prepare-pr");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Prepare your pull request",
  );
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Prepare your pull request",
  );
  await page
    .getByRole("navigation", { name: "Documentation pages" })
    .getByRole("link", { name: "Email privacy", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Email privacy",
  );
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Prepare your pull request",
  );
  await page.goForward();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Email privacy",
  );
  await page.goto("/#docs/missing-page");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Guide not found",
  );
  await page.getByRole("link", { name: "View all documentation" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "A guide for every step.",
  );
  await page
    .getByRole("link", { name: "Browse repositories", exact: true })
    .click();
  await expect(page).toHaveURL(/#repositories$/);
  await expect(page.getByRole("heading", { level: 1 })).not.toHaveText(
    "A guide for every step.",
  );
  await expect(page).toHaveTitle("issue.fund");
});

test("branding appears only in the footer and live pages have no experimental banner", async ({
  page,
}) => {
  await page.route("**/api/config", (route) =>
    route.fulfill({
      json: {
        chainName: "Gnosis",
        chainId: 100,
        experimental: true,
        local: false,
      },
    }),
  );
  await page.route("**/api/bounties", (route) => route.fulfill({ json: [] }));
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "issue.fund", exact: true }),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText(
    /experimental|MergeBounty/i,
  );
  await expect(page.getByRole("contentinfo")).toHaveText("Decentral Park");
  await expect(
    page.locator('img[src="/brand/decentralpark/logo.png"]'),
  ).toHaveCount(1);
  await expect(page.getByRole("contentinfo").locator("img")).toHaveCount(1);
});

test("mobile handbook navigation, tables and contract addresses fit narrow screens", async ({
  page,
}) => {
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await offlineDocs(page);
    await page
      .getByRole("button", { name: "All documentation pages", exact: true })
      .click();
    await expect(
      page
        .getByRole("navigation", { name: "Documentation pages" })
        .getByRole("link"),
    ).toHaveCount(pages.length + 1);
    await page
      .getByRole("navigation", { name: "Documentation pages" })
      .getByRole("link", { name: "Maintainer onboarding", exact: true })
      .click();
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
    await expect(
      page.getByRole("button", {
        name: "All documentation pages",
        exact: true,
      }),
    ).toHaveAttribute("aria-expanded", "false");
    for (const path of [
      "",
      "reference/contracts",
      "reference/troubleshooting",
      "contributors/prepare-pr",
    ]) {
      await page.goto("/#docs" + (path ? "/" + path : ""));
      await expect(page.locator(".docs-content")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${width}px: ${path}`,
      ).toBe(true);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#docs");
  await page.screenshot({ path: ".local/docs-mobile.png", fullPage: true });
});

test("handbook pages pass automated accessibility checks", async ({ page }) => {
  for (const path of [
    "",
    "maintainers/getting-started",
    "contributors/prepare-pr",
    "reference/privacy",
    "reference/contracts",
  ]) {
    await offlineDocs(page, path);
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      result.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.failureSummary),
      })),
      path,
    ).toEqual([]);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/#docs");
  await page.screenshot({ path: ".local/docs-desktop.png", fullPage: true });
});
