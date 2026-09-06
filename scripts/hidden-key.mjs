// Secrets stay in process memory. Never put a signing key in a command argument.
export async function hiddenKey() {
  if (process.env.GNOSIS_DEPLOYER_KEY)
    return process.env.GNOSIS_DEPLOYER_KEY.trim();
  if (!process.stdin.isTTY)
    throw Error("Use a secret environment variable or an interactive terminal");
  process.stdin.setRawMode(true);
  process.stdin.resume();
  console.log("Ready for signing key through hidden terminal input.");
  return new Promise((resolve, reject) => {
    let input = "";
    const onData = (data) => {
      input += data.toString();
      if (input.includes("\u0003")) {
        finish();
        reject(Error("Cancelled"));
        return;
      }
      if (!/[\r\n]/.test(input)) return;
      finish();
      resolve(input.trim());
    };
    const finish = () => {
      process.stdin.removeListener("data", onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
    };
    process.stdin.on("data", onData);
  });
}
