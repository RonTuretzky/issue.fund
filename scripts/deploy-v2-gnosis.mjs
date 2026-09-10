import fs from "node:fs";
import { createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { gnosis } from "viem/chains";
import { hiddenKey } from "./hidden-key.mjs";
import {
  assertTerms,
  planDeployment,
  resumeDeployment,
} from "./v2-deployment.mjs";

// Default is a read-only plan. Do not put the signing key in a command argument.
try {
  const execute = process.argv.includes("--execute");
  if (process.argv.slice(2).some((x) => x !== "--execute"))
    throw Error(
      "Only --execute is supported; set the public deployment terms in environment variables",
    );
  const legacy = JSON.parse(
    fs.readFileSync("public/deployment.gnosis.json", "utf8"),
  );
  if (legacy.chainId !== 100) throw Error("Gnosis chain 100 required");
  const terms = {
    legacy,
    feeRecipient: process.env.FEE_RECIPIENT,
    deployer: process.env.EXPECTED_DEPLOYER,
    feeBps: Number(process.env.CLAIM_FEE_BPS ?? 100),
  };
  assertTerms(terms);
  const client = createPublicClient({
    chain: gnosis,
    transport: http(legacy.rpcUrl, { timeout: 15000, retryCount: 0 }),
    cacheTime: 0,
  });
  if (!execute) {
    const { transaction, ...plan } = await planDeployment(client, terms);
    fs.mkdirSync(".local", { recursive: true });
    fs.writeFileSync(
      ".local/v2-deployment-plan.json",
      JSON.stringify(plan, null, 2) + "\n",
    );
    console.log(JSON.stringify({ ...plan, broadcast: false }, null, 2));
  } else {
    const account = privateKeyToAccount(await hiddenKey());
    const path = ".local/v2-deployment-checkpoint.json";
    const { manifest, checkpoint } = await resumeDeployment({
      client,
      account,
      terms,
      load: () => {
        if (!fs.existsSync(path)) return null;
        const stat = fs.statSync(path);
        if (!stat.isFile() || stat.mode & 0o077)
          throw Error("Checkpoint must be a private regular file");
        return JSON.parse(fs.readFileSync(path, "utf8"));
      },
      save: (state) => {
        fs.mkdirSync(".local", { recursive: true });
        fs.writeFileSync(
          path + ".next",
          JSON.stringify(state, null, 2) + "\n",
          { mode: 0o600, flush: true },
        );
        fs.renameSync(path + ".next", path);
        const directory = fs.openSync(".local", "r");
        try {
          fs.fsyncSync(directory);
        } finally {
          fs.closeSync(directory);
        }
      },
    });
    fs.writeFileSync(
      ".local/v2-release.json",
      JSON.stringify(manifest, null, 2) + "\n",
    );
    console.log(
      JSON.stringify({
        deployed: manifest.contract,
        feeBps: manifest.feeBps,
        feeRecipient: manifest.feeRecipient,
        transaction: checkpoint.hash,
        candidateManifest: ".local/v2-release.json",
        published: false,
      }),
    );
  }
} catch (error) {
  console.error(error.shortMessage ?? error.message);
  process.exitCode = 1;
}
