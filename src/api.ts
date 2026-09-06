import { staticApi, STATIC_MODE } from "./static-api";
export async function api<T>(path: string, data?: unknown): Promise<T> {
  if (STATIC_MODE) return staticApi<T>(path, data);
  const r = await fetch(`/api${path}`, {
    method: data ? "POST" : "GET",
    headers: data ? { "Content-Type": "application/json" } : undefined,
    body: data ? JSON.stringify(data) : undefined,
  });
  let out;
  try {
    out = await r.json();
  } catch {
    throw new Error(
      "The local service is unavailable. Check that npm run dev is running.",
    );
  }
  if (!r.ok)
    throw new Error(out.error ?? "The request could not be completed.");
  return out;
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
