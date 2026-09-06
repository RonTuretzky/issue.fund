import fs from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createPublicClient, createWalletClient, http, keccak256 } from "viem";
import { foundry } from "viem/chains";
const client = createPublicClient({
  chain: foundry,
  transport: http("http://127.0.0.1:8547"),
});
if ((await client.getChainId()) !== 31337) throw new Error("Local Anvil only.");
const file = ".local/deployment.rsa.json";
if (fs.existsSync(file)) {
  const d = JSON.parse(fs.readFileSync(file));
  if (await client.getCode({ address: d.contract })) {
    console.log("Reusing the existing direct DKIM deployment.");
    process.exit(0);
  }
}
if (spawnSync("forge", ["build"], { stdio: "inherit" }).status !== 0)
  throw new Error("Contract build failed.");
const wallet = createWalletClient({
  chain: foundry,
  transport: http("http://127.0.0.1:8547"),
});
const [account] = await wallet.getAddresses();
const key = JSON.parse(
  fs.readFileSync(
    process.env.MERGEBOUNTY_TEST_KEY ?? "public/github-dkim-key.json",
  ),
);
if (keccak256(key.modulus) !== key.keyHash)
  throw new Error("DKIM key hash mismatch.");
const artifact = (name) =>
  JSON.parse(fs.readFileSync(`out/${name}.sol/${name}.json`));
const transactions = [];
async function deploy(name, args) {
  const a = artifact(name);
  const hash = await wallet.deployContract({
    account,
    abi: a.abi,
    bytecode: a.bytecode.object,
    args,
  });
  const r = await client.waitForTransactionReceipt({ hash });
  if (r.status !== "success" || !r.contractAddress)
    throw new Error("Deployment failed.");
  transactions.push(hash);
  return r.contractAddress;
}
const verifier = await deploy("GithubDkimVerifier", [key.modulus]);
const contract = await deploy("MergeBounty", [verifier]);
const digest = (p) =>
  createHash("sha256").update(fs.readFileSync(p)).digest("hex");
const d = {
  protocol: "rsa-dkim-v1",
  chainId: 31337,
  chainName: "Anvil · test ETH",
  currency: "ETH",
  experimental: true,
  local: true,
  contract,
  verifier,
  keyHash: key.keyHash,
  dkimKey: key,
  abi: artifact("MergeBounty").abi,
  deployedAt: new Date().toISOString(),
  deploymentTransactions: transactions,
  verifierSourceSha256: digest("contracts/GithubDkimVerifier.sol"),
};
fs.mkdirSync(".local", { recursive: true, mode: 0o700 });
fs.writeFileSync(file, JSON.stringify(d, null, 2));
console.log(JSON.stringify({ contract, verifier, chainId: 31337 }));
