import { readFileSync, writeFileSync } from "node:fs";
const token = readFileSync(".local/cloudflare-token", "utf8").trim();
const { ip } = JSON.parse(readFileSync(".local/digitalocean.json", "utf8"));
if (!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(ip)) throw Error("Missing droplet IP");
async function api(path, body) {
  const r = await fetch("https://api.cloudflare.com/client/v4/" + path, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(20000),
  });
  const d = await r.json();
  if (!r.ok || !d.success)
    throw Error(
      `Cloudflare ${r.status}: ${d.errors?.map((x) => x.code).join(",")}`,
    );
  return d.result;
}
try {
  const zones = await api("zones?name=issue.fund");
  if (zones.length !== 1) throw Error("Expected one issue.fund zone");
  const path = `zones/${zones[0].id}/dns_records`;
  const records = await api(path + "?name=api.issue.fund");
  let record = records.find(
    (x) => x.type === "A" && x.content === ip && !x.proxied,
  );
  if (!record && records.length)
    throw Error(
      "api.issue.fund already has a different DNS record; inspect before changing",
    );
  if (!record)
    record = await api(path, {
      type: "A",
      name: "api.issue.fund",
      content: ip,
      ttl: 300,
      proxied: false,
      comment: "issue.fund automation service on DigitalOcean",
    });
  writeFileSync(
    ".local/digitalocean-dns.json",
    JSON.stringify(
      {
        zoneId: zones[0].id,
        recordId: record.id,
        name: record.name,
        ip,
        proxied: record.proxied,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    JSON.stringify({
      name: record.name,
      type: record.type,
      ip,
      proxied: record.proxied,
    }),
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
