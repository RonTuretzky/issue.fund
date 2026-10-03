import {
  createPublicClient,
  http,
  isAddress,
  keccak256,
  zeroAddress,
  type Address,
} from "viem";
import { deployments, deploymentFor } from "./deployments";
import type { Bounty, Config } from "./types";
export const STATIC_MODE = import.meta.env.VITE_STATIC === "true";
let manifest: Promise<Config> | undefined;
const config = () =>
  (manifest ??= fetch(STATIC_MODE ? "/deployment.gnosis.json" : "/api/config")
    .then(async (r) => {
      if (!r.ok)
        throw new Error(
          "The deployment is not ready. Reload the page to try again.",
        );
      const c = (await r.json()) as Config;
      const list = deployments(c);
      if (
        list.length > 10 ||
        new Set(list.map((d) => d.contract?.toLowerCase())).size !== list.length
      )
        throw Error("Invalid escrow list.");
      for (const d of list) {
        if (
          !["rsa-dkim-v1", "rsa-dkim-v2"].includes(d.protocol) ||
          !isAddress(d.contract) ||
          !isAddress(d.verifier) ||
          !d.dkimKey ||
          d.dkimKey.keyHash !== keccak256(d.dkimKey.modulus) ||
          d.keyHash !== d.dkimKey.keyHash ||
          d.chainId !== c.chainId ||
          (STATIC_MODE &&
            (d.chainId !== 100 || !d.rpcUrl?.startsWith("https://")))
        )
          throw Error("The direct DKIM deployment configuration is invalid.");
        if (
          d.protocol === "rsa-dkim-v2" &&
          (!Number.isInteger(d.feeBps) ||
            d.feeBps! < 0 ||
            d.feeBps! > 500 ||
            !d.feeRecipient ||
            !isAddress(d.feeRecipient))
        )
          throw Error("The claim fee configuration is invalid.");
      }
      if (
        c.legacyDeployments?.length &&
        (!c.legacyLinkContract ||
          !list.some(
            (d) =>
              d.contract.toLowerCase() === c.legacyLinkContract!.toLowerCase(),
          ))
      )
        throw Error(
          "The original bounty links need a verified escrow address.",
        );
      if (c.automationUrl && new URL(c.automationUrl).protocol !== "https:")
        throw Error("The collector must use HTTPS.");
      return c;
    })
    .catch((error) => {
      manifest = undefined;
      throw error;
    }));
export async function staticApi<T>(path: string): Promise<T> {
  const c = await config();
  const client = createPublicClient({
    transport: http(c.rpcUrl ?? `${location.origin}/rpc`),
    batch: { multicall: true },
  });
  const read = (d: Config, functionName: string, args: unknown[] = []) =>
    client.readContract({
      address: d.contract,
      abi: d.abi,
      functionName,
      args,
    });
  const oneBounty = async (d: Config, id: number): Promise<Bounty> => {
    const [b, bountyRef] = (await Promise.all([
      read(d, "getBounty", [BigInt(id)]),
      read(d, "referenceFor", [BigInt(id)]),
    ])) as [any, string];
    return {
      ...b,
      id,
      contract: d.contract,
      chainId: d.chainId,
      feeBps: d.protocol === "rsa-dkim-v2" ? d.feeBps : 0,
      issue: Number(b.issue),
      pr: Number(b.pr),
      deadline: Number(b.deadline),
      createdAt: Number(b.createdAt),
      amount: String(b.amount),
      bountyRef,
      keyHash: d.keyHash,
    };
  };
  if (path === "/config") {
    const [id, block] = await Promise.all([
      client.getChainId(),
      client.getBlock(),
    ]);
    if (id !== c.chainId) throw Error("The RPC and escrow network disagree.");
    const checked = await Promise.all(
      deployments(c).map(async (d) => {
        const [keyHash, verifier] = await Promise.all([
          read(d, "githubKeyHash"),
          read(d, "verifier"),
        ]);
        if (
          keyHash !== d.keyHash ||
          String(verifier).toLowerCase() !== d.verifier.toLowerCase()
        )
          throw Error(
            "The deployed verifier differs from this site's configuration.",
          );
        if (
          d.runtimeHash &&
          keccak256((await client.getCode({ address: d.contract })) ?? "0x") !==
            d.runtimeHash
        )
          throw Error(
            "The deployed escrow bytecode differs from this site's configuration.",
          );
        if (d.protocol === "rsa-dkim-v2") {
          const [bps, initialTreasury, treasury, owner, pendingOwner] =
            await Promise.all([
              read(d, "feeBps"),
              read(d, "initialFeeRecipient"),
              read(d, "feeRecipient"),
              read(d, "owner"),
              read(d, "pendingOwner"),
            ]);
          if (
            Number(bps) !== d.feeBps ||
            String(initialTreasury).toLowerCase() !==
              (d.initialFeeRecipient ?? d.feeRecipient)!.toLowerCase() ||
            !isAddress(String(treasury)) ||
            String(treasury).toLowerCase() === zeroAddress ||
            String(treasury).toLowerCase() === d.contract.toLowerCase() ||
            !isAddress(String(owner)) ||
            String(owner).toLowerCase() === zeroAddress
          )
            throw Error(
              "The deployed fee differs from this site's configuration.",
            );
          return {
            ...d,
            initialFeeRecipient: initialTreasury as Address,
            feeRecipient: treasury as Address,
            feeOwner: owner as Address,
            pendingFeeOwner: pendingOwner as Address,
          };
        }
        return d;
      }),
    );
    return {
      ...checked[0],
      legacyDeployments: checked.slice(1),
      chainTime: Number(block.timestamp),
      local: id === 31337,
    } as T;
  }
  if (path === "/bounties") {
    const groups = await Promise.all(
      deployments(c).map(async (d) => {
        const count = Number(await read(d, "nextId"));
        return Promise.all(
          Array.from({ length: Math.min(count - 1, 100) }, (_, i) =>
            oneBounty(d, count - i - 1),
          ),
        );
      }),
    );
    return groups
      .flat()
      .sort((a, b) => b.createdAt - a.createdAt || b.id - a.id) as T;
  }
  if (path.startsWith("/bounties/")) {
    const match = /^\/bounties\/(0x[0-9a-fA-F]{40})\/([1-9][0-9]*)$/.exec(path);
    if (!match || !Number.isSafeInteger(Number(match[2])))
      throw Error("Invalid bounty link.");
    return (await oneBounty(deploymentFor(c, match[1]), Number(match[2]))) as T;
  }
  if (path.startsWith("/credits/")) {
    const address = path.slice(9);
    if (!isAddress(address)) throw Error("Invalid wallet address.");
    const escrows = await Promise.all(
      deployments(c).map(async (d) => ({
        contract: d.contract,
        amount: String(await read(d, "credits", [address])),
      })),
    );
    return {
      amount: escrows
        .reduce((total, item) => total + BigInt(item.amount), 0n)
        .toString(),
      escrows,
    } as T;
  }
  throw Error("Unsupported request.");
}
