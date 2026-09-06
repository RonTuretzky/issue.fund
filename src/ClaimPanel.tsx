import { useRef, useState } from "react";
import {
  CheckCircle2,
  FileCheck2,
  Loader2,
  ShieldCheck,
  Upload,
  Wallet,
} from "lucide-react";
import { prepareReceipt, checkPair, type Receipt } from "../shared/dkim.mjs";
import type { Bounty, Config, Preview } from "./types";
import { friendly } from "./api";
export function ClaimPanel({
  bounty,
  config,
  account,
  pending,
  wrongNetwork,
  connect,
  submit,
}: {
  bounty: Bounty;
  config: Config;
  account?: string;
  pending: boolean;
  wrongNetwork: boolean;
  connect: () => void;
  submit: (merged: Receipt, closed: Receipt) => Promise<void>;
}) {
  const [files, setFiles] = useState<{ merge?: File; closure?: File }>({});
  const [result, setResult] = useState<{
    merged: Receipt;
    closed: Receipt;
    preview: Preview;
  }>();
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const generation = useRef(0);
  async function inspect() {
    if (!files.merge || !files.closure || checking) return;
    const current = ++generation.current;
    setChecking(true);
    setResult(undefined);
    setError("");
    setAccepted(false);
    try {
      const [m, c] = await Promise.all([
        prepareReceipt(
          new Uint8Array(await files.merge.arrayBuffer()),
          config.dkimKey,
        ),
        prepareReceipt(
          new Uint8Array(await files.closure.arrayBuffer()),
          config.dkimKey,
        ),
      ]);
      const preview = checkPair(m, c, bounty);
      if (generation.current === current)
        setResult({ merged: m.receipt, closed: c.receipt, preview });
    } catch (e) {
      if (generation.current === current) setError(friendly(e));
    } finally {
      if (generation.current === current) setChecking(false);
    }
  }
  return (
    <>
      <p>
        Choose the original GitHub merge and linked issue-closure emails. Your
        browser checks the signatures; the contract verifies them again when you
        claim.
      </p>
      <div className="uploads">
        {(["merge", "closure"] as const).map((kind, i) => (
          <label
            className={`upload ${files[kind] ? "has-file" : ""}`}
            key={kind}
          >
            <input
              type="file"
              accept=".eml,message/rfc822"
              disabled={checking || pending}
              aria-label={
                kind === "merge" ? "Merged PR email" : "Issue closure email"
              }
              onChange={(e) => {
                const file = e.target.files?.[0];
                generation.current++;
                setResult(undefined);
                setAccepted(false);
                setError("");
                if (file && file.size > 100000) {
                  setFiles((f) => ({ ...f, [kind]: undefined }));
                  setError("Choose an .eml file under 100 KB.");
                  e.target.value = "";
                  return;
                }
                setFiles((f) => ({ ...f, [kind]: file }));
              }}
            />
            {files[kind] ? <FileCheck2 size={25} /> : <Upload size={25} />}
            <strong>
              {i + 1}.{" "}
              {kind === "merge" ? "Merged PR email" : "Issue closure email"}
            </strong>
            <span>{files[kind]?.name ?? "Choose original .eml"}</span>
          </label>
        ))}
      </div>
      {!result && (
        <button
          className="button primary"
          disabled={!files.merge || !files.closure || checking || pending}
          onClick={inspect}
        >
          {checking ? (
            <Loader2 className="spin" size={17} />
          ) : (
            <ShieldCheck size={17} />
          )}
          {checking ? "Checking signatures…" : "Check receipts"}
        </button>
      )}
      {result && (
        <div className="receipt-review">
          <h3>
            <CheckCircle2 size={20} />
            Signatures and bounty match
          </h3>
          <dl>
            <dt>Closing pull request</dt>
            <dd>#{result.preview.pr}</dd>
            <dt>Payout wallet</dt>
            <dd className="full-address">{result.preview.wallet}</dd>
          </dl>
          {result.preview.wallet.toLowerCase() !== account?.toLowerCase() && (
            <p className="inline-note">
              You can submit this claim, but payment will go to the wallet shown
              above.
            </p>
          )}
          <label className="checkbox-label disclosure-note">
            <input
              type="checkbox"
              checked={accepted}
              disabled={pending}
              onChange={(e) => setAccepted(e.target.checked)}
            />
            Submitting makes these emails public, including your email address
            and notification links.
          </label>
          <button
            className="button primary"
            disabled={
              pending ||
              wrongNetwork ||
              (!!account && !accepted) ||
              bounty.status !== 0
            }
            onClick={async () => {
              if (!account) {
                connect();
                return;
              }
              if (!accepted) return;
              setError("");
              try {
                await submit(result.merged, result.closed);
              } catch (e) {
                setError(friendly(e));
              }
            }}
          >
            {pending ? (
              <Loader2 className="spin" size={17} />
            ) : (
              <Wallet size={17} />
            )}
            {account ? "Submit claim" : "Connect wallet to claim"}
          </button>
        </div>
      )}
      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}
    </>
  );
}
