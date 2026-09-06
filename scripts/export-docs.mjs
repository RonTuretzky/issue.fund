import fs from "node:fs";
import path from "node:path";
import { groups, pages } from "../shared/documentation.mjs";
const site = "https://issue.fund/";
const deployment = JSON.parse(
  fs.readFileSync("public/deployment.gnosis.json", "utf8"),
);
const linkify = (s) =>
  s.replace(
    /\]\(#docs\/?([^)]*)\)/g,
    (_, id) => `](${site}#docs${id ? "/" + id : ""})`,
  );
const files = new Map();
files.set(
  "docs/README.md",
  "# Documentation\n\nOnboarding and reference guides for maintainers, funders, contributors and users. [Read the documentation website](" +
    site +
    "#docs).\n\nGenerated from `shared/documentation.mjs` with `npm run docs:build`.\n\n" +
    groups
      .map(
        (g) =>
          "## " +
          g.title +
          "\n\n" +
          g.description +
          "\n\n" +
          pages
            .filter((p) => p.group === g.id)
            .map((p) => `- [${p.title}](${p.id}.md) — ${p.summary}`)
            .join("\n"),
      )
      .join("\n\n") +
    "\n",
);
for (const p of pages) {
  let text = `# ${p.title}\n\n${p.summary}\n\n[All documentation](${path.posix.relative(path.posix.dirname(p.id), "README.md")}) · [Read on the website](${site}#docs/${p.id})\n`;
  for (const s of p.sections) {
    text += `\n## ${s.title}\n\n`;
    if (s.paragraphs) text += s.paragraphs.join("\n\n") + "\n\n";
    if (s.steps)
      text += s.steps.map((x, i) => `${i + 1}. ${x}`).join("\n") + "\n\n";
    if (s.bullets) text += s.bullets.map((x) => "- " + x).join("\n") + "\n\n";
    if (s.table)
      text +=
        "| " +
        s.table.headers.join(" | ") +
        " |\n| " +
        s.table.headers.map(() => "---").join(" | ") +
        " |\n" +
        s.table.rows.map((r) => "| " + r.join(" | ") + " |").join("\n") +
        "\n\n";
    if (s.code) text += "```text\n" + s.code + "\n```\n\n";
    if (s.notice) text += "> " + s.notice + "\n\n";
    if (s.deployment)
      text += `- Network: Gnosis (100), native xDAI\n- Escrow: [${deployment.contract}](${deployment.explorerUrl}/address/${deployment.contract}?tab=contract)\n- RSA/DKIM verifier: [${deployment.verifier}](${deployment.explorerUrl}/address/${deployment.verifier}?tab=contract)\n\n`;
    if (s.links)
      text +=
        s.links
          .map(
            (l) =>
              `- [${l.label}](${l.url.startsWith("#") || l.url.startsWith("/") ? site + l.url.replace(/^\//, "") : l.url})`,
          )
          .join("\n") + "\n";
  }
  files.set(`docs/${p.id}.md`, linkify(text.trimEnd()) + "\n");
}
const check = process.argv.includes("--check");
let stale = false;
for (const [file, content] of files) {
  if (check) {
    if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== content) {
      console.error("Documentation needs regeneration: " + file);
      stale = true;
    }
  } else {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
}
if (stale) process.exitCode = 1;
else
  console.log(
    `${pages.length} documentation pages ${check ? "checked" : "exported"}.`,
  );
