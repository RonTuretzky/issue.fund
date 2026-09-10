import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import {
  automationRequest,
  automationMessage,
  type AutomationReadiness,
  type CollectionMode,
} from "./automation";

export function AutomationSetup({
  base,
  issueUrl,
  mode,
  onMode,
  onReadiness,
  state,
  disabled,
}: {
  disabled?: boolean;
  base: string;
  issueUrl: string;
  mode: CollectionMode;
  onMode: (mode: CollectionMode) => void;
  onReadiness: (state: AutomationReadiness | undefined) => void;
  state?: AutomationReadiness;
}) {
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    onReadiness(undefined);
    if (mode !== "automatic") return;
    const update = async (prepare: boolean) => {
      try {
        const result = await automationRequest<AutomationReadiness>(
          base,
          prepare
            ? "/v1/issues/prepare"
            : `/v1/issues/status?url=${encodeURIComponent(issueUrl)}`,
          prepare ? { url: issueUrl } : undefined,
        );
        if (stopped) return;
        onReadiness(result);
        timer = setTimeout(() => void update(false), 15000);
      } catch (error) {
        if (stopped) return;
        const e = error as { code?: string; installUrl?: string };
        const result: AutomationReadiness = {
          state: "attention",
          code: e.code ?? "service_unavailable",
          installUrl: e.installUrl,
        };
        onReadiness(result);
      }
    };
    void update(true);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [base, issueUrl, mode, revision, onReadiness]);
  const install =
    state?.installUrl &&
    /^https:\/\/github\.com\/apps\/[a-z0-9-]+\/installations\/new$/.test(
      state.installUrl,
    )
      ? state.installUrl
      : undefined;
  return (
    <fieldset className="collection-choice" disabled={disabled}>
      <legend>How should the claim be submitted?</legend>
      <label className="checkbox-label">
        <input
          type="radio"
          name="collectionMode"
          value="automatic"
          checked={mode === "automatic"}
          onChange={() => onMode("automatic")}
        />
        Automatically through the collector
      </label>
      <label className="checkbox-label">
        <input
          type="radio"
          name="collectionMode"
          value="manual"
          checked={mode === "manual"}
          onChange={() => onMode("manual")}
        />
        I’ll arrange the emails and submit manually
      </label>
      {mode === "automatic" ? (
        <div
          className={`automation-state ${state?.state === "ready" ? "ready" : ""}`}
          role="status"
        >
          <strong>
            {!state ? (
              <>
                <Loader2 size={17} className="spin" />
                Preparing notifications
              </>
            ) : state.state === "ready" ? (
              <>
                <CheckCircle2 size={17} />
                Notifications ready
              </>
            ) : state.state === "preparing" ? (
              "Preparing notifications"
            ) : (
              "Attention needed"
            )}
          </strong>
          <p>
            {state?.state === "ready"
              ? "The collector has received a notification and checked watching. It will collect the merge and closure emails, then submit eligible claims. The contributor still withdraws from their wallet."
              : automationMessage(
                  state?.code ?? "waiting_for_first_notification",
                )}
          </p>
          {state?.lastDeliveryAt && (
            <small>
              Last email received{" "}
              {new Date(state.lastDeliveryAt).toLocaleString()}
            </small>
          )}
          {state && state.state !== "ready" && (
            <div className="inline-actions">
              <button
                className="button"
                type="button"
                onClick={() => setRevision((r) => r + 1)}
              >
                <RefreshCw size={15} />
                Retry setup
              </button>
              {install && (
                <a
                  className="text-button"
                  href={install}
                  target="_blank"
                  rel="noreferrer"
                >
                  Maintainer: enable collector
                </a>
              )}
            </div>
          )}
          <p className="fine-print">
            The service publishes its email receipts and notification links.
            Participating maintainers keep completed issue and PR conversations
            locked. Delivery can still fail; manual submission remains
            available.
          </p>
        </div>
      ) : (
        <p className="field-note">
          Enable notifications before work is merged and keep both original
          emails. The contributor or another receipt holder submits the claim.
        </p>
      )}
    </fieldset>
  );
}
