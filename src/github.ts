import {
  createGithubClient,
  parseRepo,
  type Repository,
} from "../shared/github.mjs";
export { parseRepo, parseIssue } from "../shared/github.mjs";
export type {
  Repository,
  Issue,
  FundingCheck,
  IssuePage,
} from "../shared/github.mjs";
export const github = createGithubClient();
export type SavedRepo = Pick<Repository, "id" | "name">;
const KEY = "mergebounty:public-repositories:v1";
export function savedRepos(): SavedRepo[] {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(data)
      ? data
          .filter(
            (r) =>
              Number.isSafeInteger(r.id) &&
              r.id > 0 &&
              typeof r.name === "string" &&
              parseRepo(r.name) === r.name,
          )
          .slice(0, 100)
      : [];
  } catch {
    return [];
  }
}
export function saveRepo(repo: SavedRepo) {
  const list = savedRepos().filter(
    (r) => r.id !== repo.id && r.name.toLowerCase() !== repo.name.toLowerCase(),
  );
  localStorage.setItem(
    KEY,
    JSON.stringify([{ id: repo.id, name: repo.name }, ...list].slice(0, 100)),
  );
  window.dispatchEvent(new Event("mergebounty:repositories"));
}
export function removeRepo(id: number) {
  localStorage.setItem(
    KEY,
    JSON.stringify(savedRepos().filter((r) => r.id !== id)),
  );
  window.dispatchEvent(new Event("mergebounty:repositories"));
}
