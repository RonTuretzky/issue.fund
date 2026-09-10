import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  GitPullRequest,
  Loader2,
  XCircle,
} from "lucide-react";
import {
  bodyFor,
  checkPull,
  compareUrl,
  createPrClient,
  titleFor,
  validateWallet,
  type PullCheck,
  type PrTemplate,
} from "../shared/pr.mjs";
import { Modal } from "./Modal";
import { friendly } from "./api";
import { claimQuote } from "./deployments";
import { formatEther, type Address } from "viem";
import {
  automationMessage,
  automationRequest,
  type AutomationReadiness,
} from "./automation";
import type { Bounty, Config } from "./types";

function CopyText({ label, value }: { label: string; value: string }) {
  const fieldId = useId();
  const [message, setMessage] = useState("");
  useEffect(() => setMessage(""), [value]);
  return (
    <div className="pr-copy-field">
      <label htmlFor={fieldId}>{label}</label>
      <textarea
        id={fieldId}
        readOnly
        value={value}
        rows={label === "PR title" ? 3 : 5}
        onFocus={(e) => e.currentTarget.select()}
      />
      <button
        type="button"
        className="text-button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setMessage("Copied");
          } catch {
            setMessage("Select the text above and copy it manually.");
          }
        }}
      >
        <Copy size={16} />
        Copy {label.startsWith("PR ") ? label : label.toLowerCase()}
      </button>
      <span role="status">{message}</span>
    </div>
  );
}

type Result = {
  key: string;
  title: string;
  body: string;
  url?: string | null;
  compareUrl?: string;
  tooLong?: boolean;
  checks?: PullCheck[];
  checkedAt: number;
  collection?: AutomationReadiness;
};

export function PreparePr({
  bounty,
  account,
  config,
  connect,
}: {
  bounty: Bounty;
  account?: Address;
  config: Config;
  connect: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="button primary"
        onClick={() => setOpen(true)}
      >
        <GitPullRequest size={18} />
        Prepare PR
      </button>
      {open && (
        <PrepareDialog
          bounty={bounty}
          account={account}
          config={config}
          connect={connect}
          close={() => setOpen(false)}
        />
      )}
    </>
  );
}

function PrepareDialog({
  bounty,
  account,
  config,
  connect,
  close,
}: {
  bounty: Bounty;
  account?: Address;
  config: Config;
  connect: () => void;
  close: () => void;
}) {
  const client = useMemo(() => createPrClient(), []);
  const sequence = useRef(0);
  const branchId = useId();
  const templateId = useId();
  const bodyId = useId();
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [sourceRepo, setSourceRepo] = useState(bounty.repo);
  const [branch, setBranch] = useState("");
  const [description, setDescription] = useState("");
  const [body, setBody] = useState("");
  const [prUrl, setPrUrl] = useState("");
  const [branches, setBranches] = useState<{
    repo: string;
    names: string[];
    more: boolean;
  }>();
  const [branchMessage, setBranchMessage] = useState("");
  const [templates, setTemplates] = useState<PrTemplate[]>();
  const [templatePath, setTemplatePath] = useState("");
  const [templateMessage, setTemplateMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result>();
  const [contextMessage, setContextMessage] = useState(
    "Checking the funded issue…",
  );
  const [version, setVersion] = useState(0);
  const [tick, setTick] = useState(Date.now());
  const key = JSON.stringify([
    account,
    mode,
    sourceRepo,
    branch,
    description,
    body,
    prUrl,
    version,
  ]);
  // Hiding by key is synchronous; a wallet change cannot leave an old payout link active.
  const current =
    result?.key === key &&
    tick - result.checkedAt < 5 * 60 * 1000 &&
    (mode !== "new" || tick / 1000 <= bounty.deadline)
      ? result
      : undefined;
  const invalidate = () => {
    sequence.current++;
    setVersion((v) => v + 1);
    setResult(undefined);
    setError("");
    setBusy(false);
  };
  useEffect(() => {
    invalidate();
  }, [account]);
  useEffect(() => {
    let active = true;
    client
      .context(bounty)
      .then(({ issue }) => {
        if (active) setContextMessage(`Issue #${issue.number}: ${issue.title}`);
      })
      .catch((e) => {
        if (active) setContextMessage(friendly(e));
      });
    client
      .templates(bounty)
      .then((list) => {
        if (active) {
          setTemplates(list);
          setTemplateMessage(
            list.length
              ? "Insert the project’s template below, or paste your own checklist."
              : "No repository PR template found. You can paste a project checklist below.",
          );
        }
      })
      .catch(() => {
        if (active)
          setTemplateMessage(
            "Templates could not be loaded. Paste the repository’s checklist below, or open its files on GitHub.",
          );
      });
    const timer = setInterval(() => setTick(Date.now()), 15000);
    return () => {
      active = false;
      sequence.current++;
      clearInterval(timer);
    };
  }, [bounty.bountyRef, client]);
  async function loadBranches() {
    const requested = sourceRepo;
    setBranchMessage("Loading branches…");
    try {
      const data = await client.branches(requested);
      setBranches({ repo: requested, ...data });
      setBranchMessage(
        data.more
          ? "Showing the first 100 branches. You can also type any pushed branch name."
          : "Choose a branch below, or type its name.",
      );
    } catch (e) {
      setBranchMessage(friendly(e));
    }
  }
  async function insertTemplate() {
    const id = ++sequence.current;
    setBusy(true);
    setError("");
    setResult(undefined);
    try {
      const text = await client.template(bounty, templatePath);
      if (sequence.current === id) {
        setBody((previous) =>
          [previous.trim(), text.trim()].filter(Boolean).join("\n\n"),
        );
        setVersion((v) => v + 1);
      }
    } catch (e) {
      if (sequence.current === id) setError(friendly(e));
    } finally {
      if (sequence.current === id) setBusy(false);
    }
  }
  async function collection() {
    if (!config.automationUrl) return undefined;
    try {
      return await automationRequest<AutomationReadiness>(
        config.automationUrl,
        `/v1/issues/status?url=${encodeURIComponent(`https://github.com/${bounty.repo}/issues/${bounty.issue}`)}`,
      );
    } catch (e) {
      return {
        state: "attention" as const,
        code: (e as { code?: string }).code ?? "service_unavailable",
      };
    }
  }
  async function prepare() {
    const id = ++sequence.current;
    setBusy(true);
    setError("");
    setResult(undefined);
    try {
      validateWallet(account, bounty);
      if (mode === "new") {
        if (bounty.status !== 0 || Date.now() / 1000 > bounty.deadline)
          throw Error(
            "The completion deadline has passed or this bounty is settled. A new PR cannot earn it.",
          );
        const title = titleFor(bounty, account, description),
          preparedBody = bodyFor(bounty, body);
        await client.context(bounty);
        const [source, collected] = await Promise.all([
          client.source(bounty, sourceRepo, branch),
          collection(),
        ]);
        if (sequence.current === id)
          setResult({
            key,
            title,
            body: preparedBody,
            ...compareUrl(
              bounty,
              source.repo,
              source.branch,
              title,
              preparedBody,
            ),
            collection: collected,
            checkedAt: Date.now(),
          });
      } else {
        const [pr, collected] = await Promise.all([
          client.pull(prUrl),
          collection(),
        ]);
        const checks = checkPull(bounty, account, pr);
        try {
          await client.context(bounty);
          checks.push({
            id: "open-issue",
            ok: true,
            label: "Funded issue is open",
            detail: "The issue remains open for this PR to close.",
          });
        } catch (e) {
          checks.push({
            id: "open-issue",
            ok: false,
            label: "Funded issue and repository",
            detail: friendly(e),
          });
        }
        const fixDescription =
          pr.title
            .replace(/\[(?:wallet|bounty)\b[^\]]*\]/gi, "")
            .replace(/[^\x20-\x7e]/g, "")
            .trim()
            .slice(0, 100) || "Describe your fix";
        if (sequence.current === id)
          setResult({
            key,
            title: titleFor(bounty, account, fixDescription),
            body: bodyFor(bounty, pr.body ?? ""),
            url: pr.html_url,
            checks,
            collection: collected,
            checkedAt: Date.now(),
          });
      }
    } catch (e) {
      if (sequence.current === id) setError(friendly(e));
    } finally {
      if (sequence.current === id) setBusy(false);
    }
  }
  return (
    <Modal title="Prepare your pull request" close={close}>
      <div className="pr-preparation">
        <p className="pr-context">
          {contextMessage}
          <br />
          Merge target:{" "}
          <strong>
            {bounty.repo} · {bounty.branch}
          </strong>
        </p>
        <div className="pr-wallet">
          <span>Payout wallet</span>
          {account ? (
            <code>{account}</code>
          ) : (
            <p>Connect the wallet that should receive this reward.</p>
          )}
          <strong>
            {formatEther(
              claimQuote(BigInt(bounty.amount), config.feeBps ?? 0).net,
            )}{" "}
            {config.currency ?? "xDAI"} after the claim fee
          </strong>
          <button type="button" className="text-button" onClick={connect}>
            {account ? "Change wallet" : "Connect payout wallet"}
          </button>
        </div>
        <div className="pr-mode" role="group" aria-label="PR preparation mode">
          {(
            [
              ["new", "New PR"],
              ["existing", "Check existing PR"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => {
                invalidate();
                setMode(value);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void prepare();
          }}
        >
          {mode === "new" ? (
            <>
              <label>
                Describe your fix
                <input
                  value={description}
                  maxLength={100}
                  placeholder="Fix empty input handling"
                  required
                  onChange={(e) => {
                    invalidate();
                    setDescription(e.target.value);
                  }}
                />
              </label>
              <label>
                Source repository
                <input
                  value={sourceRepo}
                  required
                  placeholder="your-account/repository"
                  onChange={(e) => {
                    invalidate();
                    setSourceRepo(e.target.value);
                    setBranch("");
                    setBranchMessage("");
                  }}
                />
              </label>
              <p className="pr-hint">
                Use this repository or your public fork. Push your changes to
                GitHub first.
              </p>
              <button
                type="button"
                className="text-button"
                onClick={() => void loadBranches()}
              >
                Load branches
              </button>
              {branchMessage && (
                <p role="status" className="pr-hint">
                  {branchMessage}
                </p>
              )}
              <label>
                Source branch
                <input
                  list={branchId}
                  value={branch}
                  required
                  placeholder="fix/empty-input"
                  onChange={(e) => {
                    invalidate();
                    setBranch(e.target.value);
                  }}
                />
              </label>
              <datalist id={branchId}>
                {branches?.repo === sourceRepo &&
                  branches.names.map((name) => (
                    <option key={name} value={name} />
                  ))}
              </datalist>
              <label htmlFor={bodyId}>
                Description &amp; repository checklist
              </label>
              <textarea
                id={bodyId}
                value={body}
                rows={4}
                maxLength={20000}
                placeholder="Describe the change, tests, and any project checklist. The issue-closing line is added for you."
                onChange={(e) => {
                  invalidate();
                  setBody(e.target.value);
                }}
              />
              <p className="pr-hint">
                {templateMessage || "Looking for repository PR templates…"}{" "}
                Prefilling replaces GitHub’s default description.
              </p>
              {!!templates?.length && (
                <div className="pr-templates">
                  <label htmlFor={templateId}>Repository PR template</label>
                  <select
                    id={templateId}
                    value={templatePath}
                    onChange={(e) => {
                      sequence.current++;
                      setBusy(false);
                      setTemplatePath(e.target.value);
                    }}
                  >
                    <option value="">Choose a template</option>
                    {templates.map((t) => (
                      <option key={t.path} value={t.path}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="text-button"
                    disabled={!templatePath || busy}
                    onClick={() => void insertTemplate()}
                  >
                    Insert template
                  </button>
                </div>
              )}
              <a
                className="text-button"
                href={`https://github.com/${bounty.repo}/tree/${encodeURIComponent(bounty.branch)}`}
                target="_blank"
                rel="noreferrer"
              >
                Browse repository files <ExternalLink size={14} />
              </a>
            </>
          ) : (
            <label>
              GitHub PR URL
              <input
                type="url"
                value={prUrl}
                required
                placeholder={`https://github.com/${bounty.repo}/pull/123`}
                onChange={(e) => {
                  invalidate();
                  setPrUrl(e.target.value);
                }}
              />
            </label>
          )}
          {error && (
            <p role="alert" className="error-box">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <button type="button" className="button" onClick={close}>
              Cancel
            </button>
            <button
              type="submit"
              className="button primary"
              disabled={!account || busy}
            >
              {busy ? (
                <>
                  <Loader2 size={16} className="spin" />
                  Checking…
                </>
              ) : mode === "new" ? (
                "Prepare GitHub PR"
              ) : (
                "Check PR"
              )}
            </button>
          </div>
        </form>
        {current && (
          <section className="pr-result" aria-label="PR preparation result">
            <h3>
              {current.checks
                ? current.checks.find((c) => c.id === "state")?.ok === false
                  ? "This PR is already merged or closed"
                  : current.checks.every((c) => c.ok)
                    ? "PR details match"
                    : "Update the PR before merge"
                : "Your PR is prepared"}
            </h3>
            {current.checks ? (
              <ul className="pr-checks">
                {current.checks.map((check) => (
                  <li key={check.id}>
                    {check.ok ? (
                      <CheckCircle2 size={18} />
                    ) : (
                      <XCircle size={18} />
                    )}
                    <div>
                      <strong>
                        {check.label}:{" "}
                        {check.ok ? "matches" : "needs attention"}
                      </strong>
                      {!check.ok && <p>{check.detail}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>
                Review the wallet and text below, then open GitHub to create the
                PR.
              </p>
            )}
            <div className="pr-collection" role="status">
              <strong>
                {current.collection?.state === "ready"
                  ? "Collector: notifications ready"
                  : current.collection
                    ? "Collector needs attention"
                    : "Manual email collection"}
              </strong>
              <p>
                {current.collection?.state === "ready"
                  ? "The server will collect eligible event emails and submit the claim. You still withdraw after credit."
                  : current.collection
                    ? `${automationMessage(current.collection.code)} Arrange delivery before merge, or use manual receipt collection.`
                    : "Subscribe to the issue and PR before merge and keep both original event emails."}
              </p>
            </div>
            {current.checks?.find((c) => c.id === "state")?.ok === false && (
              <p className="pr-hint">
                Check the bounty’s claim status. Editing a title after merge
                cannot change the wallet or reference authenticated in the
                original email.
              </p>
            )}
            {current.checks?.find((c) => c.id === "state")?.ok !== false &&
              !current.checks?.every((c) => c.ok) && (
                <>
                  <CopyText label="PR title" value={current.title} />
                  <CopyText label="PR description" value={current.body} />
                </>
              )}
            {current.tooLong && (
              <p className="pr-hint">
                The template is too long for a reliable prefilled link. Open the
                comparison below, then use Copy PR title and Copy PR
                description. Your text has been kept in full.
              </p>
            )}
            <a
              className="button primary"
              href={current.url ?? current.compareUrl}
              target="_blank"
              rel="noreferrer"
            >
              {current.checks
                ? "Review PR on GitHub"
                : current.tooLong
                  ? "Open comparison on GitHub"
                  : "Open prefilled PR on GitHub"}
              <ExternalLink size={16} />
            </a>
            <p className="pr-hint">
              Checked {new Date(current.checkedAt).toLocaleTimeString()}.
              Confirm the linked issue and repository checklist on GitHub. This
              checks preparation, not code quality or future email delivery.
              Recheck after edits and before merge.
            </p>
            {mode === "new" && (
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  invalidate();
                  setMode("existing");
                }}
              >
                Created it? Check your PR
              </button>
            )}
          </section>
        )}
        {result?.key === key && !current && (
          <p role="status">
            This review expired. Check again before continuing.
          </p>
        )}
        <details className="pr-manual">
          <summary>Copy the required text manually</summary>
          <p>
            Use this fallback if GitHub lookups are unavailable. Confirm the
            source branch and issue on GitHub before merging.
          </p>
          {account ? (
            <>
              <CopyText
                label="PR title"
                value={`[bounty ${bounty.bountyRef}] [wallet ${account}] Describe your fix`}
              />
              <CopyText
                label="Closing line"
                value={`Closes #${bounty.issue}`}
              />
            </>
          ) : (
            <p>Connect your payout wallet to fill the title.</p>
          )}
        </details>
      </div>
    </Modal>
  );
}
