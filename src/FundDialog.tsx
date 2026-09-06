import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  CheckCircle2,
  ExternalLink,
  GitBranch,
  Loader2,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { parseEther } from "viem";
import { Modal } from "./Modal";
import { github, saveRepo, type FundingCheck } from "./github";
import { friendly } from "./api";
import type { Bounty } from "./types";

export type FundingRequest = {
  check: FundingCheck;
  amount: bigint;
  days: number;
};
export function FundDialog({
  initialUrl = "",
  close,
  browse,
  symbol,
  account,
  connect,
  ready,
  wrongNetwork,
  switchNetwork,
  bounties,
  onFund,
}: {
  initialUrl?: string;
  close: () => void;
  browse: () => void;
  symbol: string;
  account?: string;
  connect: () => void;
  ready: boolean;
  wrongNetwork: boolean;
  switchNetwork: () => void;
  bounties: Bounty[];
  onFund: (request: FundingRequest) => Promise<void>;
}) {
  const [url, setUrl] = useState(initialUrl);
  const [check, setCheck] = useState<FundingCheck>();
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const [funding, setFunding] = useState(false);
  const [duplicateConsent, setDuplicateConsent] = useState(false);
  const generation = useRef(0);
  const locked = useRef(false);
  const busy = checking || funding;
  const duplicates = bounties.filter(
    (b) =>
      check &&
      b.repo.toLowerCase() === check.repo.name.toLowerCase() &&
      b.issue === check.issue.number &&
      b.status === 0,
  );
  async function validate(value = url) {
    const current = ++generation.current;
    setChecking(true);
    setError("");
    setCheck(undefined);
    setDuplicateConsent(false);
    try {
      const result = await github.inspectIssue(value);
      if (generation.current === current) setCheck(result);
    } catch (e) {
      if (generation.current === current) setError(friendly(e));
    } finally {
      if (generation.current === current) setChecking(false);
    }
  }
  useEffect(() => {
    if (initialUrl) void validate(initialUrl);
    return () => {
      generation.current++;
    };
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current) return;
    if (!check) {
      await validate();
      return;
    }
    const form = new FormData(event.currentTarget);
    locked.current = true;
    setFunding(true);
    setError("");
    try {
      const text = String(form.get("amount"));
      if (!/^\d+(\.\d{1,18})?$/.test(text))
        throw new Error("Enter a reward with at most 18 decimal places.");
      const amount = parseEther(text);
      if (amount <= 0n) throw new Error("Enter an amount greater than zero.");
      const days = Number(form.get("days"));
      if (![7, 14, 30, 90].includes(days))
        throw new Error("Choose a supported deadline.");
      if (duplicates.length && !duplicateConsent)
        throw new Error("Review the existing bounty before creating another.");
      const fresh = await github.inspectIssue(url, check);
      // Persistence is best effort; a full browser store must not prevent a payment.
      try {
        saveRepo(fresh.repo);
      } catch {
        /* repo remains discoverable through its bounty */
      }
      await onFund({ check: fresh, amount, days });
    } catch (e) {
      setError(friendly(e));
    } finally {
      locked.current = false;
      setFunding(false);
    }
  }
  return (
    <Modal
      title="Fund a GitHub issue"
      close={() => {
        if (!funding) close();
      }}
    >
      <p className="modal-intro">
        Check an open issue, review the reward, then confirm in your wallet.
      </p>
      <ol className="flow-steps" aria-label="Funding progress">
        <li className="active">1 · Choose issue</li>
        <li className={check ? "active" : ""}>2 · Review & fund</li>
      </ol>
      <form onSubmit={submit}>
        <label>
          GitHub issue URL
          <input
            name="issueUrl"
            type="url"
            required
            value={url}
            disabled={funding}
            placeholder="https://github.com/owner/repo/issues/42"
            onChange={(e) => {
              setUrl(e.target.value);
              setCheck(undefined);
              setError("");
              generation.current++;
              setChecking(false);
            }}
          />
        </label>
        <div className="inline-actions">
          <button
            type="button"
            className="button"
            disabled={busy}
            onClick={() => validate()}
          >
            {checking && <Loader2 size={16} className="spin" />}Check issue
          </button>
          <button
            type="button"
            className="text-button"
            disabled={busy}
            onClick={browse}
          >
            Browse repositories
          </button>
        </div>
        {check && (
          <>
            <div className="issue-review" role="status">
              <span className="eyebrow">
                <CheckCircle2 size={15} /> OPEN · PUBLIC REPOSITORY
              </span>
              <h3>{check.issue.title}</h3>
              <a href={check.issue.url} target="_blank" rel="noreferrer">
                {check.repo.name} #{check.issue.number}
                <ExternalLink size={13} />
              </a>
              <p>
                <GitBranch size={14} /> Merge into{" "}
                <strong>{check.repo.branch}</strong> · default branch
              </p>
            </div>
            <div className="form-grid">
              <label>
                Reward in {symbol}
                <input
                  name="amount"
                  required
                  inputMode="decimal"
                  pattern="[0-9]+(\.[0-9]{1,18})?"
                  placeholder={symbol === "xDAI" ? "0.01" : "0.05"}
                  disabled={funding}
                />
              </label>
              <label>
                Time to complete
                <select name="days" defaultValue="30" disabled={funding}>
                  <option value="7">7 days</option>
                  <option value="14">14 days</option>
                  <option value="30">30 days</option>
                  <option value="90">90 days</option>
                </select>
              </label>
            </div>
            <p className="field-note">
              GitHub closes linked issues when the PR merges into its default
              branch. This target is fixed when you fund.
            </p>
            {duplicates.length > 0 && (
              <div className="duplicate-note">
                <strong>
                  This issue already has {duplicates.length} unsettled{" "}
                  {duplicates.length === 1 ? "bounty" : "bounties"}.
                </strong>
                <p>
                  Each bounty needs its own matching PR title reference.
                  Creating another does not top up the existing reward.
                </p>
                <div className="inline-actions">
                  {duplicates.map((b) => (
                    <a
                      key={b.id}
                      href={`#bounty-${b.id}`}
                      onClick={(e) => {
                        if (funding) e.preventDefault();
                        else close();
                      }}
                    >
                      View bounty #{b.id}
                    </a>
                  ))}
                </div>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={duplicateConsent}
                    onChange={(e) => setDuplicateConsent(e.target.checked)}
                    disabled={funding}
                  />
                  Create a separate bounty for this issue
                </label>
              </div>
            )}
            <div className="terms">
              <ShieldCheck size={20} />
              <p>
                Your {symbol} stays in escrow until a valid claim or an eligible
                refund. A seven-day claim period follows the deadline. The
                reward, repository name and target branch cannot be edited after
                funding.
              </p>
            </div>
            <label className="checkbox-label">
              <input
                name="accept"
                type="checkbox"
                required
                disabled={funding}
              />
              I understand the escrow terms and will arrange for the required
              GitHub email notifications.
            </label>
          </>
        )}
        {error && (
          <div role="alert" className="alert error">
            {error}
          </div>
        )}
        {wrongNetwork && (
          <div className="alert error">
            Switch your wallet to the bounty network.
            <button type="button" onClick={switchNetwork}>
              Switch network
            </button>
          </div>
        )}
        <div className="modal-actions">
          <button
            type="button"
            className="button"
            disabled={funding}
            onClick={close}
          >
            Cancel
          </button>
          {!check ? (
            <button className="button primary" disabled={busy}>
              {checking ? "Checking GitHub…" : "Review issue"}
            </button>
          ) : account ? (
            <button
              className="button primary"
              disabled={
                busy ||
                wrongNetwork ||
                !ready ||
                (!!duplicates.length && !duplicateConsent)
              }
            >
              {funding && <Loader2 size={17} className="spin" />}
              {funding ? "Checking & funding…" : "Fund bounty"}
            </button>
          ) : (
            <button type="button" className="button primary" onClick={connect}>
              <Wallet size={17} />
              Connect wallet
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}
