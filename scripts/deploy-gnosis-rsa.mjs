import fs from "node:fs";
import { createPublicClient, http } from "viem";
import { gnosis } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { hiddenKey } from "./hidden-key.mjs";
import { resumeRsaDeployment, planRsaDeployment } from "./rsa-deployment.mjs";

const legacy = JSON.parse(fs.readFileSync("public/deployment.gnosis.json", "utf8"));
if (legacy.chainId !== 100) throw Error("Gnosis chain 100 required");
const terms = {
  deployer: process.env.EXPECTED_DEPLOYER,
  feeRecipient: process.env.FEE_RECIPIENT ?? legacy.feeRecipient,
  feeBps: Number(process.env.CLAIM_FEE_BPS ?? legacy.feeBps ?? 100),
};
if (!terms.deployer) throw Error("Set EXPECTED_DEPLOYER to the deployment wallet address");
const client = createPublicClient({ chain: gnosis, transport: http(legacy.rpcUrl, { timeout: 15000, retryCount: 0 }), cacheTime: 0 });
const execute = process.argv.includes("--execute");
if (process.argv.slice(2).some((arg) => arg !== "--execute")) throw Error("Only --execute is supported");

if (!execute) {
  const plan = await planRsaDeployment(client, terms);
  fs.writeFileSync(".local/rsa-deployment-plan.json", JSON.stringify(plan, (_, value) => typeof value === "bigint" ? `${value}` : value, 2) + "\n");
  console.log(JSON.stringify({ ...plan, broadcast: false }, (_, value) => typeof value === "bigint" ? `${value}` : value, 2));
} else {
  const account = privateKeyToAccount(await hiddenKey());
  const path = ".local/rsa-deployment-checkpoint.json";
  const { manifest, checkpoint } = await resumeRsaDeployment({
    client,
    account,
    terms,
    load: () => {
      if (!fs.existsSync(path)) return null;
      const stat = fs.statSync(path);
      if (!stat.isFile() || stat.mode & 0o077) throw Error("Checkpoint must be a private regular file");
      return JSON.parse(fs.readFileSync(path, "utf8"));
    },
    save: (state) => {
      fs.mkdirSync(".local", { recursive: true });
      fs.writeFileSync(`${path}.next`, JSON.stringify(state, null, 2) + "\n", { mode: 0o600, flush: true });
      fs.renameSync(`${path}.next`, path);
    },
  });
  fs.writeFileSync(".local/rsa-release.json", JSON.stringify(manifest, null, 2) + "\n");
  console.log(JSON.stringify({ deployed: manifest.contract, verifier: manifest.verifier, transactions: [checkpoint.verifierHash, checkpoint.escrowHash], published: false }));
}
