import express from "express";
import fs from "node:fs";
import path from "node:path";
import {
  randomUUID,
  randomBytes,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { spawn } from "node:child_process";
import { createPublicClient, http, isAddress } from "viem";
import { prepareReceipt, checkPair, publicReceipt } from "./receipt.mjs";
import {
  saveStatus,
  readStatus,
  recoverJobs,
  cleanupPrivate,
} from "./jobs.mjs";
const app = express();
const gnosisMode = process.env.MERGEBOUNTY_NETWORK === "gnosis";
const port = gnosisMode ? 4320 : 4319;
const rpcUrl = gnosisMode
  ? "https://rpc.gnosischain.com"
  : "http://127.0.0.1:8547";
const deploymentPath = gnosisMode
  ? "public/deployment.gnosis.json"
  : ".local/deployment.json";
const jobsRoot = gnosisMode ? ".local/gnosis-jobs" : ".local/jobs";
const liveOrigin = "https://mergebounty-gnosis.pretty-moon-6694.chatgpt.site";
let pairingToken;
if (gnosisMode) {
  fs.mkdirSync(".local", { recursive: true, mode: 0o700 });
  const tokenPath = ".local/prover-pairing-code";
  if (!fs.existsSync(tokenPath))
    fs.writeFileSync(tokenPath, randomBytes(32).toString("hex"), {
      mode: 0o600,
    });
  pairingToken = fs.readFileSync(tokenPath, "utf8").trim();
  if (!/^[a-f0-9]{64}$/.test(pairingToken))
    throw new Error("Invalid prover pairing code file.");
}
const client = createPublicClient({ transport: http(rpcUrl) });
const json = (value) =>
  JSON.parse(
    JSON.stringify(value, (_, v) => (typeof v === "bigint" ? v.toString() : v)),
  );
const deployment = () => {
  if (!fs.existsSync(deploymentPath))
    throw new Error(
      "Contracts are not deployed yet. Finish npm run setup, then npm run deploy:local.",
    );
  return JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
};
if (gnosisMode) {
  const digest = (p) =>
    createHash("sha256").update(fs.readFileSync(p)).digest("hex");
  const d = deployment();
  if (
    d.chainId !== 100 ||
    d.verificationKeySha256 !== digest("artifacts/verification-key.json") ||
    d.verifierSourceSha256 !== digest("contracts/ReceiptVerifier.sol")
  )
    throw new Error(
      "The proving artifacts do not match this Gnosis deployment. Restore the original artifacts; do not generate a new setup.",
    );
}
const abi = () =>
  JSON.parse(fs.readFileSync("out/MergeBounty.sol/MergeBounty.json", "utf8"))
    .abi;
const read = async (functionName, args = []) =>
  client.readContract({
    address: deployment().contract,
    abi: abi(),
    functionName,
    args,
  });
const bounty = async (id) => {
  const b = await read("getBounty", [BigInt(id)]);
  return {
    ...json(b),
    id: Number(id),
    issue: Number(b.issue),
    deadline: Number(b.deadline),
    createdAt: Number(b.createdAt),
    pr: Number(b.pr),
    bountyRef: await read("referenceFor", [BigInt(id)]),
    keyHash: deployment().keyHash,
  };
};
app.disable("x-powered-by");
app.use((req, res, next) => {
  const host = req.hostname;
  if (!["localhost", "127.0.0.1", "::1"].includes(host))
    return res.status(403).json({ error: "Local host only." });
  const origin = req.get("origin");
  if (
    origin &&
    ![
      "http://127.0.0.1:5174",
      "http://localhost:5174",
      "http://127.0.0.1:4319",
      "http://localhost:4319",
      ...(gnosisMode
        ? [
            liveOrigin,
            "http://127.0.0.1:4320",
            "http://localhost:4320",
            "http://127.0.0.1:5175",
          ]
        : []),
    ].includes(origin)
  )
    return res.status(403).json({
      error: "This local prover does not accept cross-origin requests.",
    });
  if (gnosisMode && origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Authorization, Content-Type",
    );
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Private-Network", "true");
  }
  if (gnosisMode && req.method === "OPTIONS") return res.sendStatus(204);
  if (gnosisMode) {
    const token = req.get("authorization")?.replace(/^Bearer /, "") ?? "";
    if (
      !/^[a-f0-9]{64}$/.test(token) ||
      !timingSafeEqual(Buffer.from(token), Buffer.from(pairingToken))
    )
      return res
        .status(401)
        .json({
          error:
            "Pair this page with your local prover using its pairing code.",
        });
  }
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});
app.use(express.json({ limit: "210kb" }));
app.get("/api/health", (req, res) => {
  const d = deployment();
  res.json({
    chainId: d.chainId,
    contract: d.contract,
    artifactsReady: [
      "artifacts/Receipt.zkey",
      "artifacts/Receipt_js/Receipt.wasm",
      "artifacts/verification-key.json",
    ].every((p) => fs.existsSync(p)),
  });
});
app.get("/api/config", async (req, res) => {
  const d = deployment();
  const [actual, block] = await Promise.all([
    client.getChainId(),
    client.getBlock(),
  ]);
  if (actual !== d.chainId)
    throw new Error("The deployment and RPC chain IDs disagree.");
  res.json({
    ...d,
    chainTime: Number(block.timestamp),
    abi: abi(),
    chainName: gnosisMode ? "Gnosis" : "Anvil · test ETH",
    currency: gnosisMode ? "xDAI" : "ETH",
    rpcUrl: gnosisMode ? rpcUrl : undefined,
    local: actual === 31337,
    developmentCeremony: JSON.parse(
      fs.readFileSync("artifacts/setup-metadata.json", "utf8"),
    ).developmentCeremony,
  });
});
app.get("/api/bounties", async (req, res) => {
  const count = Number(await read("nextId"));
  const ids = Array.from(
    { length: Math.min(count - 1, 100) },
    (_, i) => count - i - 1,
  );
  res.json(await Promise.all(ids.map(bounty)));
});
app.get("/api/credits/:address", async (req, res) => {
  if (!isAddress(req.params.address))
    return res.status(400).json({ error: "Invalid wallet address." });
  res.json({ amount: String(await read("credits", [req.params.address])) });
});
async function inspect(req) {
  const { bountyId, merge, closure } = req.body ?? {};
  if (!Number.isSafeInteger(bountyId) || bountyId < 1)
    throw new Error("Choose a valid bounty.");
  const b = await bounty(bountyId);
  if (b.status !== 0) throw new Error("This bounty is already settled.");
  if (Number((await client.getBlock()).timestamp) > b.deadline + 604800)
    throw new Error("This bounty’s claim period has ended.");
  const [m, c] = await Promise.all([
    prepareReceipt(merge),
    prepareReceipt(closure),
  ]);
  const preview = checkPair(m, c, b);
  return { merged: m, closed: c, preview };
}
app.post("/api/receipts/inspect", async (req, res) => {
  const p = await inspect(req);
  res.json(p.preview);
});
recoverJobs(path.resolve(jobsRoot));
let active;
let activeChild;
app.post("/api/proofs", async (req, res) => {
  if (active)
    return res.status(409).json({
      error:
        "The local prover is already working on a claim. Wait for it to finish before starting another.",
    });
  if (
    !fs.existsSync("artifacts/Receipt.zkey") ||
    !fs.existsSync("artifacts/verification-key.json")
  )
    return res.status(503).json({
      error: "Proving artifacts are not ready. Complete npm run setup first.",
    });
  active = "preparing";
  try {
    const p = await inspect(req);
    const id = randomUUID();
    const dir = path.resolve(jobsRoot, id);
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    fs.writeFileSync(path.join(dir, "prepared.json"), JSON.stringify(p), {
      mode: 0o600,
    });
    const state = {
      id,
      status: "queued",
      stage: "Preparing private proofs",
      preview: p.preview,
    };
    saveStatus(dir, state);
    const child = spawn(
      process.execPath,
      ["--max-old-space-size=65536", "server/prove-worker.mjs", dir],
      { stdio: "ignore" },
    );
    active = id;
    activeChild = child;
    const finish = () => {
      const current = readStatus(dir);
      if (!current || ["queued", "proving"].includes(current.status))
        saveStatus(dir, {
          id,
          status: "failed",
          stage: "Prover stopped",
          preview: current?.preview,
          error:
            "The prover stopped before finishing. Check available memory and try again.",
        });
      cleanupPrivate(dir);
      if (active === id) {
        active = undefined;
        activeChild = undefined;
      }
    };
    child.on("error", finish);
    child.on("exit", finish);
    res.status(202).json(state);
  } catch (e) {
    active = undefined;
    throw e;
  }
});
app.get("/api/proofs/:id", (req, res) => {
  if (!/^[a-f0-9-]{36}$/.test(req.params.id))
    return res.status(400).json({ error: "Invalid proof job." });
  const p = path.resolve(jobsRoot, req.params.id, "status.json");
  if (!fs.existsSync(p))
    return res.status(404).json({
      error: "This proof job was not found. Upload the receipts again.",
    });
  res.json(JSON.parse(fs.readFileSync(p, "utf8")));
});
app.post("/api/proofs/:id/cancel", (req, res) => {
  if (active !== req.params.id || !activeChild)
    return res.status(409).json({ error: "This job is no longer running." });
  activeChild.kill("SIGTERM");
  res.json({ cancelled: true });
});
app.post("/api/proofs/import", async (req, res) => {
  const { bountyId, result } = req.body ?? {};
  if (!Number.isSafeInteger(bountyId) || bountyId < 1 || !result)
    throw new Error("Choose a bounty and an exported proof file.");
  const b = await bounty(bountyId);
  const preview = checkPair(
    publicReceipt(result.merged),
    publicReceipt(result.closed),
    b,
  );
  // A imported JSON file is untrusted. The actual deployed verifier and
  // escrow policy must accept both proofs before the UI calls them verified.
  await client.simulateContract({
    address: deployment().contract,
    abi: abi(),
    functionName: "claim",
    args: [BigInt(bountyId), result.merged, result.closed],
    account: "0x0000000000000000000000000000000000000001",
  });
  const id = randomUUID();
  const dir = path.resolve(jobsRoot, id);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const state = {
    id,
    status: "ready",
    stage: "Imported proofs verified on chain",
    preview,
    result,
  };
  saveStatus(dir, state);
  res.json(state);
});
process.on("SIGTERM", () => {
  activeChild?.kill("SIGTERM");
  process.exit(0);
});
process.on("SIGINT", () => {
  activeChild?.kill("SIGTERM");
  process.exit(0);
});
// The built frontend can use this same localhost service without Vite.
// Never expose the unlocked development RPC or private prover publicly.
app.post("/rpc", async (req, res) => {
  if (gnosisMode)
    return res
      .status(404)
      .json({ error: "This prover does not proxy wallet or RPC requests." });
  const calls = Array.isArray(req.body) ? req.body : [req.body];
  if (
    calls.length > 50 ||
    calls.some(
      (x) =>
        !x ||
        typeof x.method !== "string" ||
        !/^(eth_|net_|web3_)/.test(x.method),
    )
  )
    return res.status(400).json({ error: "Unsupported local RPC request." });
  const response = await fetch("http://127.0.0.1:8547", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req.body),
    signal: AbortSignal.timeout(60000),
  });
  res
    .status(response.status)
    .type("application/json")
    .send(await response.text());
});
app.use(express.static(path.resolve("dist"), { index: "index.html" }));
app.use((req, res) =>
  res.status(404).json({ error: "This resource was not found." }),
);
app.use((err, req, res, next) => {
  res.status(err.type === "entity.too.large" ? 413 : 400).json({
    error:
      err.type === "entity.too.large"
        ? "The email upload is too large. Each original receipt must be under 100 KB."
        : (err.message ?? "Request failed."),
  });
});
app.listen(port, "127.0.0.1", () =>
  console.log(
    `Local private prover: http://127.0.0.1:${port}${gnosisMode ? " · Gnosis. Pairing code: .local/prover-pairing-code (keep private)." : ""}`,
  ),
);
