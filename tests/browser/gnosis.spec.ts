import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  decodeFunctionData,
  parseEventLogs,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { gnosis } from "viem/chains";

// Explicit opt-in only: these tests spend tiny amounts of real xDAI.
test.skip(
  process.env.RUN_GNOSIS_E2E !== "1",
  "Gnosis transactions require explicit opt-in.",
);
test.use({
  baseURL: process.env.GNOSIS_E2E_URL ?? "http://127.0.0.1:5175",
  trace: "off",
  screenshot: "off",
});
const fixture = () =>
  JSON.parse(
    fs.readFileSync(
      process.env.GNOSIS_FIXTURE_FILE ??
        ".local/github-rsa-gnosis-fixture.json",
      "utf8",
    ),
  );
const evidencePrefix =
  process.env.GNOSIS_EVIDENCE_PREFIX ?? ".local/direct-gnosis";
const historyFile = `${evidencePrefix}-ui-transactions.json`;
const reward = () => parseEther(fixture().rewardXdai ?? "0.0001");
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
  expect(account.address.toLowerCase()).toBe(fixture().recipient.toLowerCase());
  expect(deployment().contract.toLowerCase()).toBe(
    fixture().expectedEscrow.toLowerCase(),
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
      const f = fixture();
      if (decoded.functionName === "create") {
        expect(decoded.args?.[0]).toBe(f.repo);
        expect(decoded.args?.[1]).toBe(BigInt(f.issue));
        expect(decoded.args?.[2]).toBe("main");
        expect(value).toBe(reward());
        expect(await read("nextId")).toBe(BigInt(f.bountyId));
        const deadline = Number(decoded.args?.[3]);
        expect(
          Math.abs(deadline - Math.floor(Date.now() / 1000) - 7 * 86400),
        ).toBeLessThan(120);
      } else {
        expect(value).toBe(0n);
        if (decoded.functionName === "claim")
          expect(decoded.args?.[0]).toBe(BigInt(f.bountyId));
      }
      if (decoded.functionName === "withdraw")
        expect(String(decoded.args?.[0]).toLowerCase()).toBe(
          account.address.toLowerCase(),
        );
      const estimated = await client.estimateGas({
        account: account.address,
        to: tx.to,
        data: tx.data,
        value,
      });
      const gas = (estimated * 12n) / 10n;
      expect(gas <= 15000000n).toBe(true);
      const gasPrice = (await client.getGasPrice()) * 2n + 1n;
      expect(gas * gasPrice <= parseEther("0.00005")).toBe(true);
      expect(
        await client.getBalance({ address: account.address }),
      ).toBeGreaterThan(value + gas * gasPrice);
      const hash = await wc.sendTransaction({
        to: tx.to,
        data: tx.data,
        value,
        gas,
        gasPrice,
      });
      const file = historyFile;
      const history = fs.existsSync(file)
        ? JSON.parse(fs.readFileSync(file, "utf8"))
        : [];
      history.push({
        functionName: decoded.functionName,
        hash,
        sentAt: new Date().toISOString(),
      });
      fs.writeFileSync(file, JSON.stringify(history, null, 2));
      const receipt = await client.waitForTransactionReceipt({
        hash,
        confirmations: 2,
      });
      expect(receipt.status).toBe("success");
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
    expect(b.repo).toBe(f.repo);
    expect(b.branch).toBe("main");
    expect(b.funder.toLowerCase()).toBe(f.recipient.toLowerCase());
    expect(deployment().contract.toLowerCase()).toBe(
      f.expectedEscrow.toLowerCase(),
    );
    expect(b.amount).toBe(reward());
    return;
  }
  await wallet(page);
  await page.goto("/");
  await expect(page.locator(".network")).toBeVisible();
  await connect(page);
  await page
    .getByRole("button", { name: "Fund an issue", exact: true })
    .first()
    .click();
  await page
    .getByRole("textbox", { name: "GitHub issue URL" })
    .fill(f.issueUrl);
  await page.getByRole("button", { name: "Review issue", exact: true }).click();
  if (f.automatic) {
    await expect(
      page.getByRole("radio", { name: "Automatically through the collector" }),
    ).toBeChecked();
    await expect(
      page.getByText("Notifications ready", { exact: true }),
    ).toBeVisible({ timeout: 90000 });
  }
  await page
    .getByRole("textbox", { name: "Reward in xDAI" })
    .fill(f.rewardXdai ?? "0.0001");
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
  expect(b.amount).toBe(reward());
  expect(b.status).toBe(0);
  expect(b.funder.toLowerCase()).toBe(f.recipient.toLowerCase());
  await page.screenshot({
    path: `${evidencePrefix}-funded.png`,
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
  expect(d.protocol).toBe("rsa-dkim-v2");
  expect(d.contract.toLowerCase()).toBe(f.expectedEscrow.toLowerCase());
  const b = await read("getBounty", [BigInt(f.bountyId)]);
  expect(b.status).toBe(0);
  const treasury = await read("feeRecipient");
  const feeBps = await read("feeBps");
  const fee = (b.amount * feeBps) / 10000n;
  const net = b.amount - fee;
  const priorCredit = await read("credits", [account.address]);
  const priorFeeCredit = await read("credits", [treasury]);
  expect(priorCredit).toBe(0n);
  expect(treasury.toLowerCase()).toBe(
    "0x86213f1cf0a501857b70df35c1cb3c2ecf112844",
  );
  expect(feeBps).toBe(100n);
  await page.goto(`/#bounty/100/${d.contract.toLowerCase()}/${f.bountyId}`);
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
    .setInputFiles(f.mergeEmail ?? ".local/rsa-gnosis-merge.eml");
  await page
    .getByLabel("Issue closure email", { exact: true })
    .setInputFiles(f.closureEmail ?? ".local/rsa-gnosis-closure.eml");
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
  expect(await read("credits", [account.address])).toBe(net);
  expect(await read("credits", [treasury])).toBe(priorFeeCredit + fee);
  const paidBounty = await read("getBounty", [BigInt(f.bountyId)]);
  expect(paidBounty.status).toBe(1);
  expect(paidBounty.recipient.toLowerCase()).toBe(
    account.address.toLowerCase(),
  );
  expect(Number(paidBounty.pr)).toBe(f.pr);
  const claimHistory = JSON.parse(fs.readFileSync(historyFile, "utf8"));
  const claimHash = claimHistory
    .filter((x: any) => x.functionName === "claim")
    .at(-1).hash;
  const claimTx = await client.getTransaction({ hash: claimHash });
  const claimReceipt = await client.getTransactionReceipt({ hash: claimHash });
  const events = parseEventLogs({ abi: d.abi, logs: claimReceipt.logs });
  expect(
    events.some((x: any) => x.eventName === "Paid" && x.args.amount === net),
  ).toBe(true);
  expect(
    events.some(
      (x: any) =>
        x.eventName === "ClaimFee" &&
        x.args.feeAmount === fee &&
        x.args.treasury.toLowerCase() === treasury.toLowerCase(),
    ),
  ).toBe(true);
  const decodedClaim = decodeFunctionData({ abi: d.abi, data: claimTx.input });
  await expect(
    client.simulateContract({
      address: d.contract,
      abi: d.abi,
      functionName: "claim",
      args: decodedClaim.args,
      account: account.address,
    }),
  ).rejects.toThrow(/NotOpen/);
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
  const history = JSON.parse(fs.readFileSync(historyFile, "utf8"));
  const withdrawal = await client.getTransactionReceipt({
    hash: history.filter((x: any) => x.functionName === "withdraw").at(-1).hash,
  });
  expect(await client.getBalance({ address: account.address })).toBe(
    balance + net - withdrawal.gasUsed * withdrawal.effectiveGasPrice,
  );
  fs.writeFileSync(
    `${evidencePrefix}-results.json`,
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
        netWei: String(net),
        feeWei: String(fee),
        feeRecipient: treasury,
        feeCreditBefore: String(priorFeeCredit),
        feeCreditAfter: String(await read("credits", [treasury])),
        replayRejected: true,
        publicUrl: process.env.GNOSIS_E2E_URL ?? "http://127.0.0.1:5175",
        collectorLogin: f.collectorLogin ?? null,
        browserClaim: true,
        browserWithdrawal: true,
        transactions: history,
      },
      null,
      2,
    ),
  );
  await page.screenshot({
    path: `${evidencePrefix}-paid.png`,
    fullPage: true,
  });
});

test("withdraw server-relayed reward through the public frontend", async ({
  page,
}) => {
  test.setTimeout(600000);
  const f = fixture(),
    d = deployment();
  expect(f.automatic).toBe(true);
  expect(d.automationUrl).toBe("https://api.issue.fund");
  const statusUrl = `${d.automationUrl}/v1/bounties/100/${d.contract}/${f.bountyId}/status`;
  let progress: any;
  await expect
    .poll(
      async () => {
        const response = await fetch(statusUrl);
        expect(response.ok).toBe(true);
        progress = await response.json();
        return progress.state;
      },
      { timeout: 450000, intervals: [5000, 15000] },
    )
    .toBe("credited");
  const b = await read("getBounty", [BigInt(f.bountyId)]);
  expect(b.status).toBe(1);
  expect(b.recipient.toLowerCase()).toBe(f.recipient.toLowerCase());
  const treasury = await read("feeRecipient");
  const fee = (b.amount * (await read("feeBps"))) / 10000n;
  const net = b.amount - fee;
  expect(await read("credits", [f.recipient])).toBe(net);
  expect(await read("credits", [treasury])).toBe(
    BigInt(f.feeCreditBefore) + fee,
  );
  const hash = progress.transactionHash;
  const claimTx = await client.getTransaction({ hash });
  const claimReceipt = await client.getTransactionReceipt({ hash });
  expect(claimTx.from.toLowerCase()).toBe(f.relayer.toLowerCase());
  expect(claimTx.to?.toLowerCase()).toBe(d.contract.toLowerCase());
  expect(claimTx.value).toBe(0n);
  expect(claimReceipt.status).toBe("success");
  const decoded = decodeFunctionData({ abi: d.abi, data: claimTx.input });
  expect(decoded.functionName).toBe("claim");
  expect(decoded.args?.[0]).toBe(BigInt(f.bountyId));
  const events = parseEventLogs({ abi: d.abi, logs: claimReceipt.logs });
  expect(
    events.some(
      (e: any) =>
        e.eventName === "Paid" &&
        e.args.amount === net &&
        e.args.recipient.toLowerCase() === f.recipient.toLowerCase(),
    ),
  ).toBe(true);
  expect(
    events.some(
      (e: any) =>
        e.eventName === "ClaimFee" &&
        e.args.feeAmount === fee &&
        e.args.treasury.toLowerCase() === treasury.toLowerCase(),
    ),
  ).toBe(true);
  await expect(
    client.simulateContract({
      address: d.contract,
      abi: d.abi,
      functionName: "claim",
      args: decoded.args,
      account: f.recipient,
    }),
  ).rejects.toThrow(/NotOpen/);
  const account = await wallet(page);
  await page.goto(`/#bounty/100/${d.contract.toLowerCase()}/${f.bountyId}`);
  await connect(page);
  await expect(page.getByLabel("Automatic claim status")).toContainText(
    "Reward credited",
    { timeout: 60000 },
  );
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
  const history = JSON.parse(fs.readFileSync(historyFile, "utf8"));
  expect(history.some((entry: any) => entry.functionName === "claim")).toBe(
    false,
  );
  const withdrawal = await client.getTransactionReceipt({
    hash: history
      .filter((entry: any) => entry.functionName === "withdraw")
      .at(-1).hash,
  });
  expect(await client.getBalance({ address: account.address })).toBe(
    balance + net - withdrawal.gasUsed * withdrawal.effectiveGasPrice,
  );
  fs.writeFileSync(
    `${evidencePrefix}-results.json`,
    JSON.stringify(
      {
        testedAt: new Date().toISOString(),
        publicUrl: process.env.GNOSIS_E2E_URL,
        repo: f.repo,
        issue: f.issue,
        pr: f.pr,
        bountyId: f.bountyId,
        escrow: d.contract,
        recipient: f.recipient,
        relayer: f.relayer,
        automaticCollection: true,
        serverClaim: true,
        browserClaim: false,
        browserWithdrawal: true,
        realGitHubDkim: true,
        directRsaOnChain: true,
        claimHash: hash,
        claimGasUsed: String(claimReceipt.gasUsed),
        grossWei: String(b.amount),
        netWei: String(net),
        feeWei: String(fee),
        feeRecipient: treasury,
        replayRejected: true,
        transactions: history,
      },
      null,
      2,
    ) + "\n",
  );
  await page.screenshot({ path: `${evidencePrefix}-paid.png`, fullPage: true });
});
