import fs from "node:fs";
import { execFileSync } from "node:child_process";
const d = JSON.parse(fs.readFileSync("public/deployment.gnosis.json", "utf8"));
// Resolve Blockscout's canonical host before POST: a 301 can discard the body.
const probe = await fetch(
  "https://gnosis.blockscout.com/api?module=stats&action=ethsupply",
);
const origin = new URL(probe.url).origin;
if (
  !["https://gnosis.blockscout.com", "https://gnosisscan.io"].includes(origin)
)
  throw Error("Unexpected explorer host");
const results = [];
for (const [name, address, sig, arg] of [
  ["GithubDkimVerifier", d.verifier, "constructor(bytes)", d.dkimKey.modulus],
  ["MergeBounty", d.contract, "constructor(address)", d.verifier],
]) {
  const encoded = execFileSync("cast", ["abi-encode", sig, arg], {
    encoding: "utf8",
  }).trim();
  try {
    execFileSync(
      "forge",
      [
        "verify-contract",
        address,
        `contracts/${name}.sol:${name}`,
        "--chain",
        "100",
        "--verifier",
        "blockscout",
        "--verifier-url",
        origin + "/api",
        "--constructor-args",
        encoded,
        "--watch",
      ],
      { encoding: "utf8", timeout: 90000, stdio: ["ignore", "pipe", "pipe"] },
    );
  } catch (e) {
    fs.writeFileSync(
      `.local/verify-${name}.log`,
      String(e.stdout ?? "") + String(e.stderr ?? ""),
    );
  }
  const r = await (
    await fetch(
      `${origin}/api?module=contract&action=getsourcecode&address=${address}`,
    )
  ).json();
  const verified =
    r.status === "1" &&
    r.result?.[0]?.ContractName === name &&
    Boolean(r.result?.[0]?.SourceCode);
  results.push({
    name,
    address,
    verified,
    explorerUrl: `${origin}/address/${address}?tab=contract`,
    checkedAt: new Date().toISOString(),
  });
  console.log({ name, verified });
}
fs.writeFileSync(
  "deployments/gnosis/source-verification.json",
  JSON.stringify(results, null, 2) + "\n",
);
if (results.some((r) => !r.verified)) process.exitCode = 1;
