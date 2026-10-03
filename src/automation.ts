export type CollectionMode = "automatic" | "manual";
export type AutomationReadiness = {
  state: "preparing" | "ready" | "attention";
  code?: string | null;
  issueId?: number;
  repoId?: number;
  repo?: string;
  issue?: number;
  branch?: string;
  lastCheckedAt?: number;
  lastDeliveryAt?: number;
  installUrl?: string | null;
};
export type ClaimProgress = {
  state: string;
  code?: string | null;
  transactionHash?: string | null;
  updatedAt?: number;
};
export async function automationRequest<T>(
  base: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const url = new URL(base);
  if (
    url.protocol !== "https:" &&
    !(
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(url.hostname)
    )
  )
    throw Error("The collector must use a secure connection.");
  const response = await fetch(`${base.replace(/\/$/, "")}${path}`, {
    method: body ? "POST" : "GET",
    credentials: "omit",
    referrerPolicy: "no-referrer",
    cache: "no-store",
    ...(body
      ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
    signal: AbortSignal.timeout(20000),
  });
  const data = await response.json();
  if (!response.ok)
    throw Object.assign(Error(automationMessage(data.code)), {
      code: data.code,
      installUrl: data.installUrl,
    });
  return data;
}
export function automationMessage(code?: string | null): string {
  const messages: Record<string, string> = {
    maintainer_installation_required:
      "A repository maintainer needs to enable the collector before automatic claims can start.",
    classic_watch_token_required:
      "The collector's GitHub connection needs an operator update. Choose manual collection or try again later.",
    github_permissions_missing:
      "The collector cannot access the required GitHub permissions. A maintainer or service operator needs to fix this.",
    collector_has_repository_privileges:
      "The collection account has repository permissions that prevent safe automatic submission. The service operator needs to resolve this.",
    disclosure_validation_pending:
      "Automatic submission is awaiting its service checks. You can fund with manual email collection meanwhile.",
    waiting_for_first_notification:
      "Watching is being prepared. The collector must receive a GitHub notification before it can confirm delivery.",
    mailbox_unavailable:
      "The collector's mailbox is unavailable. Retry later or arrange manual collection before the merge.",
    subscription_check_stale:
      "The notification subscription needs a fresh check. Retry before funding with automatic collection.",
    notifications_started_late:
      "The collector started watching after this bounty was funded. Earlier emails may be missing; manual receipts may be needed.",
    conversation_lock_required:
      "The completed issue and PR need to be locked before the collector can publish its receipts.",
    relay_needs_gas:
      "The relay needs gas funds. Your reward remains in escrow while the service operator replenishes it.",
    relay_daily_budget_exhausted:
      "The relay has reached its daily gas budget. The claim will be retried.",
    relay_gas_limit:
      "Network costs exceed the relay's limit. The claim will be retried when costs permit.",
    relay_replacement_gas_limit:
      "The pending transaction cannot be sped up within the relay's gas limit.",
    github_rate_limited:
      "GitHub is limiting requests. Wait a little, then retry.",
    preparation_rate_limited:
      "Too many setup attempts. Wait a minute, then retry.",
    repository_capacity_reached:
      "The collector is at capacity. Choose manual collection or contact the service operator.",
    repository_identity_changed:
      "The repository's identity changed. A maintainer needs to check the bounty's fixed repository terms.",
    repository_renamed:
      "The repository was renamed. The bounty's original repository name is still part of its claim terms.",
    chain_reorganization:
      "The service is rechecking the bounty after a chain reorganization.",
    funding_not_indexed:
      "The service is waiting for confirmed funding before it tracks this claim.",
    waiting_for_receipts:
      "Waiting for the original merged-PR and linked issue-closure emails.",
    claim_window_ended:
      "The claim window has ended. The funder can request a refund.",
  };
  return (
    messages[code ?? ""] ??
    "The collector needs attention. Retry later or use the manual receipt flow."
  );
}
