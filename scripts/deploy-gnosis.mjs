import fs from "node:fs";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  encodeDeployData,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { gnosis } from "viem/chains";
import { artifact, dkimKey, exportManifest } from "./gnosis-manifest.mjs";
import { hiddenKey } from "./hidden-key.mjs";
try {
  const account = privateKeyToAccount(await hiddenKey());
  if (
    process.env.EXPECTED_DEPLOYER &&
    account.address.toLowerCase() !==
      process.env.EXPECTED_DEPLOYER.toLowerCase()
  )
    throw Error("Unexpected deployer");
  const client = createPublicClient({
    chain: gnosis,
    transport: http("https://rpc.gnosischain.com"),
  });
  const wallet = createWalletClient({
    account,
    chain: gnosis,
    transport: http("https://rpc.gnosischain.com"),
  });
  if ((await client.getChainId()) !== 100)
    throw Error("Gnosis chain 100 required");
  const file = ".local/rsa-deploy-progress.json";
  const state = fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, "utf8"))
    : { deployer: account.address };
  if (state.deployer !== account.address)
    throw Error("Deployment checkpoint belongs to another account");
  const save = () =>
    fs.writeFileSync(file, JSON.stringify(state, null, 2) + "\n");
  const deploy = async (name, args) => {
    const a = artifact(name);
    if (!state[name]) {
      const data = encodeDeployData({
        abi: a.abi,
        bytecode: a.bytecode.object,
        args,
      });
      const gas = await client.estimateGas({ account, data });
      const maxFeePerGas = 10000000n;
      if (
        gas > 10000000n ||
        (await client.getBalance({ address: account.address })) <
          gas * maxFeePerGas + parseEther("0.001")
      )
        throw Error("Deployment exceeds gas or balance limit");
      const hash = await wallet.deployContract({
        abi: a.abi,
        bytecode: a.bytecode.object,
        args,
        gas: (gas * 120n) / 100n,
        maxFeePerGas,
        maxPriorityFeePerGas: 1n,
      });
      state[name] = { hash };
      save();
      console.log({ contract: name, transaction: hash });
    }
    const r = await client.waitForTransactionReceipt({
      hash: state[name].hash,
      pollingInterval: 2000,
      timeout: 120000,
    });
    if (r.status !== "success" || !r.contractAddress)
      throw Error("Deployment failed");
    state[name].address = r.contractAddress;
    save();
    return r.contractAddress;
  };
  const verifier = await deploy("GithubDkimVerifier", [dkimKey.modulus]);
  const contract = await deploy("MergeBounty", [verifier]);
  await exportManifest(client, contract, verifier, [
    state.GithubDkimVerifier.hash,
    state.MergeBounty.hash,
  ]);
  console.log({
    deployed: true,
    protocol: "rsa-dkim-v1",
    contract,
    verifier,
    chainId: 100,
  });
} catch (e) {
  console.error(e.shortMessage ?? e.message);
  process.exitCode = 1;
}
