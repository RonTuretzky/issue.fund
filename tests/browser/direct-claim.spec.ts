import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { fixture, client, rpc, restore } from "../helpers/chain.mjs";
import { parseEther } from "viem";
test("browser checks locally, consent gates disclosure, relayer submits RSA claim and beneficiary withdraws", async ({
  page,
}) => {
  test.setTimeout(120000);
  const snapshot = await rpc("evm_snapshot");
  try {
    const f = await fixture();
    await page.route("**/api/**", async (route) => {
      const p = new URL(route.request().url()).pathname;
      const response =
        p === "/api/config"
          ? f.config
          : p === "/api/bounties"
            ? await f.bounties()
            : p.startsWith("/api/credits/")
              ? { amount: String(await f.read("credits", [p.slice(13)])) }
              : {};
      await route.fulfill({ json: response });
    });
    await page.goto("/#bounty-1");
    const connect = async (n: number) => {
      await page.locator(".wallet-button").click();
      await page.getByRole("button", { name: /Local test wallet/ }).click();
      await page
        .getByRole("button", { name: new RegExp(`Test wallet ${n}`) })
        .click();
    };
    await connect(3);
    const uploadedRequests: string[] = [];
    page.on("request", (r) => {
      const data = r.postData() ?? "";
      if (
        data.includes("test@example.invalid") ||
        data.includes(f.merged.receipt.body.slice(2, 90)) ||
        /proof|prover|receipts/.test(new URL(r.url()).pathname)
      )
        uploadedRequests.push(r.url());
    });
    const upload = async () => {
      await page
        .getByLabel("Merged PR email", { exact: true })
        .setInputFiles({
          name: "merge.eml",
          mimeType: "message/rfc822",
          buffer: f.merged.raw,
        });
      await page
        .getByLabel("Issue closure email", { exact: true })
        .setInputFiles({
          name: "closure.eml",
          mimeType: "message/rfc822",
          buffer: f.closed.raw,
        });
      await page
        .getByRole("button", { name: "Check receipts", exact: true })
        .click();
      await expect(
        page.getByText("Signatures and bounty match", { exact: true }),
      ).toBeVisible();
    };
    await upload();
    expect(uploadedRequests).toEqual([]);
    await expect(page.locator(".full-address")).toHaveText(f.accounts[1]);
    const submit = page.getByRole("button", {
      name: "Submit claim",
      exact: true,
    });
    await expect(submit).toBeDisabled();
    await page
      .getByRole("checkbox", { name: /Submitting makes these emails public/ })
      .check();
    await expect(submit).toBeEnabled();
    // Selecting another file invalidates both the review and disclosure choice.
    await upload();
    await expect(submit).toBeDisabled();
    expect(uploadedRequests).toEqual([]);
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
    await page
      .getByRole("checkbox", { name: /Submitting makes these emails public/ })
      .check();
    await submit.click();
    await expect(page.getByText("This bounty has been paid.")).toBeVisible({
      timeout: 60000,
    });
    expect(uploadedRequests.length).toBeGreaterThan(0);
    expect(await f.read("credits", [f.accounts[1]])).toBe(parseEther("0.01"));
    expect(await f.read("credits", [f.accounts[2]])).toBe(0n);
    await connect(2);
    await expect(page.getByText("0.01 ETH ready to withdraw")).toBeVisible();
    await page
      .getByRole("button", { name: "Withdraw ETH", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Confirm withdrawal", exact: true })
      .click();
    await expect(
      page.getByText("Withdrawal confirmed. The ETH is in your wallet."),
    ).toBeVisible({ timeout: 60000 });
    expect(await f.read("credits", [f.accounts[1]])).toBe(0n);
    expect(await client.getBalance({ address: f.config.contract })).toBe(0n);
    await page.screenshot({
      path: ".local/direct-claim-ui.png",
      fullPage: true,
    });
  } finally {
    await restore(snapshot);
  }
});
