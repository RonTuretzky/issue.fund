import { createPublicClient, http, isAddress } from "viem";
import { gnosis } from "viem/chains";
import { checkPair, publicReceipt } from "../shared/receipt-policy.mjs";
import type { Bounty, Config, Job } from "./types";

export const STATIC_MODE = import.meta.env.VITE_STATIC === "true";
const PROVER = "http://127.0.0.1:4320";
const TOKEN_KEY = "mergebounty:prover-token";
const jobs = new Map<string, Job>();
let manifest: Promise<Config> | undefined;
const config = () =>
  (manifest ??= fetch("/deployment.gnosis.json")
    .then(async (r) => {
      if (!r.ok)
        throw new Error(
          "The Gnosis deployment configuration could not be loaded.",
        );
      const c = (await r.json()) as Config;
      if (
        c.chainId !== 100 ||
        !isAddress(c.contract) ||
        !c.rpcUrl?.startsWith("https://")
      )
        throw new Error("Invalid Gnosis deployment configuration.");
      return c;
    })
    .catch((e) => {
      manifest = undefined;
      throw e;
    }));
const clientFor = (c: Config) =>
  createPublicClient({
    chain: gnosis,
    transport: http(c.rpcUrl),
    batch: { multicall: true },
  });

async function readBounty(c: Config, id: number): Promise<Bounty> {
  const client = clientFor(c);
  const read = (functionName: string) =>
    client.readContract({
      address: c.contract,
      abi: c.abi,
      functionName,
      args: [BigInt(id)],
    });
  const [raw, bountyRef] = await Promise.all([
    read("getBounty"),
    read("referenceFor"),
  ]);
  const b = raw as Record<string, any>;
  return {
    ...b,
    id,
    issue: Number(b.issue),
    deadline: Number(b.deadline),
    createdAt: Number(b.createdAt),
    pr: Number(b.pr),
    amount: String(b.amount),
    bountyRef,
    keyHash: c.keyHash,
  } as Bounty;
}
export function hasProverToken() {
  return !!sessionStorage.getItem(TOKEN_KEY);
}
export function disconnectProver() {
  sessionStorage.removeItem(TOKEN_KEY);
}
export async function connectProver(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token.trim()))
    throw new Error(
      "Paste the 64-character pairing code from your local prover.",
    );
  const result = await proverRequest<{
    chainId: number;
    contract: string;
    artifactsReady: boolean;
  }>("/health", undefined, token.trim());
  const c = await config();
  if (
    result.chainId !== c.chainId ||
    result.contract.toLowerCase() !== c.contract.toLowerCase()
  )
    throw new Error("This prover is configured for a different deployment.");
  if (!result.artifactsReady)
    throw new Error("This prover is still missing its proving artifacts.");
  sessionStorage.setItem(TOKEN_KEY, token.trim());
}
async function proverRequest<T>(
  path: string,
  data?: unknown,
  token = sessionStorage.getItem(TOKEN_KEY),
): Promise<T> {
  if (!token)
    throw new Error(
      "Connect the local prover before checking emails or generating proofs.",
    );
  let response: Response;
  try {
    response = await fetch(`${PROVER}/api${path}`, {
      method: data === undefined ? "GET" : "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(data === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: data === undefined ? undefined : JSON.stringify(data),
      signal: AbortSignal.timeout(90000),
    });
  } catch {
    throw new Error(
      "Cannot reach your local prover. Start it on this computer and allow local network access in your browser, then reconnect.",
    );
  }
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error ?? "The local prover request failed.");
  return result;
}
export async function staticApi<T>(path: string, data?: unknown): Promise<T> {
  const c = await config(),
    client = clientFor(c);
  if (path === "/config") {
    const [chainId, block] = await Promise.all([
      client.getChainId(),
      client.getBlock(),
    ]);
    if (chainId !== 100) throw new Error("The RPC is not connected to Gnosis.");
    return { ...c, local: false, chainTime: Number(block.timestamp) } as T;
  }
  if (path === "/bounties") {
    const count = Number(
      await client.readContract({
        address: c.contract,
        abi: c.abi,
        functionName: "nextId",
      }),
    );
    return (await Promise.all(
      Array.from({ length: Math.min(count - 1, 100) }, (_, i) =>
        readBounty(c, count - i - 1),
      ),
    )) as T;
  }
  if (path.startsWith("/credits/")) {
    const address = path.slice(9);
    if (!isAddress(address)) throw new Error("Invalid wallet address.");
    return {
      amount: String(
        await client.readContract({
          address: c.contract,
          abi: c.abi,
          functionName: "credits",
          args: [address],
        }),
      ),
    } as T;
  }
  if (path === "/proofs/import") {
    const { bountyId, result } = data as {
      bountyId: number;
      result: { merged: unknown; closed: unknown };
    };
    if (!Number.isSafeInteger(bountyId) || bountyId < 1 || !result)
      throw new Error("Choose a bounty and an exported proof file.");
    const bounty = await readBounty(c, bountyId);
    const preview = checkPair(
      publicReceipt(result.merged),
      publicReceipt(result.closed),
      bounty,
    );
    await client.simulateContract({
      address: c.contract,
      abi: c.abi,
      functionName: "claim",
      args: [BigInt(bountyId), result.merged, result.closed],
      account: "0x0000000000000000000000000000000000000001",
    });
    const id = `import-${crypto.randomUUID()}`;
    const job: Job = {
      id,
      status: "ready",
      stage: "Imported proofs verified on Gnosis",
      preview,
      result,
    };
    jobs.set(id, job);
    sessionStorage.setItem(
      `mergebounty:public-proof:${c.contract}:${id}`,
      JSON.stringify(job),
    );
    return job as T;
  }
  const id = path.match(/^\/proofs\/(import-[a-f0-9-]+)$/)?.[1];
  if (id) {
    const job =
      jobs.get(id) ??
      JSON.parse(
        sessionStorage.getItem(
          `mergebounty:public-proof:${c.contract}:${id}`,
        ) ?? "null",
      );
    if (!job)
      throw new Error("Import the proof file again to restore this claim.");
    return job as T;
  }
  return proverRequest<T>(path, data);
}
