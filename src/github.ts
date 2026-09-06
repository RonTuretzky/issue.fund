import { createGithubClient } from "../shared/github.mjs";
export { parseRepo, parseIssue } from "../shared/github.mjs";
export type {
  Repository,
  Issue,
  FundingCheck,
  IssuePage,
} from "../shared/github.mjs";
export const github = createGithubClient();
