import { spawn } from "node:child_process";
import { hiddenKey } from "./hidden-key.mjs";
const mode = process.argv[2];
if (!["fund", "claim", "relay-withdraw"].includes(mode))
  throw Error("Choose fund, claim, or relay-withdraw");
const key = await hiddenKey();
const child = spawn(
  "npx",
  [
    "playwright",
    "test",
    "tests/browser/gnosis.spec.ts",
    "--grep",
    mode === "fund"
      ? "fund the Gnosis fixture"
      : mode === "relay-withdraw"
        ? "withdraw server-relayed"
        : "claim genuine",
  ],
  {
    stdio: "inherit",
    env: { ...process.env, GNOSIS_DEPLOYER_KEY: key, RUN_GNOSIS_E2E: "1" },
  },
);
child.on("exit", (code) => process.exit(code ?? 1));
