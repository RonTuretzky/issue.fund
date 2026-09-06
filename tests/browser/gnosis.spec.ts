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
  JSON.parse(fs.readFileSync(process.env.GNOSIS_FIXTURE_FILE ?? ".local/github-gnosis-fixture.json", "utf8"));
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
    fs.readFileSync(".local/gnosis.key", "utf8").trim() as `0x${string}`,
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
      const file = ".local/gnosis-ui-transactions.json";
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
  await page.getByRole("textbox", { name: "Reward in xDAI" }).fill("0.001");
  await page.getByLabel("Time to complete").selectOption("7");
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
  await page.screenshot({ path: ".local/gnosis-funded.png", fullPage: true });
});

test("prove genuine Gnosis emails, claim and withdraw through the static frontend", async ({
  page,
}) => {
  test.setTimeout(1800000);
  const f = fixture(),
    d = deployment(),
    account = await wallet(page);
  const beforeBounty = await read("getBounty", [BigInt(f.bountyId)]);
  expect(beforeBounty.status).toBe(0);
  await page.goto(`/#bounty-${f.bountyId}`);
  await connect(page);
  await page
    .getByRole("button", { name: "Connect prover", exact: true })
    .first()
    .click();
  await page
    .getByLabel("Pairing code", { exact: true })
    .fill(fs.readFileSync(".local/prover-pairing-code", "utf8").trim());
  await page.getByRole("button", { name: "Connect and check prover" }).click();
  await expect(
    page.getByText("Local prover paired for this browser session."),
  ).toBeVisible();
  const proofFile = ".local/gnosis-proof-pair.json";
  if (fs.existsSync(proofFile)) {
    await page
      .getByLabel("Import proof file", { exact: true })
      .setInputFiles(proofFile);
  } else {
    await page
      .getByLabel("Merged PR email", { exact: true })
      .setInputFiles(".local/gnosis-merge.eml");
    await page
      .getByLabel("Issue closure email", { exact: true })
      .setInputFiles(".local/gnosis-closure.eml");
    await page
      .getByRole("button", { name: "Check receipts", exact: true })
      .click();
    await expect(page.getByText("Signatures and bounty match")).toBeVisible({
      timeout: 90000,
    });
    await page
      .getByRole("button", { name: "Generate private proofs", exact: true })
      .click();
    await expect(
      page.getByText("Both zero-knowledge proofs verified"),
    ).toBeVisible({ timeout: 1500000 });
    const download = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Export proofs", exact: true })
      .click();
    await (await download).saveAs(proofFile);
    // Exercise browser-side import and an actual Gnosis eth_call, without the prover.
    await page.reload();
    await connect(page);
    await page
      .getByLabel("Import proof file", { exact: true })
      .setInputFiles(proofFile);
  }
  await expect(
    page.getByText("Both zero-knowledge proofs verified"),
  ).toBeVisible({ timeout: 90000 });
  const pair = JSON.parse(fs.readFileSync(proofFile, "utf8"));
  const altered = structuredClone(pair.merged);
  altered.signals[1] = (BigInt(altered.signals[1]) ^ 1n).toString();
  await expect(
    client.simulateContract({
      address: d.contract,
      abi: d.abi,
      functionName: "claim",
      args: [BigInt(f.bountyId), altered, pair.closed],
      account: account.address,
    }),
  ).rejects.toThrow();
  await page.getByRole("button", { name: "Submit claim", exact: true }).click();
  await expect(page.getByText("This bounty has been paid.")).toBeVisible({
    timeout: 90000,
  });
  expect(await read("credits", [account.address])).toBe(parseEther("0.001"));
  await expect(
    client.simulateContract({
      address: d.contract,
      abi: d.abi,
      functionName: "claim",
      args: [BigInt(f.bountyId), pair.merged, pair.closed],
      account: account.address,
    }),
  ).rejects.toThrow();
  const before = await client.getBalance({ address: account.address });
  await page
    .getByRole("button", { name: "Withdraw xDAI", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm withdrawal", exact: true })
    .click();
  await expect(
    page.getByText("Withdrawal confirmed. The xDAI is in your wallet."),
  ).toBeVisible({ timeout: 90000 });
  expect(await read("credits", [account.address])).toBe(0n);
  const history = JSON.parse(
    fs.readFileSync(".local/gnosis-ui-transactions.json", "utf8"),
  );
  const withdrawal = await client.getTransactionReceipt({
    hash: history.findLast((t: any) => t.functionName === "withdraw").hash,
  });
  expect(await client.getBalance({ address: account.address })).toBe(
    before +
      parseEther("0.001") -
      withdrawal.gasUsed * withdrawal.effectiveGasPrice,
  );
  const b = await read("getBounty", [BigInt(f.bountyId)]);
  expect(b.status).toBe(1);
  expect(Number(b.pr)).toBe(f.pr);
  fs.writeFileSync(
    ".local/gnosis-e2e-results.json",
    JSON.stringify(
      {
        testedAt: new Date().toISOString(),
        chainId: 100,
        escrow: d.contract,
        verifier: d.verifier,
        bountyId: f.bountyId,
        issue: f.issue,
        pr: f.pr,
        recipient: account.address,
        amountXDai: "0.001",
        genuineGitHubDKIM: true,
        proofs: 2,
        browserGeneratedViaLocalProver: true,
        browserImportedAndVerifiedOnChain: true,
        tamperedProofRejected: true,
        replayRejected: true,
        exactWithdrawalAfterGas: true,
        transactions: history,
      },
      null,
      2,
    ),
  );
  await page.screenshot({ path: ".local/gnosis-paid.png", fullPage: true });
});
