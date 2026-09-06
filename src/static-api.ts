import { createPublicClient, http, isAddress, keccak256 } from "viem";
import type { Bounty, Config } from "./types";
export const STATIC_MODE = import.meta.env.VITE_STATIC === "true";
let manifest: Promise<Config> | undefined;
const config = () =>
  (manifest ??= fetch(STATIC_MODE ? "/deployment.gnosis.json" : "/api/config")
    .then(async (r) => {
      if (!r.ok)
        throw new Error(
          "The deployment is not ready. Check the local service or reload the page.",
        );
      const c = (await r.json()) as Config;
      if (
        c.protocol !== "rsa-dkim-v1" ||
        !isAddress(c.contract) ||
        !c.dkimKey ||
        c.dkimKey.keyHash !== keccak256(c.dkimKey.modulus) ||
        c.keyHash !== c.dkimKey.keyHash ||
        (STATIC_MODE &&
          (c.chainId !== 100 || !c.rpcUrl?.startsWith("https://")))
      )
        throw new Error(
          "This page requires the direct DKIM deployment. The archived ZK escrow uses its original interface.",
        );
      return c;
    })
    .catch((e) => {
      manifest = undefined;
      throw e;
    }));
export async function staticApi<T>(path: string): Promise<T> {
  const c = await config();
  const client = createPublicClient({
    transport: http(c.rpcUrl ?? `${location.origin}/rpc`),
    batch: { multicall: true },
  });
  const read = (functionName: string, args: unknown[] = []) =>
    client.readContract({
      address: c.contract,
      abi: c.abi,
      functionName,
      args,
    });
  if (path === "/config") {
    const [id, block, keyHash] = await Promise.all([
      client.getChainId(),
      client.getBlock(),
      read("githubKeyHash"),
    ]);
    if (id !== c.chainId || keyHash !== c.keyHash)
      throw new Error("The RPC, DKIM key and escrow configuration disagree.");
    return {
      ...c,
      chainTime: Number(block.timestamp),
      local: id === 31337,
    } as T;
  }
  if (path === "/bounties") {
    const count = Number(await read("nextId"));
    return (await Promise.all(
      Array.from({ length: Math.min(count - 1, 100) }, async (_, i) => {
        const id = count - i - 1;
        const [b, bountyRef] = (await Promise.all([
          read("getBounty", [BigInt(id)]),
          read("referenceFor", [BigInt(id)]),
        ])) as [any, string];
        return {
          ...b,
          id,
          issue: Number(b.issue),
          pr: Number(b.pr),
          deadline: Number(b.deadline),
          createdAt: Number(b.createdAt),
          amount: String(b.amount),
          bountyRef,
          keyHash: c.keyHash,
        } as Bounty;
      }),
    )) as T;
  }
  if (path.startsWith("/credits/")) {
    const address = path.slice(9);
    if (!isAddress(address)) throw new Error("Invalid wallet address.");
    return { amount: String(await read("credits", [address])) } as T;
  }
  throw new Error("Unsupported request.");
}
