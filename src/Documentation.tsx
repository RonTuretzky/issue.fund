import { Fragment, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  Copy,
  List,
  ShieldCheck,
  Terminal,
  Users,
  Wrench,
} from "lucide-react";
import { groups, pages, type DocSection } from "../shared/documentation.mjs";
import deployment from "../public/deployment.gnosis.json";
import "./documentation.css";

export function docsPath(hash: string): string | null {
  if (hash === "#docs" || hash === "#docs/") return "";
  return hash.startsWith("#docs/") ? hash.slice(6).replace(/\/$/, "") : null;
}
function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split(/(`[^`]+`|\[[^\]]+\]\([^)]+\))/g).map((part, i) => {
        if (part.startsWith("`") && part.endsWith("`"))
          return <code key={i}>{part.slice(1, -1)}</code>;
        const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (link)
          return (
            <a
              key={i}
              href={link[2]}
              {...(link[2].startsWith("https://")
                ? { target: "_blank", rel: "noreferrer" }
                : {})}
            >
              {link[1]}
            </a>
          );
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}
function CodeBlock({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <div className="docs-code">
      <div className="docs-code-bar">
        <span>Example</span>
        <button
          type="button"
          aria-label="Copy example"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              setError(false);
            } catch {
              setError(true);
            }
          }}
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}{" "}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre>
        <code>{value}</code>
      </pre>
      {error && (
        <p role="status">Select the example text and copy it manually.</p>
      )}
    </div>
  );
}
function Section({ section, index }: { section: DocSection; index: number }) {
  const heading = `doc-section-${index}`;
  return (
    <section className="docs-section" aria-labelledby={heading}>
      <h2 id={heading}>{section.title}</h2>
      {section.paragraphs?.map((p, i) => (
        <p key={i}>
          <Inline text={p} />
        </p>
      ))}
      {section.steps && (
        <ol className="docs-steps">
          {section.steps.map((step, i) => (
            <li key={i}>
              <span aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <Inline text={step} />
              </div>
            </li>
          ))}
        </ol>
      )}
      {section.bullets && (
        <ul className="docs-bullets">
          {section.bullets.map((p, i) => (
            <li key={i}>
              <Inline text={p} />
            </li>
          ))}
        </ul>
      )}
      {section.table && (
        <div className="docs-table-wrap">
          <table>
            <thead>
              <tr>
                {section.table.headers.map((h) => (
                  <th key={h} scope="col">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.table.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) =>
                    j === 0 ? (
                      <th scope="row" key={j}>
                        <Inline text={cell} />
                      </th>
                    ) : (
                      <td key={j}>
                        <Inline text={cell} />
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {section.code && <CodeBlock value={section.code} />}
      {section.notice && (
        <p className="docs-note">
          <ShieldCheck size={18} />
          <span>{section.notice}</span>
        </p>
      )}
      {section.deployment && (
        <dl className="docs-contracts">
          <div>
            <dt>Network</dt>
            <dd>Gnosis · chain 100 · xDAI</dd>
          </div>
          {(
            [
              ["Escrow", deployment.contract],
              ["RSA/DKIM verifier", deployment.verifier],
            ] as const
          ).map(([label, address]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>
                <a
                  href={`${deployment.explorerUrl}/address/${address}?tab=contract`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <code>{address}</code>
                  <ArrowUpRight size={14} />
                </a>
              </dd>
            </div>
          ))}
        </dl>
      )}
      {section.links && (
        <ul className="docs-resources">
          {section.links.map((link) => (
            <li key={link.url}>
              <a
                href={link.url}
                {...(link.url.startsWith("https://")
                  ? { target: "_blank", rel: "noreferrer" }
                  : {})}
              >
                {link.label}
                {link.url.startsWith("https://") ? (
                  <ArrowUpRight size={14} />
                ) : (
                  <ArrowRight size={14} />
                )}
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
export function Documentation({ path }: { path: string }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const title = useRef<HTMLHeadingElement>(null);
  const page = pages.find((p) => p.id === path);
  const group = groups.find((g) => g.id === page?.group);
  const index = pages.findIndex((p) => p.id === path);
  const previous = pages[index - 1],
    next = pages[index + 1];
  useEffect(() => {
    setMenuOpen(false);
    document.title = `${path ? (page?.title ?? "Page not found") : "Documentation"} · issue.fund`;
    title.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [path, page?.title]);
  return (
    <div className="docs-layout">
      <aside className="docs-sidebar">
        <a className="docs-home" href="#docs">
          <BookOpen size={19} /> Documentation
        </a>
        <button
          className="docs-menu-toggle"
          aria-expanded={menuOpen}
          aria-controls="docs-page-list"
          onClick={() => setMenuOpen((x) => !x)}
        >
          <List size={18} />
          {menuOpen ? "Hide page list" : "All documentation pages"}
        </button>
        <nav
          id="docs-page-list"
          className={menuOpen ? "docs-nav is-open" : "docs-nav"}
          aria-label="Documentation pages"
        >
          <a
            className={!path ? "active" : ""}
            href="#docs"
            aria-current={!path ? "page" : undefined}
          >
            All guides
          </a>
          {groups.map((g) => (
            <div className="docs-nav-group" key={g.id}>
              <h2>{g.title}</h2>
              {pages
                .filter((p) => p.group === g.id)
                .map((p) => (
                  <a
                    key={p.id}
                    className={path === p.id ? "active" : ""}
                    aria-current={path === p.id ? "page" : undefined}
                    href={`#docs/${p.id}`}
                  >
                    {p.title}
                  </a>
                ))}
            </div>
          ))}
        </nav>
      </aside>
      <div className="docs-content">
        {!path ? (
          <>
            <header className="docs-intro">
              <span className="eyebrow">THE BOUNTY HANDBOOK</span>
              <h1 ref={title} tabIndex={-1}>
                A guide for every step.
              </h1>
              <p>
                Fund useful work. Make a contribution. Turn a verified merge
                into a reward.
              </p>
            </header>
            <div className="docs-paths">
              <a href="#docs/maintainers/getting-started">
                <Wrench size={25} />
                <span className="docs-path-label">
                  01 · MAINTAINERS & FUNDERS
                </span>
                <h2>Bring work to your project.</h2>
                <p>
                  Fund an issue, prepare automatic collection, and review the PR
                  that earns the reward.
                </p>
                <span className="docs-path-action">
                  Start the maintainer guide <ArrowRight size={17} />
                </span>
              </a>
              <a href="#docs/contributors/getting-started">
                <Users size={25} />
                <span className="docs-path-label">
                  02 · CONTRIBUTORS & USERS
                </span>
                <h2>Make your next contribution.</h2>
                <p>
                  Prepare your PR, follow the automatic claim, and withdraw your
                  reward. Manual receipt guides are here too.
                </p>
                <span className="docs-path-action">
                  Start the contributor guide <ArrowRight size={17} />
                </span>
              </a>
            </div>
            <div
              className="docs-catalogue"
              aria-label="All documentation guides"
            >
              <div className="docs-catalogue-title">
                <h2>All documentation</h2>
                <span>{pages.length} guides</span>
              </div>
              {groups.map((g) => (
                <section key={g.id} className="docs-catalogue-group">
                  <header>
                    <h3>{g.title}</h3>
                    <p>{g.description}</p>
                  </header>
                  <div>
                    {pages
                      .filter((p) => p.group === g.id)
                      .map((p) => (
                        <a href={`#docs/${p.id}`} key={p.id}>
                          <div>
                            <strong>{p.title}</strong>
                            <p>{p.summary}</p>
                          </div>
                          <ArrowUpRight size={18} />
                        </a>
                      ))}
                  </div>
                </section>
              ))}
            </div>
          </>
        ) : page ? (
          <article key={page.id}>
            <div className="docs-breadcrumb">
              <a href="#docs">Documentation</a>
              <span>/</span>
              <span>{group?.title}</span>
            </div>
            <header className="docs-article-header">
              <h1 ref={title} tabIndex={-1}>
                {page.title}
              </h1>
              <p>{page.summary}</p>
            </header>
            {page.sections.map((s, i) => (
              <Section key={s.title} section={s} index={i} />
            ))}
            <nav className="docs-pagination" aria-label="Adjacent guides">
              {previous ? (
                <a href={`#docs/${previous.id}`}>
                  <ArrowLeft size={17} />
                  <span>
                    <small>Previous guide</small>
                    {previous.title}
                  </span>
                </a>
              ) : (
                <a href="#docs">
                  <ArrowLeft size={17} />
                  <span>All documentation</span>
                </a>
              )}
              {next && (
                <a href={`#docs/${next.id}`}>
                  <span>
                    <small>Next guide</small>
                    {next.title}
                  </span>
                  <ArrowRight size={17} />
                </a>
              )}
            </nav>
          </article>
        ) : (
          <section className="docs-not-found">
            <BookOpen size={30} />
            <h1 ref={title} tabIndex={-1}>
              Guide not found
            </h1>
            <p>
              This documentation link does not match a page. All maintainer,
              contributor and reference guides are listed in the documentation
              hub.
            </p>
            <a href="#docs" className="button primary">
              View all documentation <ArrowRight size={16} />
            </a>
          </section>
        )}
        <div className="docs-bottom-links">
          <a href="#repositories">
            Browse repositories <ArrowUpRight size={14} />
          </a>
          <a
            href="https://github.com/RonTuretzky/issue.fund/tree/main/docs"
            target="_blank"
            rel="noreferrer"
          >
            <Terminal size={15} /> Read the docs on GitHub
          </a>
        </div>
      </div>
    </div>
  );
}
