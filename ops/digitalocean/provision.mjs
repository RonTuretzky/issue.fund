// Run from the repository root. Tokens and SSH keys stay in ignored local files.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
const directory = ".local/secrets";
mkdirSync(directory, { recursive: true, mode: 0o700 });
const { digitalOceanToken } = JSON.parse(
  readFileSync(`${directory}/automation-provisioning.json`, "utf8"),
);
async function api(path, body) {
  const response = await fetch(`https://api.digitalocean.com/v2${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${digitalOceanToken}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(30000),
  });
  const result = await response.json();
  if (!response.ok)
    throw Error(
      `DigitalOcean ${response.status}: ${result.id ?? "request_failed"}`,
    );
  return result;
}
try {
  const name = "issue-fund-automation";
  const statePath = ".local/digitalocean.json";
  const state = existsSync(statePath)
    ? JSON.parse(readFileSync(statePath, "utf8"))
    : {};
  const save = () =>
    writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n", {
      mode: 0o600,
    });
  const droplets = (await api("/droplets?per_page=200")).droplets;
  const existing = droplets.find((d) => d.name === name);
  if (existing) {
    state.dropletId = existing.id;
    state.ip = existing.networks.v4.find(
      (n) => n.type === "public",
    )?.ip_address;
    save();
    console.log(
      JSON.stringify({
        existing: true,
        id: existing.id,
        status: existing.status,
        ip: state.ip,
      }),
    );
    process.exit(0);
  }
  const keyPath = `${directory}/digitalocean_ed25519`;
  if (!existsSync(keyPath))
    execFileSync(
      "ssh-keygen",
      ["-t", "ed25519", "-f", keyPath, "-N", "", "-C", name],
      { stdio: "ignore" },
    );
  const publicKey = readFileSync(keyPath + ".pub", "utf8").trim();
  let key = (await api("/account/keys?per_page=200")).ssh_keys.find(
    (k) => k.public_key.trim() === publicKey,
  );
  if (!key)
    key = (await api("/account/keys", { name, public_key: publicKey })).ssh_key;
  state.sshKeyId = key.id;
  save();
  const tags = (await api("/tags?per_page=200")).tags;
  if (!tags.some((t) => t.name === name)) await api("/tags", { name });
  const source = (
    await (
      await fetch("https://api.ipify.org", {
        signal: AbortSignal.timeout(15000),
      })
    ).text()
  ).trim();
  if (!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(source))
    throw Error("Operator IPv4 lookup failed");
  let firewall = (await api("/firewalls?per_page=200")).firewalls.find(
    (f) => f.name === name,
  );
  if (!firewall)
    firewall = (
      await api("/firewalls", {
        name,
        tags: [name],
        inbound_rules: [
          {
            protocol: "tcp",
            ports: "22",
            sources: { addresses: [source + "/32"] },
          },
          {
            protocol: "tcp",
            ports: "80",
            sources: { addresses: ["0.0.0.0/0", "::/0"] },
          },
          {
            protocol: "tcp",
            ports: "443",
            sources: { addresses: ["0.0.0.0/0", "::/0"] },
          },
        ],
        outbound_rules: [
          {
            protocol: "tcp",
            ports: "all",
            destinations: { addresses: ["0.0.0.0/0", "::/0"] },
          },
          {
            protocol: "udp",
            ports: "all",
            destinations: { addresses: ["0.0.0.0/0", "::/0"] },
          },
          {
            protocol: "icmp",
            destinations: { addresses: ["0.0.0.0/0", "::/0"] },
          },
        ],
      })
    ).firewall;
  state.firewallId = firewall.id;
  state.operatorSshCidr = source + "/32";
  save();
  // No secrets in user_data: it is retained in provider metadata.
  const result = await api("/droplets", {
    name,
    region: "nyc3",
    size: "s-1vcpu-1gb",
    image: "ubuntu-24-04-x64",
    ssh_keys: [key.id],
    backups: true,
    ipv6: true,
    monitoring: true,
    tags: [name],
    user_data: readFileSync("ops/digitalocean/bootstrap.sh", "utf8"),
  });
  state.dropletId = result.droplet.id;
  state.createdAt = result.droplet.created_at;
  save();
  console.log(
    JSON.stringify({
      created: true,
      id: state.dropletId,
      name,
      size: "s-1vcpu-1gb",
      monthlyBaseUsd: 6,
      providerBackups: true,
      status: result.droplet.status,
    }),
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
