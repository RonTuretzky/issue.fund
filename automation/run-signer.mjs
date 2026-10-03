import { privateKeyToAccount } from "viem/accounts";
import { Store } from "./store.mjs";
import { loadDeployments, readSecret, keyFile } from "./config.mjs";
import { RestrictedSigner } from "./signer.mjs";
import { serveSigner } from "./signer-ipc.mjs";
import { safeCode } from "./errors.mjs";

try {
  process.umask(0o077);
  const deployments = loadDeployments(process.env.DEPLOYMENTS_FILE);
  const account = privateKeyToAccount(
    readSecret(process.env.RELAY_PRIVATE_KEY_FILE),
  );
  const store = new Store(
    process.env.SIGNER_DATABASE,
    keyFile(process.env.SIGNER_STORAGE_KEY_FILE),
  );
  const signer = new RestrictedSigner({
    account,
    store,
    deployments,
    chainId: deployments[0].chainId,
    maxGas: BigInt(process.env.RELAY_MAX_GAS ?? "15000000"),
    maxGasPrice: BigInt(process.env.RELAY_MAX_GAS_PRICE_WEI ?? "10000000000"),
    dailyBudget: BigInt(
      process.env.RELAY_DAILY_BUDGET_WEI ?? "1000000000000000000",
    ),
  });
  const server = await serveSigner(process.env.SIGNER_SOCKET, signer);
  console.log(
    JSON.stringify({ event: "signer_started", address: account.address }),
  );
  for (const signal of ["SIGINT", "SIGTERM"])
    process.once(signal, () =>
      server.close(() => {
        store.close();
        process.exit(0);
      }),
    );
} catch (error) {
  console.error(
    JSON.stringify({ event: "signer_start_failed", code: safeCode(error) }),
  );
  process.exit(1);
}
