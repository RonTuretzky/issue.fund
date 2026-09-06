import { staticApi, STATIC_MODE } from "./static-api";
export async function api<T>(path: string): Promise<T> {
  if (STATIC_MODE) return staticApi<T>(path);
  const r = await fetch(`/api${path}`);
  let body;
  try {
    body = await r.json();
  } catch {
    throw new Error("The local development service is unavailable.");
  }
  if (!r.ok) throw new Error(body.error ?? "The request failed.");
  return body;
}
export const short = (s: string) => `${s.slice(0, 6)}…${s.slice(-4)}`;
export function friendly(error: unknown) {
  const e = error as { shortMessage?: string; message?: string; code?: number };
  if (e.code === 4001 || /rejected|denied/i.test(e.message ?? ""))
    return "Transaction cancelled in your wallet. You can try again.";
  return (
    e.shortMessage ?? e.message ?? "Something went wrong. Please try again."
  );
}
