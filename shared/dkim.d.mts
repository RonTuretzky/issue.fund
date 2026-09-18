export type DkimKey = {
  domain: string;
  selector: string;
  exponent: string;
  modulus: `0x${string}`;
  keyHash: `0x${string}`;
};
export type Receipt = {
  headers: `0x${string}`;
  body: `0x${string}`;
  signature: `0x${string}`;
};
export type Summary = {
  kind: string;
  repo: string;
  number: number;
  pr: number;
  issue: number | null;
  branch: string | null;
  wallet: `0x${string}` | null;
  bountyRef: string | null;
  issuedAt: number;
  title: string;
  keyHash: string;
};
export type Prepared = { receipt: Receipt; summary: Summary };
export function canonicalizeEmail(input: Uint8Array): {
  headers: Uint8Array;
  body: Uint8Array;
  signature: Uint8Array;
  subject: string;
  tags: Record<string, string>;
};
export function parseNativeEvent(
  subject: string,
  body: string,
  issuedAt: number,
): Omit<Summary, "keyHash">;
export function authenticateEmail(
  input: Uint8Array,
  key: DkimKey,
): Promise<{
  receipt: Receipt;
  subject: string;
  body: string;
  issuedAt: number;
  keyHash: string;
}>;
export function prepareReceipt(
  input: Uint8Array,
  key: DkimKey,
): Promise<Prepared>;
export function checkPair(
  merged: Prepared,
  closed: Prepared,
  bounty: {
    repo: string;
    issue: number;
    branch: string;
    bountyRef: string;
    keyHash: string;
    createdAt: number;
    deadline: number;
  },
): {
  repo: string;
  issue: number;
  pr: number;
  branch: string;
  wallet: `0x${string}`;
  bountyRef: string;
  mergeIssuedAt: number;
  closedIssuedAt: number;
};
