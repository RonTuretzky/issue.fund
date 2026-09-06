import { test, expect } from "@playwright/test";
import fs from "node:fs";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  parseAbiItem,
} from "viem";
import { foundry } from "viem/chains";

test("real public GitHub issue → checked funding → expiry refund → withdrawal", async ({
  page,
}) => {
  test.skip(
    process.env.RUN_PUBLIC_FLOW !== "1",
    "Opt-in test requires the authorized public GitHub fixture and local Anvil.",
  );
  test.setTimeout(120000);
  const fixture = JSON.parse(
    fs.readFileSync(".local/public-onboarding-fixture.json", "utf8"),
  );
  const deployment = JSON.parse(
    fs.readFileSync(".local/deployment.rsa.json", "utf8"),
  );
  const abi = JSON.parse(
    fs.readFileSync("out/MergeBounty.sol/MergeBounty.json", "utf8"),
  ).abi;
  const client = createPublicClient({
    chain: foundry,
    transport: http("http://127.0.0.1:8547"),
  });
  const wallet = createWalletClient({
    chain: foundry,
    transport: http("http://127.0.0.1:8547"),
  });
  expect(await client.getChainId()).toBe(31337);
  const rpc = async (method: string, params: any[] = []) =>
    client.request({ method: method as any, params } as any) as Promise<any>;
  const snapshot = await rpc("evm_snapshot");
  const account = (await wallet.getAddresses())[0];
  const read = (functionName: string, args: unknown[] = []) =>
    client.readContract({
      address: deployment.contract,
      abi,
      functionName,
      args,
    }) as Promise<any>;
  const id = await read("nextId");
  const escrowBefore = await client.getBalance({
    address: deployment.contract,
  });
  const creditBefore = await read("credits", [account]);
  expect(creditBefore).toBe(0n);
  try {
    await page.goto("/");
    await page
      .getByRole("button", { name: "Fund an issue", exact: true })
      .click();
    await page
      .getByLabel("GitHub issue URL")
      .fill(`https://github.com/${fixture.repo}/issues/${fixture.issue}`);
    await page
      .getByRole("button", { name: "Check issue", exact: true })
      .click();
    await expect(page.getByText("OPEN · PUBLIC REPOSITORY")).toBeVisible();
    await page.getByLabel("Reward in ETH").fill("0.001");
    await page.getByLabel("Time to complete").selectOption("7");
    await page
      .getByRole("checkbox", { name: /I understand the escrow/ })
      .check();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Connect wallet", exact: true })
      .click();
    await page.getByRole("button", { name: /Local test wallet/ }).click();
    await page.getByRole("button", { name: /Test wallet 1/ }).click();
    await page
      .getByRole("button", { name: "Fund bounty", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: `Resolve issue #${fixture.issue}`,
        exact: true,
      }),
    ).toBeVisible();
    const b = await read("getBounty", [id]);
    expect(b.repo).toBe(fixture.repo);
    expect(b.issue).toBe(BigInt(fixture.issue));
    expect(b.branch).toBe(fixture.branch);
    expect(b.amount).toBe(parseEther("0.001"));
    expect(b.funder.toLowerCase()).toBe(account.toLowerCase());
    expect(await client.getBalance({ address: deployment.contract })).toBe(
      escrowBefore + b.amount,
    );
    const funded = await client.getLogs({
      address: deployment.contract,
      event: parseAbiItem(
        "event Funded(uint256 indexed id,address indexed funder,bytes32 bountyRef,string repo,uint64 issue,uint256 amount,uint64 deadline)",
      ),
      args: { id },
      fromBlock: 0n,
    });
    await page.screenshot({
      path: ".local/public-issue-funded.png",
      fullPage: true,
    });
    await rpc("evm_setNextBlockTimestamp", [Number(b.deadline) + 604801]);
    await rpc("evm_mine");
    await page.reload();
    await page.locator(".wallet-button").click();
    await page.getByRole("button", { name: /Local test wallet/ }).click();
    await page.getByRole("button", { name: /Test wallet 1/ }).click();
    await page
      .getByRole("button", { name: "Reclaim expired bounty", exact: true })
      .click();
    await expect(
      page.getByText("Refund credited. Withdraw it from your balance."),
    ).toBeVisible();
    expect(await read("credits", [account])).toBe(b.amount);
    await page
      .getByRole("button", { name: "Withdraw ETH", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Confirm withdrawal", exact: true })
      .click();
    await expect(
      page.getByText("Withdrawal confirmed. The ETH is in your wallet."),
    ).toBeVisible();
    expect(await read("credits", [account])).toBe(0n);
    expect(await client.getBalance({ address: deployment.contract })).toBe(
      escrowBefore,
    );
    fs.writeFileSync(
      ".local/public-onboarding-results.json",
      JSON.stringify(
        {
          testedAt: new Date().toISOString(),
          chainId: 31337,
          repo: fixture.repo,
          issue: fixture.issue,
          publicGitHubWithoutCredentials: true,
          createdViaGithubForm: fixture.createdViaGithubForm,
          fundedThroughReview: true,
          defaultBranch: b.branch,
          refundAndWithdrawal: true,
          transactionHash: funded[0].transactionHash,
          snapshotRestoredAfterTest: true,
        },
        null,
        2,
      ),
    );
  } finally {
    expect(await rpc("evm_revert", [snapshot])).toBe(true);
    await rpc("evm_setTime", [Math.floor(Date.now() / 1000)]);
    await rpc("evm_mine");
  }
});
