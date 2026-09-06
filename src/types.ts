import type { Abi, Address } from "viem";
import type { DkimKey } from "../shared/dkim.mjs";
export type Config = {
  chainId: number;
  rpcUrl?: string;
  explorerUrl?: string;
  currency?: string;
  chainTime: number;
  chainName: string;
  contract: Address;
  verifier: Address;
  keyHash: string;
  protocol: "rsa-dkim-v1";
  experimental: boolean;
  dkimKey: DkimKey;
  local: boolean;
  abi: Abi;
};
export type Bounty = {
  id: number;
  funder: Address;
  amount: string;
  createdAt: number;
  deadline: number;
  issue: number;
  status: number;
  recipient: Address;
  pr: number;
  repo: string;
  branch: string;
  bountyRef: string;
  keyHash: string;
};
export type Preview = {
  repo: string;
  issue: number;
  pr: number;
  branch: string;
  wallet: Address;
  bountyRef: string;
  mergeIssuedAt: number;
  closedIssuedAt: number;
};
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<any>;
      on?: (name: string, fn: (value: any) => void) => void;
      removeListener?: (name: string, fn: (value: any) => void) => void;
    };
  }
}
