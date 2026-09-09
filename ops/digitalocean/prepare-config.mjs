import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  chmodSync,
  copyFileSync,
} from "node:fs";
import { randomBytes } from "node:crypto";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
const root = ".local/secrets/service";
for (const name of ["", "/collector", "/signer"])
  mkdirSync(root + name, { recursive: true, mode: 0o700 });
const secret = (path, value) => {
  if (!existsSync(path)) writeFileSync(path, value + "\n", { mode: 0o600 });
  chmodSync(path, 0o600);
};
secret(root + "/collector/storage.key", randomBytes(32).toString("hex"));
secret(root + "/signer/storage.key", randomBytes(32).toString("hex"));
secret(root + "/signer/relay.key", generatePrivateKey());
const token = JSON.parse(
  readFileSync(".local/secrets/automation-provisioning.json", "utf8"),
).githubToken;
const supplied = Object.fromEntries(
  readFileSync(".local/secrets/collector.env", "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const env = (path, values) => {
  writeFileSync(
    path,
    Object.entries(values)
      .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
      .join("\n") + "\n",
    { mode: 0o600 },
  );
};
const app = existsSync(".local/secrets/github-app.json")
  ? JSON.parse(readFileSync(".local/secrets/github-app.json", "utf8"))
  : null;
if (app) {
  if (
    !Number.isSafeInteger(app.id) ||
    !app.pem?.startsWith("-----BEGIN RSA PRIVATE KEY-----")
  )
    throw Error("Invalid GitHub App configuration");
  const keyPath = root + "/collector/github-app.pem";
  if (
    existsSync(keyPath) &&
    readFileSync(keyPath, "utf8").trim() !== app.pem.trim()
  )
    throw Error(
      "A different App key is already configured; review before replacing",
    );
  secret(keyPath, app.pem.trim());
}
env(root + "/collector/service.env", {
  DEPLOYMENTS_FILE: "/etc/issue-fund/deployments.json",
  COLLECTOR_DATABASE: "/var/lib/issue-fund/collector.sqlite",
  COLLECTOR_STORAGE_KEY_FILE: "/etc/issue-fund/collector/storage.key",
  COLLECTOR_GITHUB_TOKEN: supplied.COLLECTOR_GITHUB_TOKEN || token,
  MAIL_HOST: supplied.MAIL_HOST || "imap.gmail.com",
  MAIL_ADDRESS: supplied.MAIL_ADDRESS || "",
  MAIL_PASSWORD: supplied.MAIL_PASSWORD || "",
  MAIL_ACCESS_TOKEN: supplied.MAIL_ACCESS_TOKEN || "",
  SIGNER_SOCKET: "/run/issue-fund-ipc/signer.sock",
  ...(app
    ? {
        GITHUB_APP_ID: String(app.id),
        GITHUB_APP_PRIVATE_KEY_FILE: "/etc/issue-fund/collector/github-app.pem",
        GITHUB_APP_INSTALL_URL: app.html_url + "/installations/new",
      }
    : {}),
});
env(root + "/signer/service.env", {
  DEPLOYMENTS_FILE: "/etc/issue-fund/deployments.json",
  SIGNER_DATABASE: "/var/lib/issue-fund-signer/signer.sqlite",
  SIGNER_STORAGE_KEY_FILE: "/etc/issue-fund/signer/storage.key",
  RELAY_PRIVATE_KEY_FILE: "/etc/issue-fund/signer/relay.key",
  SIGNER_SOCKET: "/run/issue-fund-ipc/signer.sock",
});
copyFileSync(".local/automation-deployments.json", root + "/deployments.json");
console.log(
  JSON.stringify({
    prepared: true,
    automaticDisclosure: false,
    relayEnabled: false,
    relayAddress: privateKeyToAccount(
      readFileSync(root + "/signer/relay.key", "utf8").trim(),
    ).address,
  }),
);
