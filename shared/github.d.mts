export type Repository = {
  id: number;
  name: string;
  description: string;
  branch: string;
  url: string;
};
export type Issue = {
  id: number;
  number: number;
  title: string;
  body: string;
  state: string;
  url: string;
  labels: string[];
  comments: number;
  updatedAt: string;
};
export type FundingCheck = {
  repo: Repository;
  issue: Issue;
  checkedAt: number;
};
export type IssuePage = {
  items: Issue[];
  more: boolean;
  limited: boolean;
  incomplete: boolean;
};
export function parseRepo(value: string): string;
export function parseIssue(value: string): { repo: string; number: number };
export function repoProblem(repo: Record<string, unknown>): string;
export function createGithubClient(fetcher?: typeof fetch): {
  getRepo(value: string): Promise<Repository>;
  getIssue(repo: Repository, number: number): Promise<Issue>;
  inspectIssue(url: string, expected?: FundingCheck): Promise<FundingCheck>;
  listIssues(
    repo: Repository,
    options?: { state?: string; query?: string; page?: number },
  ): Promise<IssuePage>;
};
