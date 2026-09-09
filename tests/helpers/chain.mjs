import fs from "node:fs";
import { createPublicClient, createWalletClient, http, parseEther } from "viem";
import { foundry } from "viem/chains";
import { signer } from "./receipts.mjs";
export const transport = http("http://127.0.0.1:8547");
export const client = createPublicClient({
  chain: foundry,
  transport,
  cacheTime: 0,
});
export const wallet = createWalletClient({ chain: foundry, transport });
export const rpc = (method, params = []) => client.request({ method, params });
export const artifact = (name) =>
  JSON.parse(fs.readFileSync(`out/${name}.sol/${name}.json`, "utf8"));
export async function restore(snapshot) {
  if (!(await rpc("evm_revert", [snapshot])))
    throw Error("Snapshot restore failed");
  await rpc("evm_setTime", [Math.floor(Date.now() / 1000)]);
  await rpc("evm_mine");
}
export async function fixture(bits = 1024, { version = 1 } = {}) {
  if ((await client.getChainId()) !== 31337)
    throw Error("Local test chain required");
  const accounts = await wallet.getAddresses();
  const s = signer(bits),
    v = artifact("GithubDkimVerifier"),
    e = artifact(version === 2 ? "MergeBountyV2" : "MergeBounty");
  const deploy = async (a, args) => {
    const hash = await wallet.deployContract({
      account: accounts[0],
      abi: a.abi,
      bytecode: a.bytecode.object,
      args,
    });
    const r = await client.waitForTransactionReceipt({
      hash,
      pollingInterval: 100,
    });
    if (r.status !== "success") throw Error("Test deployment failed");
    return r.contractAddress;
  };
  const verifier = await deploy(v, [s.key.modulus]);
  const contract = await deploy(
    e,
    version === 2 ? [verifier, accounts[2], 100n] : [verifier],
  );
  const read = (functionName, args = []) =>
    client.readContract({ address: contract, abi: e.abi, functionName, args });
  const write = async (
    functionName,
    args = [],
    account = accounts[0],
    value = undefined,
  ) => {
    const { request } = await client.simulateContract({
      address: contract,
      abi: e.abi,
      functionName,
      args,
      account,
      value,
    });
    const hash = await wallet.writeContract(request);
    const r = await client.waitForTransactionReceipt({
      hash,
      pollingInterval: 100,
    });
    if (r.status !== "success") throw Error("Test transaction failed");
    return r;
  };
  const now = Number((await client.getBlock()).timestamp);
  await write(
    "create",
    ["example/parser", 42n, "main", BigInt(now + 3600)],
    accounts[0],
    parseEther("0.01"),
  );
  const rawBounty = await read("getBounty", [1n]);
  const bountyRef = await read("referenceFor", [1n]);
  const options = {
    wallet: accounts[1],
    bountyRef,
    timestamp: Number(rawBounty.createdAt),
  };
  const merged = s.email(options),
    closed = s.email({ ...options, kind: "closure" });
  const config = {
    protocol: version === 2 ? "rsa-dkim-v2" : "rsa-dkim-v1",
    ...(version === 2 ? { feeBps: 100, feeRecipient: accounts[2] } : {}),
    experimental: true,
    chainId: 31337,
    chainName: "Anvil · test ETH",
    currency: "ETH",
    local: true,
    contract,
    verifier,
    keyHash: s.key.keyHash,
    dkimKey: s.key,
    abi: e.abi,
    chainTime: Number(rawBounty.createdAt),
  };
  const bounties = async () => {
    const b = await read("getBounty", [1n]);
    return [
      {
        ...b,
        id: 1,
        amount: String(b.amount),
        issue: Number(b.issue),
        pr: Number(b.pr),
        createdAt: Number(b.createdAt),
        deadline: Number(b.deadline),
        bountyRef,
        keyHash: s.key.keyHash,
      },
    ];
  };
  return {
    accounts,
    s,
    config,
    merged,
    closed,
    read,
    write,
    bounties,
    verifierAbi: v.abi,
  };
}
