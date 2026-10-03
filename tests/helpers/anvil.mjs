import net from "node:net";
import { spawn } from "node:child_process";
import { once } from "node:events";
import {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
} from "viem";
import { mnemonicToAccount } from "viem/accounts";
export async function isolatedAnvil(chainId = 31337) {
  const listener = net.createServer();
  listener.listen(0, "127.0.0.1");
  await once(listener, "listening");
  const port = listener.address().port;
  await new Promise((resolve) => listener.close(resolve));
  const process = spawn(
    "anvil",
    [
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      "--chain-id",
      String(chainId),
      "--gas-limit",
      "30000000",
      "--silent",
    ],
    { stdio: "ignore" },
  );
  const url = `http://127.0.0.1:${port}`;
  const chain = defineChain({
    id: chainId,
    name: "isolated test chain",
    nativeCurrency: { name: "Test Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [url] } },
  });
  const accounts = [0, 1, 2].map((addressIndex) =>
    mnemonicToAccount(
      "test test test test test test test test test test test junk",
      { addressIndex },
    ),
  );
  const client = createPublicClient({
    chain,
    transport: http(url, { retryCount: 0, timeout: 1000 }),
    cacheTime: 0,
  });
  const wallet = createWalletClient({
    chain,
    account: accounts[0],
    transport: http(url),
  });
  const close = async () => {
    if (process.exitCode === null && process.signalCode === null) {
      process.kill();
      await once(process, "exit");
    }
  };
  try {
    for (let n = 0; n < 100; n++) {
      try {
        if ((await client.getChainId()) === chainId)
          return { client, wallet, accounts, close, url };
      } catch {}
      if (process.exitCode !== null) throw Error("Anvil exited during startup");
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw Error("Anvil failed to start");
  } catch (error) {
    await close();
    throw error;
  }
}
