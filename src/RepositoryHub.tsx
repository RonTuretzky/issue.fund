import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  GitBranch,
  Github,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import {
  github,
  parseRepo,
  removeRepo,
  saveRepo,
  savedRepos,
  type Issue,
  type IssuePage,
  type Repository,
} from "./github";
import { Modal } from "./Modal";
import { friendly } from "./api";
import type { Bounty } from "./types";

export function RepositoryHub({
  bounties,
  fund,
  viewBounty,
  back,
}: {
  bounties: Bounty[];
  fund: (url?: string) => void;
  viewBounty: (b: Bounty) => void;
  back: () => void;
}) {
  const [saved, setSaved] = useState(savedRepos);
  const [repo, setRepo] = useState<Repository>();
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [issueLoading, setIssueLoading] = useState(false);
  const [issueError, setIssueError] = useState("");
  const [page, setPage] = useState(1);
  const [state, setState] = useState("open");
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [revision, setRevision] = useState(0);
  const [issues, setIssues] = useState<IssuePage>();
  const [detail, setDetail] = useState<Issue>();
  const [createOpen, setCreateOpen] = useState(false);
  const generation = useRef(0);
  useEffect(() => {
    const update = () => setSaved(savedRepos());
    window.addEventListener("mergebounty:repositories", update);
    window.addEventListener("storage", update);
    return () => {
      generation.current++;
      window.removeEventListener("mergebounty:repositories", update);
      window.removeEventListener("storage", update);
    };
  }, []);
  async function openRepo(name: string) {
    const current = ++generation.current;
    setLoading(true);
    setError("");
    setNotice("");
    setRepo(undefined);
    setIssues(undefined);
    try {
      const result = await github.getRepo(name);
      if (current !== generation.current) return;
      const previous = savedRepos().find(
        (r) => r.name.toLowerCase() === parseRepo(name).toLowerCase(),
      );
      if (previous && previous.id !== result.id)
        throw new Error(
          "A different repository now uses this name. Remove the saved entry, then add the repository again after reviewing it on GitHub.",
        );
      setRepo(result);
      setInput("");
      setPage(1);
      setState("open");
      setQuery("");
      setQueryInput("");
      setDetail(undefined);
      try {
        saveRepo(result);
      } catch {
        setNotice(
          "Opened successfully. Your browser could not save this repository for later.",
        );
      }
    } catch (e) {
      if (current === generation.current) setError(friendly(e));
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }
  useEffect(() => {
    if (!repo) return;
    let active = true;
    setIssueLoading(true);
    setIssueError("");
    setIssues(undefined);
    github
      .listIssues(repo, { state, query, page })
      .then((result) => {
        if (active) setIssues(result);
      })
      .catch((e) => {
        if (active) setIssueError(friendly(e));
      })
      .finally(() => {
        if (active) setIssueLoading(false);
      });
    return () => {
      active = false;
    };
  }, [repo, state, query, page, revision]);
  const known = [...new Set(bounties.map((b) => b.repo))].filter(
    (name) => !saved.some((r) => r.name.toLowerCase() === name.toLowerCase()),
  );
  async function add(event: FormEvent) {
    event.preventDefault();
    await openRepo(input);
  }
  const resetIssues = () => {
    setPage(1);
    setState("open");
    setQuery("");
    setQueryInput("");
    setRevision((n) => n + 1);
  };
  return (
    <section className="repositories">
      <button className="back-link" onClick={back}>
        <ArrowLeft size={15} />
        All bounties
      </button>
      <div className="repo-heading">
        <div>
          <div className="eyebrow">START WITH A PUBLIC REPOSITORY</div>
          <h1>{repo ? repo.name : "Good projects. Open possibilities."}</h1>
          <p>
            {repo
              ? repo.description ||
                "Choose an open issue and give the next contribution a reward."
              : "Add a repository, choose an issue, and fund the work you want to see."}
          </p>
        </div>
        <Github size={48} className="repo-heading-icon" />
      </div>
      <form className="repo-add" onSubmit={add}>
        <label htmlFor="repo-name">Public GitHub repository</label>
        <div className="repo-input-row">
          <input
            id="repo-name"
            required
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="owner/repo or a GitHub repository URL"
          />
          <button className="button primary" disabled={loading}>
            {loading ? (
              <Loader2 size={17} className="spin" />
            ) : (
              <Plus size={17} />
            )}
            Add repository
          </button>
        </div>
        <p>
          Public repositories only. No GitHub connection required. Your saved
          list stays in this browser.
        </p>
      </form>
      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="alert success" role="status">
          {notice}
        </div>
      )}
      {loading && (
        <div className="empty" role="status">
          <Loader2 className="spin" />
          <h3>Checking the repository on GitHub…</h3>
        </div>
      )}
      {!loading && !repo && (
        <>
          <div className="section-heading">
            <div>
              <h2>Your repositories</h2>
              <p>Saved here for your next contribution.</p>
            </div>
            <button className="text-button" onClick={() => fund()}>
              Already have an issue URL?
              <ArrowRight size={16} />
            </button>
          </div>
          {saved.length ? (
            <div className="repo-grid">
              {saved.map((r) => (
                <article className="repo-card" key={r.id}>
                  <button
                    className="repo-card-main"
                    onClick={() => openRepo(r.name)}
                  >
                    <Github size={22} />
                    <h3>{r.name}</h3>
                    <span>
                      Browse issues
                      <ArrowRight size={15} />
                    </span>
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`Remove ${r.name} from saved repositories`}
                    onClick={() => {
                      try {
                        removeRepo(r.id);
                      } catch {
                        setError(
                          "Your browser could not update the saved list.",
                        );
                      }
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty">
              <GitBranch size={28} />
              <h3>Add your first repository</h3>
              <p>
                Paste its name above. There is no registration fee or ownership
                claim.
              </p>
            </div>
          )}
          {known.length > 0 && (
            <div className="known-repos">
              <h2>Repositories with bounties</h2>
              <p>
                Discovered from the escrow. Each repository is checked on GitHub
                before it can be added.
              </p>
              <div className="inline-actions">
                {known.map((name) => (
                  <button
                    className="button"
                    key={name}
                    onClick={() => openRepo(name)}
                  >
                    {name}
                    <ArrowRight size={15} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
      {repo && !loading && (
        <>
          <div className="repo-toolbar">
            <button
              className="text-button"
              onClick={() => {
                setRepo(undefined);
                setError("");
              }}
            >
              All repositories
            </button>
            <span>
              <GitBranch size={15} />
              {repo.branch} · default branch
            </span>
            <a href={repo.url} target="_blank" rel="noreferrer">
              View on GitHub
              <ExternalLink size={14} />
            </a>
          </div>
          <div className="section-heading">
            <div>
              <h2>Choose an issue</h2>
              <p>The reward is created on-chain when you fund it.</p>
            </div>
            <div className="inline-actions">
              <button className="button" onClick={() => fund()}>
                Import issue URL
              </button>
              <button
                className="button primary"
                onClick={() => setCreateOpen(true)}
              >
                <Plus size={16} />
                Create issue
              </button>
            </div>
          </div>
          <div className="issue-toolbar">
            <div className="tabs" aria-label="Issue status">
              {["open", "closed", "all"].map((s) => (
                <button
                  key={s}
                  className={state === s ? "active" : ""}
                  onClick={() => {
                    setState(s);
                    setPage(1);
                  }}
                >
                  {s[0].toUpperCase() + s.slice(1)} issues
                </button>
              ))}
            </div>
            <form
              className="issue-search"
              onSubmit={(e) => {
                e.preventDefault();
                setQuery(queryInput);
                setPage(1);
              }}
            >
              <div className="search">
                <Search size={16} />
                <input
                  aria-label="Search GitHub issues"
                  maxLength={180}
                  value={queryInput}
                  onChange={(e) => setQueryInput(e.target.value)}
                  placeholder="Search all issues…"
                />
              </div>
              <button className="button" disabled={issueLoading}>
                Search
              </button>
            </form>
            <button
              className="icon-button"
              aria-label="Refresh issues"
              disabled={issueLoading}
              onClick={() => setRevision((n) => n + 1)}
            >
              <RefreshCw size={18} />
            </button>
          </div>
          {query && (
            <p className="field-note">
              Results for “{query}”{" "}
              <button
                className="text-button"
                onClick={() => {
                  setQuery("");
                  setQueryInput("");
                  setPage(1);
                }}
              >
                Clear search
              </button>
            </p>
          )}
          {issueError && (
            <div className="alert error" role="alert">
              {issueError}
              <button onClick={() => setRevision((n) => n + 1)}>Retry</button>
            </div>
          )}
          {issueLoading ? (
            <div className="empty" role="status">
              <Loader2 className="spin" />
              <h3>Loading GitHub issues…</h3>
            </div>
          ) : (
            issues && (
              <>
                {issues.incomplete && (
                  <div className="alert" role="status">
                    GitHub returned partial search results. Refresh to try
                    again.
                  </div>
                )}
                {issues.items.length ? (
                  <div className="issue-list">
                    {issues.items.map((issue) => {
                      const existing = bounties.filter(
                        (b) =>
                          b.repo.toLowerCase() === repo.name.toLowerCase() &&
                          b.issue === issue.number,
                      );
                      return (
                        <article className="issue-row" key={issue.id}>
                          <div className="issue-row-content">
                            <div className="repo-name">
                              <span
                                className={`pill ${issue.state === "closed" ? "paid" : ""}`}
                              >
                                {issue.state === "open" ? "Open" : "Closed"}
                              </span>
                              <span>#{issue.number}</span>
                            </div>
                            <button
                              className="issue-title"
                              onClick={() => setDetail(issue)}
                            >
                              {issue.title}
                            </button>
                            <div className="issue-labels">
                              {issue.labels.slice(0, 5).map((label) => (
                                <span key={label}>{label}</span>
                              ))}
                            </div>
                            {existing.length > 0 && (
                              <div className="inline-actions">
                                {existing.map((b) => (
                                  <button
                                    className="text-button"
                                    key={b.id}
                                    onClick={() => viewBounty(b)}
                                  >
                                    View bounty #{b.id}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="issue-row-actions">
                            <a
                              href={issue.url}
                              target="_blank"
                              rel="noreferrer"
                              aria-label={`Open issue ${issue.number} on GitHub`}
                            >
                              <ExternalLink size={16} />
                            </a>
                            <button
                              className="button"
                              disabled={issue.state !== "open"}
                              onClick={() => fund(issue.url)}
                            >
                              {issue.state === "open"
                                ? "Fund issue"
                                : "Issue closed"}
                              <ArrowRight size={15} />
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="empty">
                    <Search size={26} />
                    <h3>
                      {query ? "No matching issues" : "No issues on this page"}
                    </h3>
                    <p>
                      {issues.more
                        ? "GitHub also counts pull requests in these pages. Continue to see more issues."
                        : "Refresh after creating an issue, or try another filter."}
                    </p>
                    <button className="button" onClick={resetIssues}>
                      Show open issues
                    </button>
                  </div>
                )}
                <div className="pagination">
                  <button
                    className="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </button>
                  <span>
                    Page {page}
                    {issues.limited
                      ? " · GitHub limits search to 1,000 results"
                      : ""}
                  </span>
                  <button
                    className="button"
                    disabled={!issues.more}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </button>
                </div>
              </>
            )
          )}
        </>
      )}
      {detail && repo && (
        <Modal
          title={`Issue #${detail.number}`}
          close={() => setDetail(undefined)}
        >
          <h3>{detail.title}</h3>
          <p className="field-note">
            {repo.name} · {detail.state}
          </p>
          <div className="issue-body">
            {detail.body || "No description provided."}
          </div>
          <div className="modal-actions">
            <a
              className="button"
              href={detail.url}
              target="_blank"
              rel="noreferrer"
            >
              View on GitHub
              <ExternalLink size={15} />
            </a>
            <button
              className="button primary"
              disabled={detail.state !== "open"}
              onClick={() => {
                setDetail(undefined);
                fund(detail.url);
              }}
            >
              Fund issue
            </button>
          </div>
        </Modal>
      )}
      {createOpen && repo && (
        <CreateIssue
          repo={repo}
          close={() => setCreateOpen(false)}
          done={() => {
            setCreateOpen(false);
            resetIssues();
          }}
          fund={(url) => {
            setCreateOpen(false);
            fund(url);
          }}
        />
      )}
    </section>
  );
}

function CreateIssue({
  repo,
  close,
  done,
  fund,
}: {
  repo: Repository;
  close: () => void;
  done: () => void;
  fund: (url?: string) => void;
}) {
  return (
    <Modal title="Create an issue on GitHub" close={close}>
      <p className="modal-intro">
        Create the issue in <strong>{repo.name}</strong> using your GitHub
        account. GitHub handles its templates and permissions.
      </p>
      <ol className="create-instructions">
        <li>Open GitHub and submit your issue.</li>
        <li>
          Return here and refresh the issue list, or paste the new issue URL.
        </li>
        <li>Review the reward and fund it with your wallet.</li>
      </ol>
      <a
        className="button primary full-width"
        href={`${repo.url}/issues/new/choose`}
        target="_blank"
        rel="noreferrer"
      >
        Open GitHub issue form
        <ExternalLink size={16} />
      </a>
      <p className="field-note">
        Nothing is created until you submit on GitHub. MergeBounty never asks
        for a GitHub token.
      </p>
      <div className="modal-actions">
        <button className="button" onClick={() => fund()}>
          Paste new issue URL
        </button>
        <button className="button primary" onClick={done}>
          <CheckCircle2 size={16} />
          Refresh issue list
        </button>
      </div>
    </Modal>
  );
}
