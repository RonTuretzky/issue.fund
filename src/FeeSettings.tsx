import { useCallback, useEffect, useId, useState } from "react";
import {
  createPublicClient,
  http,
  isAddress,
  zeroAddress,
  type Address,
} from "viem";
import { friendly, short } from "./api";
import type { Config } from "./types";

type Routing = { recipient: Address; owner: Address; pendingOwner: Address };
export function FeeSettings({
  config,
  account,
  disabled,
  transact,
}: {
  config: Config;
  account?: Address;
  disabled: boolean;
  transact: (
    name: string,
    args: unknown[],
    value?: bigint,
    target?: Config,
  ) => Promise<unknown>;
}) {
  const id = useId();
  const [routing, setRouting] = useState<Routing>();
  const [recipient, setRecipient] = useState("");
  const [nextOwner, setNextOwner] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const refresh = useCallback(async () => {
    const client = createPublicClient({
      transport: http(config.rpcUrl ?? `${location.origin}/rpc`),
      cacheTime: 0,
    });
    const read = (functionName: string) =>
      client.readContract({
        address: config.contract,
        abi: config.abi,
        functionName,
      });
    const [recipient, owner, pendingOwner] = await Promise.all([
      read("feeRecipient"),
      read("owner"),
      read("pendingOwner"),
    ]);
    return { recipient, owner, pendingOwner } as Routing;
  }, [config.contract, config.rpcUrl, config.abi]);
  useEffect(() => {
    if (!account) return;
    let cancelled = false;
    const check = () =>
      refresh()
        .then((value) => {
          if (!cancelled) {
            setRouting(value);
            setError("");
          }
        })
        .catch(() => {
          if (!cancelled) {
            setRouting(undefined);
            setError(
              "Fee settings could not be refreshed. Reload to try again.",
            );
          }
        });
    void check();
    const timer = setInterval(check, 15000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [account, refresh]);
  const same = (a?: string, b?: string) =>
    !!a && !!b && a.toLowerCase() === b.toLowerCase();
  const isOwner = same(account, routing?.owner);
  const canAccept = same(account, routing?.pendingOwner);
  if (!account || (!isOwner && !canAccept && !error)) return null;
  const valid = (value: string) =>
    isAddress(value) &&
    !same(value, zeroAddress) &&
    !same(value, config.contract);
  const send = async (name: string, args: unknown[], success: string) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await transact(name, args, undefined, config);
      setRouting(await refresh());
      setRecipient("");
      setNextOwner("");
      setNotice(success);
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  };
  const locked = disabled || busy;
  return (
    <details className="panel fee-settings">
      <summary>Fee settings · {short(config.contract)}</summary>
      <p>
        The claim fee stays fixed at {(config.feeBps ?? 0) / 100}%. Recipient
        changes apply to future claims; existing credits stay with the wallet
        that earned them.
      </p>
      {routing && (
        <dl className="fee-routing">
          <dt>Current fee recipient</dt>
          <dd>
            <code>{routing.recipient}</code>
          </dd>
          <dt>Owner</dt>
          <dd>
            <code>{routing.owner}</code>
          </dd>
        </dl>
      )}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {isOwner && (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (valid(recipient) && !locked)
                void send(
                  "setFeeRecipient",
                  [recipient],
                  "Fee recipient updated. New claims will credit the new wallet.",
                );
            }}
          >
            <label htmlFor={`${id}-recipient`}>New fee recipient</label>
            <div className="fee-setting-action">
              <input
                id={`${id}-recipient`}
                value={recipient}
                onChange={(e) => setRecipient(e.target.value.trim())}
                placeholder="0x…"
                autoComplete="off"
                spellCheck={false}
                disabled={locked}
              />
              <button
                className="button primary"
                disabled={
                  locked ||
                  !valid(recipient) ||
                  same(recipient, routing?.recipient)
                }
              >
                Update fee recipient
              </button>
            </div>
          </form>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (valid(nextOwner) && !locked)
                void send(
                  "transferOwnership",
                  [nextOwner],
                  "Transfer proposed. Connect the new owner wallet and accept ownership to finish.",
                );
            }}
          >
            <label htmlFor={`${id}-owner`}>New owner wallet</label>
            <div className="fee-setting-action">
              <input
                id={`${id}-owner`}
                value={nextOwner}
                onChange={(e) => setNextOwner(e.target.value.trim())}
                placeholder="0x…"
                autoComplete="off"
                spellCheck={false}
                disabled={locked}
              />
              <button
                className="button secondary"
                disabled={
                  locked || !valid(nextOwner) || same(nextOwner, routing?.owner)
                }
              >
                Propose owner transfer
              </button>
            </div>
            <small>
              The new owner must accept. Changing the fee recipient alone does
              not transfer ownership.
            </small>
          </form>
        </>
      )}
      {routing && !same(routing.pendingOwner, zeroAddress) && (
        <div className="fee-transfer">
          <p>
            Pending owner: <code>{routing.pendingOwner}</code>
          </p>
          {isOwner && (
            <button
              className="button secondary"
              disabled={locked}
              onClick={() =>
                void send(
                  "transferOwnership",
                  [zeroAddress],
                  "Pending owner transfer cancelled.",
                )
              }
            >
              Cancel owner transfer
            </button>
          )}
          {canAccept && (
            <button
              className="button primary"
              disabled={locked}
              onClick={() =>
                void send(
                  "acceptOwnership",
                  [],
                  "Ownership accepted. You can now manage future fee routing.",
                )
              }
            >
              Accept ownership
            </button>
          )}
        </div>
      )}
    </details>
  );
}
