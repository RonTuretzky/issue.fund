import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { getContractAddress, keccak256, encodeAbiParameters } from "viem";
const owner = "RonTuretzky",
  peer = "RonTuretzkyOpacity",
  repo = "RonTuretzky/tmp-github-bounty-proofs-20260906";
const file = ".local/github-fixture.json";
fs.mkdirSync(".local", { recursive: true, mode: 0o700 });
function api(user, method, url, body) {
  const token = execFileSync(
    "gh",
    ["auth", "token", "--hostname", "github.com", "--user", user],
    { encoding: "utf8" },
  ).trim();
  const args = [
    "api",
    "--method",
    method,
    url,
    ...(body ? ["--input", "-"] : []),
  ];
  return JSON.parse(
    execFileSync("gh", args, {
      encoding: "utf8",
      env: { ...process.env, GH_TOKEN: token },
      input: body ? JSON.stringify(body) : undefined,
    }),
  );
}
if (process.argv[2] === "prepare") {
  if (fs.existsSync(file))
    throw new Error(
      "Fixture already exists; use finish to merge after escrow funding.",
    );
  const expectedEscrow = getContractAddress({
    from: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    nonce: 1n,
  });
  const bountyRef = keccak256(
    encodeAbiParameters(
      [{ type: "uint256" }, { type: "address" }, { type: "uint256" }],
      [31337n, expectedEscrow, 1n],
    ),
  );
  const recipient = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  const issue = api(peer, "POST", `repos/${repo}/issues`, {
    title: "LAB E2E: verify private proof payout",
    body: "Synthetic acceptance: add the protocol integration fixture. Local Anvil test ETH only; no real payment or public-chain authorization.",
  });
  const main = api(owner, "GET", `repos/${repo}/git/ref/heads/main`).object.sha;
  const branch = `codex/protocol-e2e-${issue.number}`;
  api(owner, "POST", `repos/${repo}/git/refs`, {
    ref: `refs/heads/${branch}`,
    sha: main,
  });
  api(owner, "PUT", `repos/${repo}/contents/fixtures/protocol-e2e.txt`, {
    message: "Add protocol end-to-end fixture",
    branch,
    content: Buffer.from(
      "Synthetic local escrow integration fixture. No real funds.\n",
    ).toString("base64"),
  });
  const pr = api(owner, "POST", `repos/${repo}/pulls`, {
    title: `[bounty ${bountyRef}] [wallet ${recipient}] LAB E2E`,
    head: branch,
    base: "main",
    body: `Closes #${issue.number}\n\nSynthetic notification evidence for a locally funded Anvil bounty. Test ETH only.`,
  });
  const data = {
    repo,
    issue: issue.number,
    pr: pr.number,
    prUrl: pr.html_url,
    head: pr.head.sha,
    branch,
    bountyRef,
    recipient,
    expectedEscrow,
    preparedAt: pr.created_at,
  };
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  console.log(data);
} else if (process.argv[2] === "finish") {
  const f = JSON.parse(fs.readFileSync(file, "utf8"));
  const d = JSON.parse(fs.readFileSync(".local/deployment.json", "utf8"));
  if (d.contract.toLowerCase() !== f.expectedEscrow.toLowerCase())
    throw new Error(
      "Escrow address differs from the fixture title. Update the title before merging.",
    );
  const r = api(peer, "PUT", `repos/${repo}/pulls/${f.pr}/merge`, {
    merge_method: "merge",
    sha: f.head,
  });
  f.mergedAt = new Date().toISOString();
  f.merge = r;
  fs.writeFileSync(file, JSON.stringify(f, null, 2));
  console.log({ pr: f.pr, merged: r.merged, issue: f.issue });
} else throw new Error("Usage: node scripts/github-fixture.mjs prepare|finish");
