import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  parseAbiItem,
  keccak256,
} from "viem";
import { foundry } from "viem/chains";
const transport = http("http://127.0.0.1:8547");
const publicClient = createPublicClient({ chain: foundry, transport });
const walletClient = createWalletClient({ chain: foundry, transport });
const fixture = () =>
  JSON.parse(fs.readFileSync(".local/github-fixture.json", "utf8"));
const deployment = () =>
  JSON.parse(fs.readFileSync(".local/deployment.json", "utf8"));
const abi = () =>
  JSON.parse(fs.readFileSync("out/MergeBounty.sol/MergeBounty.json", "utf8"))
    .abi;
const read = (functionName: string, args: unknown[] = []) =>
  publicClient.readContract({
    address: deployment().contract,
    abi: abi(),
    functionName,
    args,
  }) as Promise<any>;
const rpc = async (method: string, params: unknown[] = []) => {
  const r = await fetch("http://127.0.0.1:8547", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message);
  return j.result;
};
async function restore(snapshot: string) {
  expect(await rpc("evm_revert", [snapshot])).toBe(true);
  // A reverted Anvil snapshot also rewinds its clock. Resume at wall time so
  // subsequent genuine DKIM timestamps and the demo stay usable.
  await rpc("evm_setTime", [Math.floor(Date.now() / 1000)]);
  await rpc("evm_mine");
  const block = await publicClient.getBlock();
  expect(Math.abs(Number(block.timestamp) - Date.now() / 1000)).toBeLessThan(
    10,
  );
}
async function local(page: Page, n: number) {
  await page.locator(".wallet-button").click();
  await page.getByRole("button", { name: /Local test wallet/ }).click();
  await page
    .getByRole("button", { name: new RegExp(`Test wallet ${n}`) })
    .click();
}
async function open(page: Page) {
  await page.goto("/");
  await expect(
    page.getByText(
      "Real contract transactions. Test ETH only. Development proof setup.",
    ),
  ).toBeVisible();
}
async function fund(
  page: Page,
  issue: number,
  amount: string,
  repo = fixture().repo,
) {
  await page
    .getByRole("button", { name: "Fund an issue", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "GitHub issue URL" })
    .fill(`https://github.com/${repo}/issues/${issue}`);
  await page.getByRole("button", { name: "Review issue", exact: true }).click();
  await page.getByRole("textbox", { name: "Reward in ETH" }).fill(amount);
  await page.getByLabel("Time to complete").selectOption("7");
  await page.getByRole("checkbox", { name: /I understand the escrow/ }).check();
  await page.getByRole("button", { name: "Fund bounty", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: `Resolve issue #${issue}`, exact: true }),
  ).toBeVisible();
}

test.describe.configure({ mode: "serial" });
test("fund the fresh GitHub experiment through the real interface", async ({
  page,
}) => {
  const f = fixture(),
    d = deployment();
  expect(d.contract.toLowerCase()).toBe(f.expectedEscrow.toLowerCase());
  if (Number(await read("nextId")) > 1) {
    expect(fs.existsSync(".local/funding-ui.json")).toBe(true);
    expect((await read("getBounty", [1n])).repo).toBe(f.repo);
    return;
  }
  await open(page);
  await local(page, 1);
  await fund(page, f.issue, "0.05");
  const b = await read("getBounty", [1n]);
  expect(b.amount).toBe(parseEther("0.05"));
  expect(b.status).toBe(0);
  expect(await read("referenceFor", [1n])).toBe(f.bountyRef);
  expect(await publicClient.getBalance({ address: d.contract })).toBe(
    parseEther("0.05"),
  );
  const logs = await publicClient.getLogs({
    address: d.contract,
    event: parseAbiItem(
      "event Funded(uint256 indexed id,address indexed funder,bytes32 bountyRef,string repo,uint64 issue,uint256 amount,uint64 deadline)",
    ),
    fromBlock: 0n,
  });
  fs.writeFileSync(
    ".local/funding-ui.json",
    JSON.stringify(
      {
        fundedThroughUI: true,
        repo: f.repo,
        issue: f.issue,
        bountyId: 1,
        amount: "0.05 ETH",
        transactionHash: logs[0].transactionHash,
        createdAt: Number(b.createdAt),
        deadline: Number(b.deadline),
      },
      null,
      2,
    ),
  );
  await page.screenshot({ path: ".local/e2e-funded.png", fullPage: true });
});

test("real GitHub emails generate ZK proofs, pay the signed wallet and withdraw ETH", async ({
  page,
}) => {
  test.setTimeout(1800000);
  const f = fixture(),
    d = deployment();
  for (const file of [".local/merge.eml", ".local/closure.eml"])
    expect(
      fs.existsSync(file),
      `Download the fresh native receipt to ${file}`,
    ).toBe(true);
  const accounts = await walletClient.getAddresses();
  expect(accounts[1].toLowerCase()).toBe(f.recipient.toLowerCase());
  expect((await read("getBounty", [1n])).status).toBe(0);
  await open(page);
  await page.goto("/#bounty-1");
  await local(page, 3);
  if (fs.existsSync(".local/proof-pair.json")) {
    await page
      .getByLabel("Import proof file", { exact: true })
      .setInputFiles(".local/proof-pair.json");
  } else {
    await page
      .getByLabel("Merged PR email", { exact: true })
      .setInputFiles(".local/merge.eml");
    await page
      .getByLabel("Issue closure email", { exact: true })
      .setInputFiles(".local/closure.eml");
    await page
      .getByRole("button", { name: "Check receipts", exact: true })
      .click();
    await expect(page.getByText("Signatures and bounty match")).toBeVisible({
      timeout: 60000,
    });
    await expect(page.locator(".full-address")).toHaveText(f.recipient);
    await page
      .getByRole("button", { name: "Generate private proofs", exact: true })
      .click();
    await expect(
      page.getByText("Both zero-knowledge proofs verified"),
    ).toBeVisible({ timeout: 1500000 });
    const downloadPromise = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Export proofs", exact: true })
      .click();
    await (await downloadPromise).saveAs(".local/proof-pair.json");
  }
  await expect(
    page.getByText("Both zero-knowledge proofs verified"),
  ).toBeVisible({ timeout: 60000 });
  await expect(
    page.getByText(
      "You can submit this claim, but payment will go to the wallet shown above.",
    ),
  ).toBeVisible();
  const proofs = JSON.parse(fs.readFileSync(".local/proof-pair.json", "utf8"));
  const verifierAbi = JSON.parse(
    fs.readFileSync("out/ReceiptVerifier.sol/Groth16Verifier.json", "utf8"),
  ).abi;
  for (const kind of ["merged", "closed"]) {
    const p = proofs[kind];
    expect(
      await publicClient.readContract({
        address: d.verifier,
        abi: verifierAbi,
        functionName: "verifyProof",
        args: [p.a, p.b, p.c, p.signals],
      }),
    ).toBe(true);
  }
  const snapshot = await rpc("evm_snapshot");
  try {
    const altered = structuredClone(proofs.merged);
    altered.signals[1] = (BigInt(altered.signals[1]) ^ 1n).toString();
    await expect(
      publicClient.simulateContract({
        address: d.contract,
        abi: abi(),
        functionName: "claim",
        args: [1n, altered, proofs.closed],
        account: accounts[2],
      }),
    ).rejects.toThrow();
    await page
      .getByRole("button", { name: "Submit claim", exact: true })
      .click();
    await expect(page.getByText("This bounty has been paid.")).toBeVisible({
      timeout: 60000,
    });
    expect(await read("credits", [accounts[1]])).toBe(parseEther("0.05"));
    expect(await read("credits", [accounts[2]])).toBe(0n);
    await expect(
      publicClient.simulateContract({
        address: d.contract,
        abi: abi(),
        functionName: "withdraw",
        args: [accounts[2]],
        account: accounts[2],
      }),
    ).rejects.toThrow();
    await expect(
      publicClient.simulateContract({
        address: d.contract,
        abi: abi(),
        functionName: "claim",
        args: [1n, proofs.merged, proofs.closed],
        account: accounts[2],
      }),
    ).rejects.toThrow();
    await local(page, 2);
    await expect(page.getByText("0.05 ETH ready to withdraw")).toBeVisible();
    const before = await publicClient.getBalance({ address: accounts[1] });
    await page
      .getByRole("button", { name: "Withdraw ETH", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Confirm withdrawal", exact: true })
      .click();
    await expect(
      page.getByText("Withdrawal confirmed. The ETH is in your wallet."),
    ).toBeVisible({ timeout: 60000 });
    expect(await read("credits", [accounts[1]])).toBe(0n);
    expect(await publicClient.getBalance({ address: d.contract })).toBe(0n);
    const paidLogs = await publicClient.getLogs({
      address: d.contract,
      event: parseAbiItem(
        "event Paid(uint256 indexed id,address indexed recipient,uint256 amount,uint64 pr)",
      ),
      fromBlock: 0n,
    });
    const withdrawn = await publicClient.getLogs({
      address: d.contract,
      event: parseAbiItem(
        "event Withdrawn(address indexed owner,address indexed destination,uint256 amount)",
      ),
      fromBlock: 0n,
    });
    const payment = await publicClient.getTransactionReceipt({
      hash: paidLogs[0].transactionHash,
    });
    const withdrawal = await publicClient.getTransactionReceipt({
      hash: withdrawn[0].transactionHash,
    });
    expect(await publicClient.getBalance({ address: accounts[1] })).toBe(
      before +
        parseEther("0.05") -
        withdrawal.gasUsed * withdrawal.effectiveGasPrice,
    );
    const b = await read("getBounty", [1n]);
    expect(b.status).toBe(1);
    expect(Number(b.pr)).toBe(f.pr);
    expect(b.recipient.toLowerCase()).toBe(accounts[1].toLowerCase());
    fs.writeFileSync(
      ".local/chain-e2e-results.json",
      JSON.stringify(
        {
          testedAt: new Date().toISOString(),
          realGitHubDKIM: true,
          realGroth16Verifier: true,
          privateProofs: 2,
          payoutThroughUI: true,
          withdrawalThroughUI: true,
          relayer: accounts[2],
          recipient: accounts[1],
          repo: f.repo,
          issue: f.issue,
          pr: f.pr,
          escrow: d.contract,
          verifier: d.verifier,
          verifierCodeHash: keccak256(
            (await publicClient.getCode({ address: d.verifier }))!,
          ),
          paymentHash: payment.transactionHash,
          withdrawalHash: withdrawal.transactionHash,
          paymentGas: String(payment.gasUsed),
          withdrawalGas: String(withdrawal.gasUsed),
          amountWei: String(b.amount),
          negativeChecks: [
            "altered proof rejected",
            "relayer cannot withdraw beneficiary credit",
            "claim replay rejected",
          ],
          testRestoresFundedSnapshot: true,
        },
        null,
        2,
      ),
    );
    await page.screenshot({ path: ".local/e2e-paid.png", fullPage: true });
  } finally {
    await restore(snapshot);
  }
});

test("expired bounty refund and withdrawal work through the real interface", async ({
  page,
}) => {
  test.skip(
    !fs.existsSync(".local/public-onboarding-fixture.json"),
    "Requires an open public issue fixture.",
  );
  const publicFixture = JSON.parse(
    fs.readFileSync(".local/public-onboarding-fixture.json", "utf8"),
  );
  const snapshot = await rpc("evm_snapshot");
  const d = deployment();
  const accounts = await walletClient.getAddresses();
  try {
    await open(page);
    await local(page, 1);
    const id = BigInt(await read("nextId"));
    await fund(page, publicFixture.issue, "0.01", publicFixture.repo);
    await expect(
      publicClient.simulateContract({
        address: d.contract,
        abi: abi(),
        functionName: "refund",
        args: [id],
        account: accounts[0],
      }),
    ).rejects.toThrow();
    await rpc("evm_increaseTime", [14 * 86400 + 60]);
    await rpc("evm_mine");
    await page.reload();
    await local(page, 2);
    await expect(
      page.getByRole("button", { name: "Reclaim expired bounty", exact: true }),
    ).toBeDisabled();
    await local(page, 1);
    await expect(page.getByText("Refundable", { exact: true })).toBeVisible();
    await page
      .getByRole("button", { name: "Reclaim expired bounty", exact: true })
      .click();
    await expect(page.getByText("This bounty was refunded.")).toBeVisible();
    expect(await read("credits", [accounts[0]])).toBe(parseEther("0.01"));
    const before = await publicClient.getBalance({ address: accounts[2] });
    await page
      .getByRole("button", { name: "Withdraw ETH", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Destination wallet" })
      .fill(accounts[2]);
    await page
      .getByRole("button", { name: "Confirm withdrawal", exact: true })
      .click();
    await expect(
      page.getByText("Withdrawal confirmed. The ETH is in your wallet."),
    ).toBeVisible();
    expect(await publicClient.getBalance({ address: accounts[2] })).toBe(
      before + parseEther("0.01"),
    );
    expect(await read("credits", [accounts[0]])).toBe(0n);
    await page.screenshot({ path: ".local/e2e-refunded.png", fullPage: true });
    fs.writeFileSync(
      ".local/refund-e2e-results.json",
      JSON.stringify(
        {
          refundThroughUI: true,
          alternativeWithdrawalDestination: true,
          earlyRefundRejected: true,
          unauthorizedRefundDisabled: true,
          testedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
  } finally {
    await restore(snapshot);
  }
});
