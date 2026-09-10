// Operator-only provisioning. No provider token is installed on the service host.
import { readFileSync, writeFileSync } from "node:fs";

const args = new Set(process.argv.slice(2));
if ([...args].some((arg) => !["--apply", "--enable-alerts"].includes(arg)))
  throw Error("Usage: monitoring.mjs [--apply] [--enable-alerts]");
const apply = args.has("--apply"),
  enableAlerts = args.has("--enable-alerts");
const email = process.env.ALERT_EMAIL;
if (enableAlerts && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email ?? ""))
  throw Error("Set ALERT_EMAIL to the operator-approved notification address");
let digitalOceanToken;
try {
  ({ digitalOceanToken } = JSON.parse(
    readFileSync(".local/secrets/automation-provisioning.json", "utf8"),
  ));
  if (typeof digitalOceanToken !== "string" || !digitalOceanToken)
    throw Error("Missing token");
} catch {
  // JSON parse errors can quote their input, which contains the provider token.
  throw Error("Cannot read private provisioning credentials");
}
const { dropletId } = JSON.parse(
  readFileSync(".local/digitalocean.json", "utf8"),
);
if (!Number.isSafeInteger(dropletId) || dropletId <= 0)
  throw Error("Missing service droplet ID");

const api = async (path, method = "GET", body) => {
  const response = await fetch(`https://api.digitalocean.com/v2${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${digitalOceanToken}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json();
  if (!response.ok)
    throw Error(
      `DigitalOcean ${response.status}: ${data.id ?? "request_failed"}`,
    );
  return data;
};
const list = async (path, field) => {
  const result = [];
  for (let page = 1; page <= 100; page++) {
    const data = await api(`${path}?per_page=200&page=${page}`);
    if (!Array.isArray(data[field]))
      throw Error("Unexpected provider response");
    result.push(...data[field]);
    if (!data.links?.pages?.next) return result;
  }
  throw Error("Provider result exceeds provisioning scan limit");
};
const checkSpec = {
  name: "issue.fund API availability",
  type: "https",
  target: "https://api.issue.fund/v1/health/operational",
  regions: ["us_east", "us_west", "eu_west"],
  enabled: true,
};
const uptimeSpecs = [
  { name: "issue.fund API unavailable", type: "down_global", period: "2m" },
  {
    name: "issue.fund API certificate expiry",
    type: "ssl_expiry",
    threshold: 14,
    comparison: "less_than",
    period: "5m",
  },
];
const resourceSpecs = [
  ["CPU", "cpu", 85, "10m"],
  ["memory", "memory_utilization_percent", 85, "5m"],
  ["disk", "disk_utilization_percent", 80, "5m"],
].map(([name, metric, value, window]) => ({
  description: `issue.fund ${name} utilization`,
  type: `v1/insights/droplet/${metric}`,
  compare: "GreaterThan",
  value,
  window,
  entities: [String(dropletId)],
  tags: [],
  enabled: true,
}));
const unique = (rows, field, name) => {
  const matches = rows.filter((row) => row[field] === name);
  if (matches.length > 1)
    throw Error("Duplicate named monitoring resources require reconciliation");
  return matches[0];
};
const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical).sort();
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  return value;
};
const matches = (actual, expected) =>
  Object.entries(expected).every(
    ([key, value]) =>
      JSON.stringify(canonical(actual[key])) ===
      JSON.stringify(canonical(value)),
  );

try {
  const checks = await list("/uptime/checks", "checks");
  let check = unique(checks, "name", checkSpec.name);
  if (
    check &&
    ![checkSpec.target, "https://api.issue.fund/healthz"].includes(check.target)
  )
    throw Error("Named check points to another target");
  console.log(
    JSON.stringify({
      mode: apply ? "apply" : "plan",
      check: checkSpec,
      enableNotifications: enableAlerts,
      proposedUptimeAlerts: uptimeSpecs,
      proposedResourceAlerts: resourceSpecs,
    }),
  );
  if (!apply) process.exit(0);
  if (!check) check = (await api("/uptime/checks", "POST", checkSpec)).check;
  else if (!matches(check, checkSpec))
    check = (await api(`/uptime/checks/${check.id}`, "PUT", checkSpec)).check;
  if (!check?.id)
    throw Error("Missing uptime check ID; reconcile before retrying");
  const state = {
    checkId: check.id,
    target: checkSpec.target,
    regions: checkSpec.regions,
    notificationsConfigured: null,
    uptimeAlertIds: [],
    resourceAlertIds: [],
  };
  const save = () =>
    writeFileSync(
      ".local/monitoring.json",
      JSON.stringify(state, null, 2) + "\n",
      { mode: 0o600 },
    );
  save();
  if (enableAlerts) {
    const alerts = await list(`/uptime/checks/${check.id}/alerts`, "alerts");
    for (const spec of uptimeSpecs) {
      const body = { ...spec, notifications: { email: [email], slack: [] } };
      let found = unique(alerts, "name", spec.name);
      if (!found)
        found = (await api(`/uptime/checks/${check.id}/alerts`, "POST", body))
          .alert;
      else if (!matches(found, body))
        found = (
          await api(
            `/uptime/checks/${check.id}/alerts/${found.id}`,
            "PUT",
            body,
          )
        ).alert;
      if (!found?.id)
        throw Error("Missing alert ID; reconcile before retrying");
      state.uptimeAlertIds.push(found.id);
      save();
    }
    const policies = await list("/monitoring/alerts", "policies");
    for (const spec of resourceSpecs) {
      const body = { ...spec, alerts: { email: [email], slack: [] } };
      let found = unique(policies, "description", spec.description);
      if (
        found &&
        JSON.stringify(found.entities) !== JSON.stringify(spec.entities)
      )
        throw Error("Named policy targets another resource");
      if (!found)
        found = (await api("/monitoring/alerts", "POST", body)).policy;
      else if (!matches(found, body))
        found = (await api(`/monitoring/alerts/${found.uuid}`, "PUT", body))
          .policy;
      if (!found?.uuid)
        throw Error("Missing policy ID; reconcile before retrying");
      state.resourceAlertIds.push(found.uuid);
      save();
    }
  }
  // Read back actual resources. A check-only rerun must not claim alerts were
  // disabled or erase their IDs merely because --enable-alerts was omitted.
  const finalAlerts = await list(`/uptime/checks/${check.id}/alerts`, "alerts");
  const finalPolicies = await list("/monitoring/alerts", "policies");
  const managedAlerts = uptimeSpecs.map((spec) =>
    unique(finalAlerts, "name", spec.name),
  );
  const managedPolicies = resourceSpecs.map((spec) =>
    unique(finalPolicies, "description", spec.description),
  );
  const hasDestination = (notifications) =>
    enableAlerts
      ? JSON.stringify(notifications?.email) === JSON.stringify([email])
      : Boolean(notifications?.email?.length || notifications?.slack?.length);
  state.uptimeAlertIds = managedAlerts.filter(Boolean).map((a) => a.id);
  state.resourceAlertIds = managedPolicies.filter(Boolean).map((a) => a.uuid);
  state.notificationsConfigured =
    managedAlerts.every(
      (a, i) =>
        a && matches(a, uptimeSpecs[i]) && hasDestination(a.notifications),
    ) &&
    managedPolicies.every(
      (a, i) => a && matches(a, resourceSpecs[i]) && hasDestination(a.alerts),
    );
  save();
  if (enableAlerts && !state.notificationsConfigured)
    throw Error("Monitoring read-back differs from requested configuration");
  console.log(
    JSON.stringify({
      checkId: state.checkId,
      notificationsConfigured: state.notificationsConfigured,
      action: "configured",
      notificationDeliveryVerified: false,
    }),
  );
} catch (error) {
  // Provider error bodies can contain account details; do not print them.
  console.error(
    error.message.startsWith("DigitalOcean ")
      ? error.message
      : "Monitoring setup failed; reconcile named resources before retrying",
  );
  process.exitCode = 1;
}
