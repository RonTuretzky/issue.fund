import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { createPublicClient, createWalletClient, http } from "viem";
import { foundry } from "viem/chains";
const transport = http("http://127.0.0.1:8547");
const publicClient = createPublicClient({ chain: foundry, transport });
if ((await publicClient.getChainId()) !== 31337)
  throw new Error("This script only deploys to local chain 31337.");
if (fs.existsSync(".local/deployment.json")) {
  const existing = JSON.parse(
    fs.readFileSync(".local/deployment.json", "utf8"),
  );
  if (await publicClient.getCode({ address: existing.contract }))
    throw new Error(
      "A deployment already exists. Reuse it; this script will not replace it.",
    );
}
if (
  !fs.existsSync("contracts/ReceiptVerifier.sol") ||
  !fs.existsSync("artifacts/setup-metadata.json")
)
  throw new Error("Finish npm run setup before deploying.");
if (spawnSync("forge", ["build"], { stdio: "inherit" }).status !== 0)
  throw new Error("Contract build failed.");
const wallet = createWalletClient({ chain: foundry, transport });
const [account] = await wallet.getAddresses();
const artifact = (file, name) =>
  JSON.parse(fs.readFileSync(`out/${file}.sol/${name}.json`, "utf8"));
const v = artifact("ReceiptVerifier", "Groth16Verifier");
const e = artifact("MergeBounty", "MergeBounty");
const keyHash =
  process.env.MERGEBOUNTY_DKIM_KEY_HASH ??
  "18769159890606851885526203517158331386071551795170342791119488780143683832216";
async function deploy(a, args = []) {
  const hash = await wallet.deployContract({
    account,
    abi: a.abi,
    bytecode: a.bytecode.object,
    args,
  });
  const r = await publicClient.waitForTransactionReceipt({ hash });
  if (!r.contractAddress || r.status !== "success")
    throw new Error("Deployment reverted.");
  return r.contractAddress;
}
const verifier = await deploy(v);
const contract = await deploy(e, [verifier, BigInt(keyHash)]);
const d = {
  contract,
  verifier,
  chainId: 31337,
  keyHash,
  deployedAt: new Date().toISOString(),
};
fs.mkdirSync(".local", { recursive: true, mode: 0o700 });
fs.writeFileSync(".local/deployment.json", JSON.stringify(d, null, 2));
console.log(d);
