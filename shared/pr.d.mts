import type { Bounty } from "../src/types";
import type { FundingCheck } from "./github.mjs";
export type PullCheck = {
  id: string;
  ok: boolean;
  label: string;
  detail: string;
};
export type Pull = {
  number: number;
  html_url: string;
  title: string;
  body: string;
  state: string;
  merged: boolean;
  draft?: boolean;
  base: {
    ref: string;
    repo: { private: boolean; full_name: string; default_branch: string };
  };
};
export type PrTemplate = { path: string; name: string };
export function parsePull(value: string): { repo: string; number: number };
export function validateBranch(value: string): string;
export function validateWallet(
  wallet: string | undefined,
  bounty: Bounty,
): string;
export function titleFor(
  bounty: Bounty,
  wallet: string | undefined,
  description: string,
): string;
export function bodyFor(bounty: Bounty, description?: string): string;
export function hasClosingReference(body: string, bounty: Bounty): boolean;
export function compareUrl(
  bounty: Bounty,
  sourceRepo: string,
  branch: string,
  title: string,
  body: string,
): { url: string | null; compareUrl: string; tooLong: boolean };
export function checkPull(
  bounty: Bounty,
  wallet: string | undefined,
  pr: Pull,
  now?: number,
): PullCheck[];
export function createPrClient(fetcher?: typeof fetch): {
  context(bounty: Bounty): Promise<Pick<FundingCheck, "repo" | "issue">>;
  branches(repo: string): Promise<{ names: string[]; more: boolean }>;
  source(
    bounty: Bounty,
    repo: string,
    branch: string,
  ): Promise<{ repo: string; branch: string; sha: string }>;
  templates(bounty: Bounty): Promise<PrTemplate[]>;
  template(bounty: Bounty, path: string): Promise<string>;
  pull(value: string): Promise<Pull>;
};
