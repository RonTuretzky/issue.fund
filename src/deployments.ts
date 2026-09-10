import { isAddress, type Address } from "viem";
import type { Bounty, Config } from "./types";

export function deployments(config: Config): Config[] {
  return [config, ...(config.legacyDeployments ?? [])];
}
export function deploymentFor(config: Config, contract?: string): Config {
  const selected = deployments(config).find(
    (d) =>
      d.contract.toLowerCase() === (contract ?? config.contract).toLowerCase(),
  );
  if (!selected)
    throw Error(
      "This escrow is not listed in the site's verified deployments.",
    );
  return selected;
}
export function bountyLink(bounty: Bounty): string {
  return bounty.contract && bounty.chainId
    ? `#bounty/${bounty.chainId}/${bounty.contract.toLowerCase()}/${bounty.id}`
    : `#bounty-${bounty.id}`;
}
export function parseBountyLink(
  hash: string,
): { id: number; chainId?: number; contract?: Address } | undefined {
  const legacy = /^#bounty-([1-9][0-9]*)$/.exec(hash);
  if (legacy && Number.isSafeInteger(Number(legacy[1])))
    return { id: Number(legacy[1]) };
  const canonical =
    /^#bounty\/([1-9][0-9]*)\/(0x[0-9a-fA-F]{40})\/([1-9][0-9]*)$/.exec(hash);
  if (
    canonical &&
    Number.isSafeInteger(Number(canonical[3])) &&
    isAddress(canonical[2])
  )
    return {
      chainId: Number(canonical[1]),
      contract: canonical[2],
      id: Number(canonical[3]),
    };
}
export function matchesBounty(
  bounty: Bounty,
  hash: string,
  config?: Config,
): boolean {
  const target = parseBountyLink(hash);
  if (!target || target.id !== bounty.id) return false;
  const address =
    target.contract ?? config?.legacyLinkContract ?? config?.contract;
  return (
    (!target.chainId ||
      target.chainId === (bounty.chainId ?? config?.chainId)) &&
    (!address ||
      (bounty.contract ?? config?.contract)?.toLowerCase() ===
        address.toLowerCase())
  );
}
export function claimQuote(amount: string | bigint, feeBps = 0) {
  if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > 500)
    throw Error("Invalid claim fee configuration.");
  const gross = BigInt(amount);
  const fee = (gross * BigInt(feeBps)) / 10000n;
  return { gross, fee, net: gross - fee };
}
