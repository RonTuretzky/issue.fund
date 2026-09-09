import { readFileSync, mkdirSync, chmodSync } from "node:fs";
import { execFileSync } from "node:child_process";
const state = JSON.parse(readFileSync(".local/digitalocean.json", "utf8"));
if (!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(state.ip))
  throw Error("Missing server address");
const ssh = [
  "-i",
  ".local/secrets/digitalocean_ed25519",
  "-o",
  "IdentitiesOnly=yes",
  "-o",
  "BatchMode=yes",
  "-o",
  "StrictHostKeyChecking=yes",
  "-o",
  "UserKnownHostsFile=.local/digitalocean-known-hosts",
  "-o",
  "ConnectTimeout=10",
  "-o",
  "ServerAliveInterval=10",
  "-o",
  "ServerAliveCountMax=3",
];
const run = (name, args) =>
  execFileSync(name, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 300000,
  });
try {
  const commit = run("git", ["rev-parse", "HEAD"]).trim();
  const release = "/opt/issue-fund/releases/" + commit;
  mkdirSync(".local", { recursive: true });
  run("git", [
    "archive",
    "--format=tar.gz",
    "--output=.local/service-release.tgz",
    commit,
  ]);
  run("scp", [
    ...ssh,
    ".local/service-release.tgz",
    `root@${state.ip}:/root/service-release.tgz`,
  ]);
  if (process.argv.includes("--configure")) {
    run("tar", [
      "-czf",
      ".local/secrets/service-config.tgz",
      "-C",
      ".local/secrets/service",
      ".",
    ]);
    chmodSync(".local/secrets/service-config.tgz", 0o600);
    run("scp", [
      ...ssh,
      ".local/secrets/service-config.tgz",
      `root@${state.ip}:/root/service-config.tgz`,
    ]);
    run("ssh", [
      ...ssh,
      `root@${state.ip}`,
      `tar -xzf /root/service-config.tgz -C /etc/issue-fund && chown -R issue-fund:issue-fund /etc/issue-fund/collector && chown -R issue-fund-signer:issue-fund-signer /etc/issue-fund/signer && chmod 700 /etc/issue-fund/collector /etc/issue-fund/signer && chmod 600 /etc/issue-fund/collector/* /etc/issue-fund/signer/* && chown root:root /etc/issue-fund/deployments.json && chmod 644 /etc/issue-fund/deployments.json && rm /root/service-config.tgz`,
    ]);
  }
  const result = run("ssh", [
    ...ssh,
    `root@${state.ip}`,
    `mkdir -p ${release} && tar -xzf /root/service-release.tgz -C ${release} && rm /root/service-release.tgz && bash ${release}/ops/digitalocean/install-release.sh ${release}`,
  ]);
  console.log(result.slice(-5000));
  console.log(
    JSON.stringify({
      deployed: commit,
      host: "api.issue.fund",
      automaticDisclosure: false,
    }),
  );
} catch (error) {
  console.error(
    error.stderr?.toString() ||
      "Deployment failed; inspect the service on the server.",
  );
  process.exitCode = 1;
}
