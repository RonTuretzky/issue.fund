import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createPublicClient, http } from "viem";
const owner = "RonTuretzky",
  peer = "RonTuretzkyOpacity",
  repo = "RonTuretzky/tmp-github-bounty-proofs-20260906";
const file = process.env.GNOSIS_FIXTURE_FILE ?? ".local/github-gnosis-fixture.json";
const d = JSON.parse(fs.readFileSync("public/deployment.gnosis.json", "utf8"));
const client = createPublicClient({ transport: http(d.rpcUrl) });
const read = (functionName, args = []) =>
  client.readContract({ address: d.contract, abi: d.abi, functionName, args });
function api(user, method, url, body) {
  const token = execFileSync(
    "gh",
    ["auth", "token", "--hostname", "github.com", "--user", user],
    { encoding: "utf8" },
  ).trim();
  return JSON.parse(
    execFileSync(
      "gh",
      ["api", "--method", method, url, ...(body ? ["--input", "-"] : [])],
      {
        encoding: "utf8",
        env: { ...process.env, GH_TOKEN: token },
        input: body ? JSON.stringify(body) : undefined,
      },
    ),
  );
}
const save = (f) => fs.writeFileSync(file, JSON.stringify(f, null, 2) + "\n");
if (process.argv[2] === "prepare") {
  if (fs.existsSync(file))
    throw new Error(
      "Gnosis fixture already exists; resume it instead of creating another.",
    );
  const issue = api(peer, "POST", `repos/${repo}/issues`, {
    title: "GNOSIS E2E: verify private proof payout",
    body: "Controlled MergeBounty acceptance test: add the Gnosis fixture. A tiny real xDAI bounty will be funded before merging, claimed using the two original GitHub event emails, and withdrawn to the test funder.",
  });
  const f = {
    repo,
    issue: issue.number,
    issueUrl: issue.html_url,
    expectedEscrow: d.contract,
    recipient: "0x6636A1CCBdf54485067304C1a590DE016DeaD9F0",
    bountyId: Number(await read("nextId")),
    preparedAt: new Date().toISOString(),
  };
  save(f);
  console.log(f);
} else if (process.argv[2] === "merge") {
  const f = JSON.parse(fs.readFileSync(file, "utf8"));
  const b = await read("getBounty", [BigInt(f.bountyId)]);
  if (
    d.contract !== f.expectedEscrow ||
    b.repo !== repo ||
    Number(b.issue) !== f.issue ||
    b.status !== 0
  )
    throw new Error(
      "Fund the exact Gnosis fixture before creating and merging its PR.",
    );
  f.bountyRef = await read("referenceFor", [BigInt(f.bountyId)]);
  save(f);
  if (!f.branch) {
    const main = api(owner, "GET", `repos/${repo}/git/ref/heads/main`).object
      .sha;
    f.branch = `codex/gnosis-e2e-${f.issue}`;
    api(owner, "POST", `repos/${repo}/git/refs`, {
      ref: `refs/heads/${f.branch}`,
      sha: main,
    });
    save(f);
  }
  if (!f.head) {
    const r = api(
      owner,
      "PUT",
      `repos/${repo}/contents/fixtures/gnosis-e2e-${f.issue}.txt`,
      {
        message: "Add Gnosis bounty acceptance fixture",
        branch: f.branch,
        content: Buffer.from(
          "Controlled real-chain proof and payout acceptance test on Gnosis.\n",
        ).toString("base64"),
      },
    );
    f.head = r.commit.sha;
    save(f);
  }
  if (!f.pr) {
    const pr = api(owner, "POST", `repos/${repo}/pulls`, {
      title: `[bounty ${f.bountyRef}] [wallet ${f.recipient}] GNOSIS E2E`,
      head: f.branch,
      base: "main",
      body: `Closes #${f.issue}\n\nControlled MergeBounty Gnosis acceptance test. Original notifications are private proof inputs.`,
    });
    f.pr = pr.number;
    f.prUrl = pr.html_url;
    save(f);
  }
  if (!f.mergedAt) {
    const result = api(peer, "PUT", `repos/${repo}/pulls/${f.pr}/merge`, {
      merge_method: "merge",
      sha: f.head,
    });
    if (!result.merged) throw new Error("GitHub did not merge the test PR.");
    f.mergedAt = new Date().toISOString();
    f.merge = result;
    save(f);
  }
  console.log({
    issue: f.issue,
    pr: f.pr,
    mergedAt: f.mergedAt,
    bountyRef: f.bountyRef,
  });
} else throw new Error("Use prepare or merge.");
