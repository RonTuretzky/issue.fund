import type { Abi, Address } from "viem";
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
  developmentCeremony: boolean;
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
export type Job = {
  id: string;
  status: "queued" | "proving" | "ready" | "failed";
  stage: string;
  preview?: Preview;
  error?: string;
  result?: { merged: unknown; closed: unknown };
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
