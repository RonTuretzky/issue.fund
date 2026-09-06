import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const repository = "RonTuretzky/issue.fund";
const branch = "codex/pages";
const domain = "issue.fund";
const dist = path.join(root, "dist");
if (!fs.existsSync(path.join(dist, "index.html"))) {
  throw new Error("Build the static app first with npm run build:gnosis.");
}
if (fs.readFileSync(path.join(dist, "CNAME"), "utf8").trim() !== domain) {
  throw new Error("The static build must contain the issue.fund CNAME.");
}
const token =
  process.env.GH_TOKEN ||
  process.env.GITHUB_TOKEN ||
  execFileSync(
    "gh",
    ["auth", "token", "--hostname", "github.com", "--user", "RonTuretzky"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
  ).trim();
const env = {
  ...process.env,
  GIT_TERMINAL_PROMPT: "0",
  GIT_CONFIG_COUNT: "1",
  GIT_CONFIG_KEY_0: "http.https://github.com/.extraheader",
  GIT_CONFIG_VALUE_0:
    "Authorization: Basic " +
    Buffer.from("x-access-token:" + token).toString("base64"),
};
const git = (args, cwd = root) =>
  execFileSync("git", args, {
    cwd,
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
const sourceCommit = git(["rev-parse", "HEAD"]);
const stage = fs.mkdtempSync(path.join(os.tmpdir(), "issue-fund-pages-"));
try {
  git(["init", "--quiet", "-b", branch], stage);
  git(
    ["remote", "add", "origin", `https://github.com/${repository}.git`],
    stage,
  );
  // Preserve the repository's author and signing configuration.
  for (const name of [
    "user.name",
    "user.email",
    "user.signingkey",
    "commit.gpgsign",
    "gpg.format",
    "gpg.program",
  ]) {
    let value;
    try {
      value = git(["config", "--get", name]);
    } catch {
      continue;
    }
    if (value) git(["config", name, value], stage);
  }
  if (git(["ls-remote", "--heads", "origin", `refs/heads/${branch}`], stage)) {
    git(["fetch", "--quiet", "--depth", "1", "origin", branch], stage);
    git(["checkout", "--quiet", "-B", branch, "FETCH_HEAD"], stage);
    for (const name of fs.readdirSync(stage)) {
      if (name !== ".git")
        fs.rmSync(path.join(stage, name), { recursive: true, force: true });
    }
  }
  fs.cpSync(dist, stage, { recursive: true });
  fs.writeFileSync(path.join(stage, ".nojekyll"), "");
  fs.writeFileSync(
    path.join(stage, "site-version.json"),
    JSON.stringify({ repository, sourceCommit, domain }, null, 2) + "\n",
  );
  git(["add", "--all"], stage);
  if (git(["status", "--porcelain"], stage)) {
    git(
      [
        "commit",
        "--quiet",
        "-m",
        `Publish issue.fund from ${sourceCommit.slice(0, 12)}`,
      ],
      stage,
    );
    git(["push", "--quiet", "origin", `HEAD:refs/heads/${branch}`], stage);
  }
  console.log(`Published static files to ${repository}:${branch}.`);
  console.log(`Pages serves https://${domain}/ after its build completes.`);
} catch (error) {
  // Child-process errors can include their environment. Print only stderr/message.
  const message =
    error.stderr?.toString() || error.message || "Deployment failed.";
  console.error(message.replaceAll(token, "[redacted]"));
  process.exitCode = 1;
} finally {
  fs.rmSync(stage, { recursive: true, force: true });
}
