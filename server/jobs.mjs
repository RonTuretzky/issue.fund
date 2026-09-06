import fs from "node:fs";
import path from "node:path";
export const privateFiles = [
  "prepared.json",
  "merged.input.json",
  "closed.input.json",
  "merged.wtns",
  "closed.wtns",
];
export function cleanupPrivate(dir) {
  for (const name of privateFiles) {
    try {
      fs.unlinkSync(path.join(dir, name));
    } catch {}
  }
}
export function saveStatus(dir, state) {
  const temp = path.join(dir, "status.tmp.json");
  fs.writeFileSync(temp, JSON.stringify(state), { mode: 0o600 });
  fs.renameSync(temp, path.join(dir, "status.json"));
}
export function readStatus(dir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, "status.json"), "utf8"));
  } catch {
    return undefined;
  }
}
export function recoverJobs(root) {
  if (!fs.existsSync(root)) return;
  for (const id of fs.readdirSync(root)) {
    const dir = path.join(root, id);
    if (!fs.statSync(dir).isDirectory()) continue;
    const state = readStatus(dir);
    if (!state || ["queued", "proving"].includes(state.status))
      saveStatus(dir, {
        id,
        status: "failed",
        stage: "Prover restarted",
        preview: state?.preview,
        error:
          "The prover restarted before this job finished. Upload the receipts to try again.",
      });
    cleanupPrivate(dir);
  }
}
