import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  decodeFunctionData,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { gnosis } from "viem/chains";

// Explicit opt-in only: these tests spend tiny amounts of real xDAI.
test.skip(
  process.env.RUN_GNOSIS_E2E !== "1",
  "Gnosis transactions require explicit opt-in.",
);
test.use({ baseURL: "http://127.0.0.1:5175", trace: "off", screenshot: "off" });
const fixture = () =>
  JSON.parse(
    fs.readFileSync(
      process.env.GNOSIS_FIXTURE_FILE ??
        ".local/github-rsa-gnosis-fixture.json",
      "utf8",
    ),
  );
const deployment = () =>
  JSON.parse(fs.readFileSync("public/deployment.gnosis.json", "utf8"));
const client = createPublicClient({
  chain: gnosis,
  transport: http("https://rpc.gnosischain.com"),
});
const read = (functionName: string, args: unknown[] = []) =>
  client.readContract({
    address: deployment().contract,
    abi: deployment().abi,
    functionName,
    args,
  }) as Promise<any>;

async function wallet(page: Page) {
  // Signing stays in this local Node process. The browser receives no key.
  const account = privateKeyToAccount(
    process.env.GNOSIS_DEPLOYER_KEY!.trim() as `0x${string}`,
  );
  const wc = createWalletClient({
    account,
    chain: gnosis,
    transport: http("https://rpc.gnosischain.com"),
  });
  await page.exposeFunction(
    "gnosisTestWallet",
    async (method: string, params: any[] = []) => {
      if (method === "eth_requestAccounts" || method === "eth_accounts")
        return [account.address];
      if (method === "eth_chainId") return "0x64";
      if (method === "wallet_switchEthereumChain") {
        expect(params[0].chainId).toBe("0x64");
        return null;
      }
      if (method !== "eth_sendTransaction")
        throw new Error(`Unsupported test wallet method: ${method}`);
      const tx = params[0],
        d = deployment();
      expect(tx.from.toLowerCase()).toBe(account.address.toLowerCase());
      expect(tx.to.toLowerCase()).toBe(d.contract.toLowerCase());
      const value = BigInt(tx.value ?? 0);
      expect(value <= parseEther("0.001")).toBe(true);
      const decoded = decodeFunctionData({ abi: d.abi, data: tx.data });
      expect(["create", "claim", "withdraw"]).toContain(decoded.functionName);
      if (decoded.functionName === "withdraw")
        expect(String(decoded.args?.[0]).toLowerCase()).toBe(
          account.address.toLowerCase(),
        );
      const hash = await wc.sendTransaction({
        to: tx.to,
        data: tx.data,
        value,
        maxFeePerGas: 10000000n,
        maxPriorityFeePerGas: 1n,
      });
      const file = ".local/direct-gnosis-ui-transactions.json";
      const history = fs.existsSync(file)
        ? JSON.parse(fs.readFileSync(file, "utf8"))
        : [];
      history.push({
        functionName: decoded.functionName,
        hash,
        sentAt: new Date().toISOString(),
      });
      fs.writeFileSync(file, JSON.stringify(history, null, 2));
      return hash;
    },
  );
  await page.addInitScript(() => {
    window.ethereum = {
      request: ({ method, params }) =>
        (window as any).gnosisTestWallet(method, params),
      on: () => {},
      removeListener: () => {},
    };
  });
  return account;
}
async function connect(page: Page) {
  await page.locator(".wallet-button").click();
  await page.getByRole("button", { name: /Browser wallet/ }).click();
}
test("fund the Gnosis fixture through the static frontend", async ({
  page,
}) => {
  test.setTimeout(180000);
  const f = fixture();
  if (Number(await read("nextId")) > f.bountyId) {
    const b = await read("getBounty", [BigInt(f.bountyId)]);
    expect(Number(b.issue)).toBe(f.issue);
    expect(b.amount).toBe(parseEther("0.001"));
    return;
  }
  await wallet(page);
  await page.goto("/");
  await expect(page.getByText("GNOSIS · EXPERIMENTAL")).toBeVisible();
  await connect(page);
  await page
    .getByRole("button", { name: "Fund an issue", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "GitHub issue URL" })
    .fill(f.issueUrl);
  await page.getByRole("button", { name: "Review issue", exact: true }).click();
  await page.getByRole("textbox", { name: "Reward in xDAI" }).fill("0.001");
  await page.getByLabel("Time to complete").selectOption("7");
  await page.getByRole("checkbox", { name: /I understand the escrow/ }).check();
  await page.getByRole("button", { name: "Fund bounty", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: `Resolve issue #${f.issue}`,
      exact: true,
    }),
  ).toBeVisible({ timeout: 90000 });
  const b = await read("getBounty", [BigInt(f.bountyId)]);
  expect(b.amount).toBe(parseEther("0.001"));
  expect(b.status).toBe(0);
  expect(b.funder.toLowerCase()).toBe(f.recipient.toLowerCase());
  await page.screenshot({
    path: ".local/direct-gnosis-funded.png",
    fullPage: true,
  });
});

test("claim genuine GitHub emails with direct RSA and withdraw through the static frontend", async ({
  page,
}) => {
  test.setTimeout(240000);
  const f = fixture(),
    d = deployment(),
    account = await wallet(page);
  expect(d.protocol).toBe("rsa-dkim-v1");
  expect(d.contract.toLowerCase()).toBe(f.expectedEscrow.toLowerCase());
  const b = await read("getBounty", [BigInt(f.bountyId)]);
  expect(b.status).toBe(0);
  await page.goto(`/#bounty-${f.bountyId}`);
  await connect(page);
  const exposed: string[] = [];
  page.on("request", (r) => {
    if (
      (r.postData() ?? "").includes("issue_event") ||
      /prover|proofs|receipts/.test(new URL(r.url()).pathname)
    )
      exposed.push(r.url());
  });
  await page
    .getByLabel("Merged PR email", { exact: true })
    .setInputFiles(".local/rsa-gnosis-merge.eml");
  await page
    .getByLabel("Issue closure email", { exact: true })
    .setInputFiles(".local/rsa-gnosis-closure.eml");
  await page
    .getByRole("button", { name: "Check receipts", exact: true })
    .click();
  await expect(
    page.getByText("Signatures and bounty match", { exact: true }),
  ).toBeVisible();
  expect(exposed).toEqual([]);
  await expect(page.locator(".full-address")).toHaveText(f.recipient);
  const submit = page.getByRole("button", {
    name: "Submit claim",
    exact: true,
  });
  await expect(submit).toBeDisabled();
  await page
    .getByRole("checkbox", { name: /Submitting makes these emails public/ })
    .check();
  await submit.click();
  await expect(page.getByText("This bounty has been paid.")).toBeVisible({
    timeout: 120000,
  });
  expect(await read("credits", [account.address])).toBe(parseEther("0.001"));
  const balance = await client.getBalance({ address: account.address });
  await page
    .getByRole("button", { name: "Withdraw xDAI", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm withdrawal", exact: true })
    .click();
  await expect(
    page.getByText("Withdrawal confirmed. The xDAI is in your wallet."),
  ).toBeVisible({ timeout: 120000 });
  expect(await read("credits", [account.address])).toBe(0n);
  const history = JSON.parse(
    fs.readFileSync(".local/direct-gnosis-ui-transactions.json", "utf8"),
  );
  const withdrawal = await client.getTransactionReceipt({
    hash: history.filter((x: any) => x.functionName === "withdraw").at(-1).hash,
  });
  expect(await client.getBalance({ address: account.address })).toBe(
    balance +
      parseEther("0.001") -
      withdrawal.gasUsed * withdrawal.effectiveGasPrice,
  );
  fs.writeFileSync(
    ".local/direct-gnosis-results.json",
    JSON.stringify(
      {
        testedAt: new Date().toISOString(),
        realGitHubDkim: true,
        directRsaOnChain: true,
        staticFrontend: true,
        repo: f.repo,
        issue: f.issue,
        pr: f.pr,
        bountyId: f.bountyId,
        escrow: d.contract,
        recipient: f.recipient,
        amountWei: String(b.amount),
        browserClaim: true,
        browserWithdrawal: true,
        transactions: history,
      },
      null,
      2,
    ),
  );
  await page.screenshot({
    path: ".local/direct-gnosis-paid.png",
    fullPage: true,
  });
});
