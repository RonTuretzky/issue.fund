import fs from "node:fs";
import { execFileSync } from "node:child_process";
const d = JSON.parse(
  fs.readFileSync(process.argv[2] ?? "public/deployment.gnosis.json", "utf8"),
);
if (d.chainId !== 100 || !["rsa-dkim-v1", "rsa-dkim-v2"].includes(d.protocol))
  throw Error("Expected a Gnosis direct-DKIM manifest");
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
for (const [name, address, sig, args] of [
  ["GithubDkimVerifier", d.verifier, "constructor(bytes)", [d.dkimKey.modulus]],
  d.protocol === "rsa-dkim-v2"
    ? [
        "MergeBountyV2",
        d.contract,
        "constructor(address,address,uint256)",
        [d.verifier, d.feeRecipient, String(d.feeBps)],
      ]
    : ["MergeBounty", d.contract, "constructor(address)", [d.verifier]],
]) {
  const encoded = execFileSync("cast", ["abi-encode", sig, ...args], {
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
const file = "deployments/gnosis/source-verification.json";
const previous = fs.existsSync(file)
  ? JSON.parse(fs.readFileSync(file, "utf8"))
  : [];
const merged = previous
  .filter(
    (old) =>
      !results.some(
        (next) => next.address.toLowerCase() === old.address.toLowerCase(),
      ),
  )
  .concat(results);
fs.writeFileSync(file, JSON.stringify(merged, null, 2) + "\n");
if (results.some((r) => !r.verified)) process.exitCode = 1;
