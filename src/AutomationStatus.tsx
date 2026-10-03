import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import type { Bounty, Config } from "./types";
import {
  automationMessage,
  automationRequest,
  type ClaimProgress,
} from "./automation";

export function AutomationStatus({
  bounty,
  config,
}: {
  bounty: Bounty;
  config: Config;
}) {
  const [progress, setProgress] = useState<ClaimProgress>();
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!config.automationUrl) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const result = await automationRequest<ClaimProgress>(
          config.automationUrl!,
          `/v1/bounties/${bounty.chainId ?? config.chainId}/${bounty.contract ?? config.contract}/${bounty.id}/status`,
        );
        if (!cancelled) setProgress(result);
      } catch {
        if (!cancelled)
          setProgress({ state: "attention", code: "service_unavailable" });
      }
      if (!cancelled) timer = setTimeout(poll, 15000);
    };
    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [bounty.id, bounty.contract, config.automationUrl, revision]);
  if (!config.automationUrl) return null;
  const state =
    bounty.status === 2
      ? "refunded"
      : bounty.status === 1
        ? progress?.state === "withdrawn"
          ? "withdrawn"
          : "credited"
        : ["credited", "withdrawn", "refunded"].includes(progress?.state ?? "")
          ? "waiting_confirmation"
          : (progress?.state ?? "loading");
  const copy: Record<string, [string, string]> = {
    loading: [
      "Checking automatic claim",
      "Loading the collector’s latest status.",
    ],
    waiting: [
      "Waiting for GitHub emails",
      automationMessage(progress?.code ?? "waiting_for_receipts"),
    ],
    queued: [
      "Receipts collected",
      "The relay will check the completed conversations and submit the claim.",
    ],
    submitted: [
      "Claim submitted",
      "Waiting for the transaction to be confirmed. The reward remains in escrow until the claim succeeds.",
    ],
    waiting_confirmation: [
      "Checking settlement",
      "A claim or refund was observed. Waiting for chain confirmation.",
    ],
    credited: [
      "Reward credited",
      "The payout wallet can withdraw its balance. Claiming does not send funds to the wallet automatically.",
    ],
    withdrawn: [
      "Withdrawal confirmed",
      "The credited wallet withdrew after this claim.",
    ],
    refunded: [
      "Refund credited",
      "The funder can withdraw the returned reward.",
    ],
    attention: [
      "Automatic claim needs attention",
      automationMessage(progress?.code),
    ],
  };
  const [title, description] = copy[state] ?? copy.attention;
  const tx =
    progress?.transactionHash &&
    /^0x[0-9a-fA-F]{64}$/.test(progress.transactionHash)
      ? progress.transactionHash
      : undefined;
  return (
    <aside
      className="automation-state claim-automation"
      aria-label="Automatic claim status"
    >
      <strong>
        {state === "loading" && <Loader2 className="spin" size={16} />}
        {title}
      </strong>
      <p>{description}</p>
      {tx && config.explorerUrl && (
        <a
          href={`${config.explorerUrl}/tx/${tx}`}
          target="_blank"
          rel="noreferrer"
        >
          View claim transaction
        </a>
      )}
      {state === "attention" && (
        <button
          type="button"
          className="text-button"
          onClick={() => setRevision((r) => r + 1)}
        >
          <RefreshCw size={14} />
          Refresh status
        </button>
      )}
      {bounty.status === 0 && (
        <small>
          You can also submit your own original receipts below. The contract
          accepts only a valid claim and fixes the payout wallet.
        </small>
      )}
    </aside>
  );
}
