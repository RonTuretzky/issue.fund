import { useCallback, useEffect, useState } from "react";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  Copy,
  ExternalLink,
  FileCheck2,
  GitBranch,
  GitMerge,
  Github,
  HelpCircle,
  Loader2,
  LockKeyhole,
  Plus,
  Search,
  ShieldCheck,
  Upload,
  Wallet,
  X,
} from "lucide-react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  decodeEventLog,
  formatEther,
  http,
  isAddress,
  parseAbiItem,
  type Address,
} from "viem";
import { defineChain } from "viem";
import { api, friendly, short } from "./api";
import { STATIC_MODE } from "./static-api";
import { Documentation, docsPath } from "./Documentation";
import { AutomationStatus } from "./AutomationStatus";
import { ClaimPanel } from "./ClaimPanel";
import type { Bounty, Config, CreditBalance } from "./types";
import {
  bountyLink,
  parseBountyLink,
  matchesBounty,
  deploymentFor,
  deployments,
  claimQuote,
} from "./deployments";
import { Modal } from "./Modal";
import { RepositoryHub } from "./RepositoryHub";
import { MaintainerAutomation } from "./MaintainerAutomation";
import { FundDialog, type FundingRequest } from "./FundDialog";
import { FeeSettings } from "./FeeSettings";
import { PreparePr } from "./PreparePr";

const date = (n: number) =>
  new Date(n * 1000).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
const money = (n: string) => formatEther(BigInt(n));
const status = (b: Bounty, now: number) =>
  b.status === 1
    ? "Paid"
    : b.status === 2
      ? "Refunded"
      : now > b.deadline + 604800
        ? "Refundable"
        : now > b.deadline
          ? "Claim period"
          : "Open";
function CopyButton({
  value,
  label = "Copy",
}: {
  value: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="copy"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? <Check size={15} /> : <Copy size={15} />}{" "}
      {copied ? "Copied" : label}
    </button>
  );
}

export default function App() {
  const [config, setConfig] = useState<Config>();
  const symbol = config?.currency ?? (STATIC_MODE ? "xDAI" : "ETH");
  const rpcUrl = config?.rpcUrl ?? `${location.origin}/rpc`;
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState("");
  const [account, setAccount] = useState<Address>();
  const [localWallet, setLocalWallet] = useState(false);
  const [chainId, setChainId] = useState<number>();
  const [walletOpen, setWalletOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [localAccounts, setLocalAccounts] = useState<Address[]>([]);
  const [filter, setFilter] = useState("Open");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | undefined>(() =>
    parseBountyLink(location.hash) ? location.hash : undefined,
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [fundIssueUrl, setFundIssueUrl] = useState("");
  const [repositoriesOpen, setRepositoriesOpen] = useState(
    () => location.hash === "#repositories",
  );
  const [docPath, setDocPath] = useState(() => docsPath(location.hash));
  const openFunding = (url = "") => {
    setFundIssueUrl(url);
    setError("");
    setCreateOpen(true);
  };
  const openRepositories = () => {
    setDocPath(null);
    setCreateOpen(false);
    setSelected(undefined);
    setRepositoriesOpen(true);
    history.replaceState(null, "", "#repositories");
  };
  const explore = () => {
    setDocPath(null);
    setSelected(undefined);
    setRepositoriesOpen(false);
    history.replaceState(null, "", "#");
  };
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState("");
  const [creditValue, setCredit] = useState("0");
  const [creditAccount, setCreditAccount] = useState<string>();
  const [creditRows, setCreditRows] = useState<
    NonNullable<CreditBalance["escrows"]>
  >([]);
  const [withdrawSource, setWithdrawSource] = useState<string>("");
  const credit = creditAccount === account ? creditValue : "0";
  const availableCredits =
    creditAccount === account
      ? creditRows.filter((row) => BigInt(row.amount) > 0n)
      : [];
  const withdrawal =
    availableCredits.find(
      (row) => row.contract.toLowerCase() === withdrawSource.toLowerCase(),
    ) ?? availableCredits[0];
  const [lastTx, setLastTx] = useState("");
  const bounty = bounties.find(
    (b) => selected && matchesBounty(b, selected, config),
  );
  const bountyConfig =
    bounty && config ? deploymentFor(config, bounty.contract) : config;
  const bountyFeeBps =
    bountyConfig?.protocol === "rsa-dkim-v2" ? (bountyConfig.feeBps ?? 0) : 0;
  const chain = config
    ? defineChain({
        id: config.chainId,
        name: config.chainName,
        nativeCurrency: { name: symbol, symbol, decimals: 18 },
        rpcUrls: { default: { http: [rpcUrl] } },
      })
    : undefined;
  const client = createPublicClient({
    chain,
    transport: http(rpcUrl),
  });

  const refresh = useCallback(async () => {
    try {
      const [cfg, list] = await Promise.all([
        api<Config>("/config"),
        api<Bounty[]>("/bounties"),
      ]);
      const route = parseBountyLink(location.hash);
      if (route && !list.some((b) => matchesBounty(b, location.hash, cfg))) {
        try {
          const d = deploymentFor(
            cfg,
            route.contract ?? cfg.legacyLinkContract ?? cfg.contract,
          );
          if (!route.chainId || route.chainId === d.chainId)
            list.push(await api<Bounty>(`/bounties/${d.contract}/${route.id}`));
        } catch {
          /* The requested bounty may not exist in a known escrow. */
        }
      }
      setConfig(cfg);
      setBounties(list);
      setConnectionError("");
    } catch (e) {
      setConnectionError(friendly(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 12000);
    return () => clearInterval(t);
  }, [refresh]);
  useEffect(() => {
    if (!account || !config) {
      setCredit("0");
      return;
    }
    let cancelled = false;
    api<CreditBalance>(`/credits/${account}`)
      .then((x) => {
        if (cancelled) return;
        setCredit(x.amount);
        setCreditAccount(account);
        setCreditRows(
          x.escrows ?? [{ contract: config.contract, amount: x.amount }],
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [account, config, bounties]);
  useEffect(() => {
    const wallet = window.ethereum;
    if (!wallet) return;
    const accounts = (a: Address[]) => {
      if (!localWallet) {
        setAccount(a[0]);
      }
    };
    const chains = (id: string) => setChainId(Number(id));
    wallet.on?.("accountsChanged", accounts);
    wallet.on?.("chainChanged", chains);
    return () => {
      wallet.removeListener?.("accountsChanged", accounts);
      wallet.removeListener?.("chainChanged", chains);
    };
  }, [localWallet]);
  const now = config?.chainTime ?? Date.now() / 1000;
  const wrongNetwork = !!account && chainId !== config?.chainId;
  const choose = (b: Bounty) => {
    setDocPath(null);
    setRepositoriesOpen(false);
    setSelected(bountyLink(b));
    setError("");
    history.replaceState(null, "", bountyLink(b));
  };
  useEffect(() => {
    const navigate = () => {
      setDocPath(docsPath(location.hash));
      setCreateOpen(false);
      setWalletOpen(false);
      setWithdrawOpen(false);
      setRepositoriesOpen(location.hash === "#repositories");
      setSelected(parseBountyLink(location.hash) ? location.hash : undefined);
      void refresh();
      setError("");
    };
    window.addEventListener("hashchange", navigate);
    return () => window.removeEventListener("hashchange", navigate);
  }, []);

  useEffect(() => {
    if (docPath === null) document.title = "issue.fund";
  }, [docPath]);

  async function connect() {
    try {
      if (!window.ethereum)
        throw new Error(
          config?.local
            ? "No browser wallet found. Install an Ethereum wallet, or use a local test wallet below."
            : "No browser wallet found. Open this page in a browser with an Ethereum wallet installed.",
        );
      const a = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      setLocalWallet(false);
      setAccount(a[0]);
      setChainId(
        Number(await window.ethereum.request({ method: "eth_chainId" })),
      );
      setWalletOpen(false);
      setError("");
    } catch (e) {
      setError(friendly(e));
    }
  }
  async function loadLocal() {
    try {
      const a = await createWalletClient({
        chain,
        transport: http(rpcUrl),
      }).getAddresses();
      setLocalAccounts(a);
    } catch (e) {
      setError(friendly(e));
    }
  }
  async function switchNetwork() {
    if (!config || !window.ethereum) return;
    try {
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: `0x${config.chainId.toString(16)}` }],
        });
      } catch (e) {
        if ((e as { code?: number }).code !== 4902 || config.local) throw e;
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: `0x${config.chainId.toString(16)}`,
              chainName: config.chainName,
              nativeCurrency: { name: symbol, symbol, decimals: 18 },
              rpcUrls: [rpcUrl],
              blockExplorerUrls: [config.explorerUrl],
            },
          ],
        });
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: `0x${config.chainId.toString(16)}` }],
        });
      }
      setChainId(
        Number(await window.ethereum.request({ method: "eth_chainId" })),
      );
    } catch (e) {
      setError(friendly(e));
    }
  }
  async function transact(
    name: string,
    args: unknown[],
    value?: bigint,
    target?: Config,
  ) {
    const deployment =
      target ?? (name === "create" ? config : bountyConfig) ?? config;
    if (!deployment) throw Error("The escrow is not ready.");
    if (!account) {
      setWalletOpen(true);
      throw new Error("Connect a wallet to continue.");
    }
    if (wrongNetwork)
      throw new Error(`Switch your wallet to ${config?.chainName}.`);
    setError("");
    setNotice("");
    setPending(name);
    try {
      const wallet = createWalletClient({
        account,
        chain,
        transport: localWallet ? http(rpcUrl) : custom(window.ethereum!),
      });
      const { request } = await client.simulateContract({
        address: deployment.contract,
        abi: deployment.abi,
        functionName: name,
        args,
        account,
        value,
      });
      const hash = await wallet.writeContract(request);
      setLastTx(hash);
      setNotice("Transaction submitted. Waiting for confirmation…");
      const receipt = await client.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success")
        throw new Error(
          "The transaction reverted. No bounty state was changed.",
        );
      await refresh();
      setNotice(
        name === "claim"
          ? `Bounty paid. The designated wallet can now withdraw its ${symbol}.`
          : name === "withdraw"
            ? `Withdrawal confirmed. The ${symbol} is in your wallet.`
            : name === "refund"
              ? "Refund credited. Withdraw it from your balance."
              : name === "setFeeRecipient"
                ? "Fee recipient updated. Future fees will go to the new wallet."
                : name === "transferOwnership"
                  ? "Owner transfer updated. A new owner must accept to take control."
                  : name === "acceptOwnership"
                    ? "Ownership accepted. You can now manage fee routing."
                    : "Bounty funded. Copy the PR title instructions to get started.",
      );
      return receipt;
    } catch (e) {
      setError(friendly(e));
      throw e;
    } finally {
      setPending("");
    }
  }
  async function create({ check, amount, days }: FundingRequest) {
    const block = await client.getBlock();
    const deadline = block.timestamp + BigInt(days * 86400);
    const receipt = await transact(
      "create",
      [
        check.repo.name,
        BigInt(check.issue.number),
        check.repo.branch,
        deadline,
      ],
      amount,
    );
    setCreateOpen(false);
    const after = await api<Bounty[]>("/bounties");
    const funded = receipt.logs.flatMap((log) => {
      if (log.address.toLowerCase() !== config!.contract.toLowerCase())
        return [];
      try {
        const event = decodeEventLog({
          abi: [
            parseAbiItem(
              "event Funded(uint256 indexed id,address indexed funder,bytes32 bountyRef,string repo,uint64 issue,uint256 amount,uint64 deadline)",
            ),
          ],
          data: log.data,
          topics: log.topics,
          eventName: "Funded",
        });
        return [event.args.id];
      } catch {
        return [];
      }
    })[0];
    const added = after.find(
      (b) =>
        b.id === Number(funded) &&
        (b.contract ?? config!.contract).toLowerCase() ===
          config!.contract.toLowerCase(),
    );
    if (added) choose(added);
  }
  const available = bounties.filter(
    (b) =>
      (filter === "All" ||
        (filter === "Mine"
          ? b.funder.toLowerCase() === account?.toLowerCase()
          : filter === "Paid"
            ? b.status === 1
            : status(b, now) === "Open")) &&
      `${b.repo} ${b.issue}`.toLowerCase().includes(search.toLowerCase()),
  );
  const openValue = bounties
    .filter((b) => b.status === 0)
    .reduce((n, b) => n + BigInt(b.amount), 0n);
  const paidValue = bounties
    .filter((b) => b.status === 1)
    .reduce((n, b) => n + BigInt(b.amount), 0n);

  return (
    <>
      <header className="topbar app-header">
        <a className="project-name" href="#" onClick={explore}>
          <img
            className="project-mark"
            src="/brand/issue-fund/bounty-ticket.png"
            alt=""
            width="52"
            height="36"
          />
          <span>issue.fund</span>
        </a>
        <nav aria-label="Main navigation">
          <button
            className={
              !selected && !repositoriesOpen && docPath === null
                ? "nav-active"
                : ""
            }
            onClick={explore}
          >
            Explore bounties
          </button>
          <button
            className={repositoriesOpen && docPath === null ? "nav-active" : ""}
            onClick={openRepositories}
          >
            Repositories
          </button>
          <a
            href="#docs"
            className={docPath !== null ? "nav-active" : ""}
            aria-current={docPath !== null ? "page" : undefined}
          >
            Documentation
          </a>
        </nav>
        <div className="top-actions">
          <span className="network">
            <i />
            {config?.chainName ?? (STATIC_MODE ? "Gnosis" : "Local testnet")}
          </span>
          <button
            className="button wallet-button"
            onClick={() => {
              setWalletOpen(true);
              setError("");
            }}
          >
            <Wallet size={16} />
            {account ? short(account) : "Connect wallet"}
          </button>
        </div>
      </header>
      <main>
        {docPath === null && (
          <>
            {connectionError && (
              <div className="alert error" role="alert">
                <strong>Connection needs attention.</strong> {connectionError}
                <button onClick={refresh}>Retry</button>
              </div>
            )}
            {config?.local && (
              <div className="environment">
                <span>
                  <span className="dot" /> LOCAL DEVELOPMENT
                </span>{" "}
                Real contract transactions. Test ETH only. Direct RSA/DKIM
                verification.
              </div>
            )}
            {wrongNetwork && (
              <div className="alert error" role="alert">
                Your wallet is on a different network.
                <button onClick={switchNetwork}>
                  Switch to {config?.chainName}
                </button>
              </div>
            )}
            {notice && (
              <div className="alert success" role="status">
                <CheckCircle2 size={18} />
                <span>
                  {notice}
                  {lastTx &&
                    (config?.explorerUrl ? (
                      <a
                        className="tx-hash"
                        href={`${config.explorerUrl}/tx/${lastTx}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View transaction {short(lastTx)}
                      </a>
                    ) : (
                      <small className="tx-hash">
                        Transaction {short(lastTx)}
                      </small>
                    ))}
                </span>
                <button
                  className="icon-button"
                  aria-label="Dismiss notification"
                  onClick={() => setNotice("")}
                >
                  <X size={16} />
                </button>
              </div>
            )}
            {error && !createOpen && !walletOpen && !withdrawOpen && (
              <div className="alert error" role="alert">
                {error}
                <button
                  className="icon-button"
                  aria-label="Dismiss error"
                  onClick={() => setError("")}
                >
                  <X size={16} />
                </button>
              </div>
            )}
            {BigInt(credit) > 0n && (
              <div className="credit-bar">
                <div>
                  <ArrowDownLeft size={20} />
                  <span>
                    <strong>
                      {money(credit)} {symbol} ready to withdraw
                    </strong>
                    <small>
                      Only your connected wallet can withdraw this balance.
                    </small>
                  </span>
                </div>
                <button
                  className="button primary"
                  disabled={!!pending || wrongNetwork}
                  onClick={() => {
                    setError("");
                    setWithdrawOpen(true);
                  }}
                >
                  {pending === "withdraw" ? (
                    <Loader2 className="spin" size={16} />
                  ) : null}
                  Withdraw {symbol}
                </button>
              </div>
            )}
          </>
        )}
        {docPath === null &&
          config &&
          deployments(config)
            .filter((d) => d.protocol === "rsa-dkim-v2")
            .map((d) => (
              <FeeSettings
                key={d.contract}
                config={d}
                account={account}
                disabled={!!pending || wrongNetwork || !!connectionError}
                transact={transact}
              />
            ))}
        {docPath !== null ? (
          <Documentation path={docPath} />
        ) : repositoriesOpen ? (
          <RepositoryHub
            bounties={bounties}
            fund={openFunding}
            viewBounty={choose}
            back={explore}
          />
        ) : selected && !bounty ? (
          <section className="panel">
            <h1>{loading ? "Loading bounty" : "Bounty unavailable"}</h1>
            <p>
              {loading
                ? "Checking the escrow for this bounty."
                : "This bounty could not be loaded from a supported escrow. Check the link or retry the connection."}
            </p>
            <div className="inline-actions">
              <button
                className="button"
                onClick={() => {
                  setLoading(true);
                  void refresh();
                }}
              >
                Retry bounty
              </button>
              <button className="text-button" onClick={explore}>
                All bounties
              </button>
            </div>
          </section>
        ) : !bounty ? (
          <>
            <section className="hero">
              <div>
                <div className="eyebrow">
                  <span className="little-line" /> REWARDS THAT FOLLOW THE CODE
                </div>
                <h1>
                  Good code.
                  <br />
                  Great <span>incentives.</span>
                </h1>
                <p>
                  Fund a GitHub issue. Merge the fix.
                  <br />
                  Verify it and get paid. No payout operator required.
                </p>
                <div className="hero-actions">
                  <button
                    className="button primary"
                    onClick={() => openFunding()}
                  >
                    <Plus size={18} />
                    Fund an issue
                  </button>
                  <button className="button" onClick={openRepositories}>
                    Browse repositories <ArrowRight size={16} />
                  </button>
                </div>
                <div className="hero-note">
                  <ShieldCheck size={14} />
                  Funds held by code. Payouts verified from signed receipts.
                </div>
              </div>
              <div className="hero-art" aria-hidden="true">
                <div className="art-grid" />
                <svg viewBox="0 0 430 290">
                  <path
                    d="M65 192H180Q210 192 210 162V79Q210 50 240 50H333"
                    fill="none"
                    stroke="var(--color-green-0)"
                    strokeWidth="2"
                    strokeDasharray="5 6"
                  />
                  <path
                    d="M68 76H142Q168 76 168 106V145Q168 176 198 176H322"
                    fill="none"
                    stroke="var(--color-core-green)"
                    strokeWidth="3"
                  />
                  <circle
                    cx="68"
                    cy="76"
                    r="8"
                    fill="var(--color-paper-1)"
                    stroke="var(--color-green-1)"
                    strokeWidth="2"
                  />
                  <circle
                    cx="68"
                    cy="192"
                    r="8"
                    fill="var(--color-paper-1)"
                    stroke="var(--color-green-0)"
                    strokeWidth="2"
                  />
                  <circle
                    cx="327"
                    cy="176"
                    r="10"
                    fill="var(--color-green-2)"
                  />
                  <circle
                    cx="333"
                    cy="50"
                    r="8"
                    fill="var(--color-paper-1)"
                    stroke="var(--color-green-1)"
                    strokeWidth="2"
                  />
                </svg>
                <div className="art-card issue">
                  <span className="art-icon">
                    <Github size={16} />
                  </span>
                  <div>
                    Issue funded<small>Opportunity starts here</small>
                  </div>
                  <CheckCircle2 size={16} />
                </div>
                <div className="art-card merge">
                  <span className="art-icon purple">
                    <GitMerge size={16} />
                  </span>
                  <div>
                    Pull request merged<small>A fix worth rewarding</small>
                  </div>
                  <span className="mini-pill">Merged</span>
                </div>
                <div className="art-card reward">
                  <span className="art-icon green">
                    <Check size={16} />
                  </span>
                  <div>
                    Signature verified<small>Reward ready to withdraw</small>
                  </div>
                  <ArrowUpRight size={17} />
                </div>
              </div>
            </section>
            <section className="stats" aria-label="Bounty statistics">
              <div>
                <span>Available in escrow</span>
                <strong>
                  {money(openValue.toString())}
                  <small>{symbol}</small>
                </strong>
              </div>
              <div>
                <span>Open bounties</span>
                <strong>
                  {bounties.filter((b) => status(b, now) === "Open").length}
                  <small>issues to solve</small>
                </strong>
              </div>
              <div>
                <span>Rewards earned</span>
                <strong>
                  {money(paidValue.toString())}
                  <small>{symbol}</small>
                </strong>
              </div>
              <div className="stat-note">
                <ShieldCheck size={23} />
                <p>
                  Verifiable by anyone.
                  <br />
                  <strong>Paid to the specified wallet.</strong>
                </p>
              </div>
            </section>
            <section className="explore">
              <div className="section-heading">
                <div>
                  <h2>Find your next contribution</h2>
                  <p>
                    Open issues. Clear rewards. Your next pull request matters.
                  </p>
                </div>
                <div className="search">
                  <Search size={16} />
                  <input
                    aria-label="Search bounties"
                    placeholder="Search repository or issue…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="list-toolbar">
                <div className="tabs">
                  {["Open", "All", "Paid", "Mine"].map((f) => (
                    <button
                      className={filter === f ? "active" : ""}
                      onClick={() => setFilter(f)}
                      key={f}
                    >
                      {f}
                      {f === "Open" && (
                        <span>
                          {
                            bounties.filter((b) => status(b, now) === "Open")
                              .length
                          }
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <span className="list-note">Newest first</span>
              </div>
              {loading ? (
                <div className="empty">
                  <Loader2 className="spin" />
                  <h3>Reading bounties from the chain…</h3>
                </div>
              ) : available.length === 0 ? (
                <div className="empty">
                  <div className="empty-icon">
                    <GitBranch size={27} />
                  </div>
                  <h3>
                    {search
                      ? "No matching bounties"
                      : filter === "Mine" && !account
                        ? "Connect to see your bounties"
                        : "The next great fix starts with an issue."}
                  </h3>
                  <p>
                    {search
                      ? "Try another repository name or issue number."
                      : "Fund an issue and give someone a reason to ship it."}
                  </p>
                  <button
                    className="button"
                    onClick={() =>
                      filter === "Mine" && !account
                        ? setWalletOpen(true)
                        : openFunding()
                    }
                  >
                    {filter === "Mine" && !account
                      ? "Connect wallet"
                      : "Fund the first issue"}
                    <ArrowRight size={16} />
                  </button>
                </div>
              ) : (
                <div className="bounty-list">
                  {available.map((b) => (
                    <button
                      className="bounty-row"
                      onClick={() => choose(b)}
                      key={b.bountyRef}
                    >
                      <span className="repo-avatar">
                        {b.repo.split("/")[0].slice(0, 2).toUpperCase()}
                      </span>
                      <div className="bounty-description">
                        <span className="repo-name">
                          <Github size={13} />
                          {b.repo}
                        </span>
                        <h3>
                          Resolve issue #{b.issue}{" "}
                          <span
                            className={`pill ${status(b, now) === "Paid" ? "paid" : ""}`}
                          >
                            {status(b, now)}
                          </span>
                        </h3>
                        <div className="row-meta">
                          <GitBranch size={12} />
                          {b.branch}
                          <span>·</span>Closes {date(b.deadline)}
                          <span>·</span>Funded by {short(b.funder)}
                        </div>
                      </div>
                      <div className="reward-value">
                        {money(
                          b.status === 1
                            ? claimQuote(
                                BigInt(b.amount),
                                b.feeBps ?? 0,
                              ).net.toString()
                            : b.amount,
                        )}{" "}
                        <span>{symbol}</span>
                        <small>
                          {b.status === 0
                            ? "Escrowed reward"
                            : b.status === 1
                              ? "Reward earned"
                              : "Returned to funder"}
                        </small>
                      </div>
                      <ArrowUpRight className="row-arrow" size={20} />
                    </button>
                  ))}
                </div>
              )}
            </section>
            <section className="bottom-callout">
              <div className="round-shield">
                <ShieldCheck size={24} />
              </div>
              <div>
                <h3>A better way to reward open source.</h3>
                <p>
                  Merge receipts prove the work. Smart contracts handle the
                  reward.
                </p>
              </div>
              <a className="text-button" href="#docs/reference/verification">
                Understand the protocol <ArrowRight size={17} />
              </a>
            </section>
            <MaintainerAutomation />
          </>
        ) : (
          <>
            <button
              className="back"
              onClick={() => {
                setSelected(undefined);
                history.replaceState(null, "", "#");
              }}
            >
              <ChevronLeft size={16} />
              All bounties
            </button>
            <section className="detail-heading">
              <div>
                <div className="repo-name">
                  <Github size={16} />
                  {bounty.repo}
                </div>
                <h1>Resolve issue #{bounty.issue}</h1>
                <div className="detail-meta">
                  <span className={`pill ${bounty.status === 1 ? "paid" : ""}`}>
                    {status(bounty, now)}
                  </span>
                  <GitBranch size={14} />
                  {bounty.branch}
                  <span>Funded by {short(bounty.funder)}</span>
                </div>
              </div>
              <div className="detail-reward">
                <span>
                  {money(
                    bounty.status === 1
                      ? claimQuote(
                          BigInt(bounty.amount),
                          bountyFeeBps,
                        ).net.toString()
                      : bounty.amount,
                  )}{" "}
                  <small>{symbol}</small>
                </span>
                <p>
                  {bounty.status === 0
                    ? "Secured in escrow"
                    : bounty.status === 1
                      ? "Reward earned"
                      : "Returned to funder"}
                </p>
              </div>
            </section>
            <div className="detail-layout">
              <div>
                <section className="panel">
                  <h2>
                    {bounty.status === 0
                      ? "Start with the issue"
                      : "GitHub issue"}
                  </h2>
                  {bounty.status === 0 ? (
                    <p>
                      Submit a pull request that closes this issue and targets{" "}
                      <code>{bounty.branch}</code>. Prepare PR fills in the
                      bounty reference, payout wallet and issue-closing line.
                    </p>
                  ) : (
                    <p>
                      {bounty.status === 1
                        ? `The verified merge of PR #${bounty.pr} earned this bounty.`
                        : "This bounty is closed. Its reward was returned to the funder."}
                    </p>
                  )}
                  <div className="inline-actions">
                    {bounty.status === 0 && bountyConfig && (
                      <PreparePr
                        key={bounty.bountyRef}
                        bounty={{ ...bounty, contract: bountyConfig.contract }}
                        account={account}
                        config={{
                          ...bountyConfig,
                          automationUrl: config?.automationUrl,
                        }}
                        connect={() => setWalletOpen(true)}
                      />
                    )}
                    <a
                      className="button"
                      href={`https://github.com/${bounty.repo}/issues/${bounty.issue}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open issue on GitHub <ExternalLink size={15} />
                    </a>
                  </div>
                  {bounty.status === 0 && (
                    <details className="pr-manual">
                      <summary>Copy the PR title manually</summary>
                      <div className="title-template">
                        <div>
                          <span>YOUR PR TITLE</span>
                          <CopyButton
                            value={`[bounty ${bounty.bountyRef}] [wallet ${account ?? "YOUR_WALLET_ADDRESS"}] Describe your fix`}
                          />
                        </div>
                        <code>
                          [bounty {bounty.bountyRef}]<br />
                          [wallet {account ?? "YOUR_WALLET_ADDRESS"}] Describe
                          your fix
                        </code>
                      </div>
                      <div className="inline-note">
                        <HelpCircle size={16} />
                        The wallet in the merge-time title receives the reward.
                        {!account &&
                          " Connect a wallet to fill in your address."}
                      </div>
                    </details>
                  )}
                </section>
                <section className="panel claim-panel">
                  <div className="panel-title">
                    <h2>Verify the merge. Claim the reward.</h2>
                    <LockKeyhole size={19} />
                  </div>
                  {config?.automationUrl && (
                    <AutomationStatus
                      key={bounty.bountyRef}
                      bounty={bounty}
                      config={{
                        ...bountyConfig!,
                        automationUrl: config.automationUrl,
                      }}
                    />
                  )}
                  {bounty.status === 1 ? (
                    <div className="settled">
                      <CheckCircle2 size={38} />
                      <h3>This bounty has been paid.</h3>
                      <p>
                        PR #{bounty.pr} earned{" "}
                        {money(
                          claimQuote(
                            bounty.amount,
                            bountyFeeBps,
                          ).net.toString(),
                        )}{" "}
                        {symbol} for {short(bounty.recipient)}.
                      </p>
                      <p>
                        {account?.toLowerCase() ===
                          bounty.recipient.toLowerCase() && credit === "0"
                          ? `This wallet has no ${symbol} waiting to withdraw.`
                          : "The credited wallet can withdraw any pending balance shown above."}
                      </p>
                    </div>
                  ) : bounty.status === 2 ? (
                    <div className="settled">
                      <ArrowDownLeft size={35} />
                      <h3>This bounty was refunded.</h3>
                      <p>
                        {account?.toLowerCase() ===
                          bounty.funder.toLowerCase() && credit === "0"
                          ? `This wallet has no ${symbol} waiting to withdraw.`
                          : "The claim period ended. The funder can withdraw any pending returned balance."}
                      </p>
                    </div>
                  ) : (
                    config && (
                      <ClaimPanel
                        key={`${bountyConfig!.contract}:${bounty.id}`}
                        bounty={bounty}
                        config={bountyConfig!}
                        account={account}
                        pending={!!pending}
                        wrongNetwork={wrongNetwork}
                        connect={() => setWalletOpen(true)}
                        submit={async (merged, closed) => {
                          try {
                            await transact("claim", [
                              BigInt(bounty.id),
                              merged,
                              closed,
                            ]);
                          } catch (e) {
                            setError("");
                            throw e;
                          }
                        }}
                      />
                    )
                  )}
                </section>
              </div>
              <aside>
                <section className="panel facts">
                  <h3>Bounty details</h3>
                  <dl>
                    <dt>Completion deadline</dt>
                    <dd>{date(bounty.deadline)}</dd>
                    <dt>Claim grace period</dt>
                    <dd>7 days after deadline</dd>
                    <dt>Network</dt>
                    <dd>{config?.chainName}</dd>
                    <dt>Funded</dt>
                    <dd>{date(bounty.createdAt)}</dd>
                    <dt>Platform fee</dt>
                    <dd>{bountyFeeBps / 100}% on a successful claim</dd>
                    <dt>Contributor receives</dt>
                    <dd>
                      {money(
                        claimQuote(bounty.amount, bountyFeeBps).net.toString(),
                      )}{" "}
                      {symbol}
                    </dd>
                    <dt>Escrow</dt>
                    <dd>
                      {short(bountyConfig!.contract)}
                      {bountyConfig!.contract !== config?.contract
                        ? " · earlier version"
                        : ""}
                    </dd>
                  </dl>
                  <hr />
                  <div className="inline-note">
                    <ShieldCheck size={18} />
                    The contract verifies the email signatures and fixes the
                    recipient. A relayer cannot redirect your reward.
                  </div>
                </section>
                <section className="panel">
                  <h3>About refunds</h3>
                  <p>
                    Open bounties can be refunded after the completion deadline
                    and seven-day claim grace period.
                  </p>
                  <button
                    className="button"
                    disabled={
                      bounty.status !== 0 ||
                      account?.toLowerCase() !== bounty.funder.toLowerCase() ||
                      now <= bounty.deadline + 604800 ||
                      !!pending
                    }
                    onClick={() =>
                      transact("refund", [BigInt(bounty.id)]).catch(() => {})
                    }
                  >
                    {pending === "refund" ? (
                      <Loader2 className="spin" size={16} />
                    ) : (
                      <ArrowDownLeft size={16} />
                    )}
                    Reclaim expired bounty
                  </button>
                </section>
                <section className="help-card">
                  <HelpCircle size={20} />
                  <h3>Need a hand?</h3>
                  <p>
                    Read the receipt requirements and learn what a signature
                    reveals.
                  </p>
                  <a
                    className="text-button"
                    href="#docs/contributors/collect-emails"
                  >
                    View the guide <ArrowRight size={15} />
                  </a>
                </section>
              </aside>
            </div>
          </>
        )}
      </main>
      <footer>
        <span className="brand small">
          <img
            src="/brand/decentralpark/logo.png"
            alt=""
            width="28"
            height="28"
          />
          Decentral Park
        </span>
      </footer>
      {createOpen && (
        <FundDialog
          initialUrl={fundIssueUrl}
          close={() => {
            setCreateOpen(false);
            setError("");
          }}
          browse={openRepositories}
          symbol={symbol}
          config={config}
          account={account}
          connect={() => setWalletOpen(true)}
          ready={!!config && !pending}
          wrongNetwork={wrongNetwork}
          switchNetwork={switchNetwork}
          bounties={bounties}
          onFund={create}
        />
      )}
      {withdrawOpen && (
        <Modal
          title={`Withdraw your ${symbol}`}
          close={() => setWithdrawOpen(false)}
        >
          <p className="modal-intro">
            Withdraw {money(withdrawal?.amount ?? "0")} {symbol} from the
            selected escrow. Your connected wallet authorizes the transfer.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const destination = String(
                new FormData(e.currentTarget).get("destination"),
              ).trim();
              if (!isAddress(destination) || /^0x0{40}$/i.test(destination)) {
                setError(
                  "Enter a valid, nonzero Ethereum destination address.",
                );
                return;
              }
              try {
                if (!withdrawal || !config)
                  throw Error("Choose an escrow with an available balance.");
                await transact(
                  "withdraw",
                  [destination],
                  undefined,
                  deploymentFor(config, withdrawal.contract),
                );
                setWithdrawOpen(false);
              } catch {}
            }}
          >
            {availableCredits.length > 1 && (
              <label>
                Balance to withdraw
                <select
                  name="escrow"
                  value={withdrawal?.contract ?? ""}
                  onChange={(event) => setWithdrawSource(event.target.value)}
                  disabled={!!pending}
                >
                  {availableCredits.map((row) => (
                    <option key={row.contract} value={row.contract}>
                      {money(row.amount)} {symbol} · {short(row.contract)}
                      {row.contract !== config?.contract
                        ? " · earlier escrow"
                        : ""}
                    </option>
                  ))}
                </select>
                <span className="field-note">
                  Each escrow balance needs its own withdrawal transaction.
                </span>
              </label>
            )}
            <label>
              Destination wallet
              <input
                name="destination"
                defaultValue={account}
                required
                spellCheck={false}
              />
            </label>
            <p className="fine-print">
              Check the full address before confirming. You can choose another
              destination if your credited wallet cannot receive {symbol}.
            </p>
            {error && (
              <div className="alert error" role="alert">
                {error}
              </div>
            )}
            <div className="modal-actions">
              <button
                className="button"
                type="button"
                onClick={() => setWithdrawOpen(false)}
              >
                Cancel
              </button>
              <button
                className="button primary"
                disabled={!!pending || wrongNetwork}
              >
                {pending ? (
                  <Loader2 className="spin" size={16} />
                ) : (
                  <ArrowDownLeft size={16} />
                )}
                Confirm withdrawal
              </button>
            </div>
          </form>
        </Modal>
      )}
      {walletOpen && (
        <Modal
          title={account ? "Your wallet" : "Connect a wallet"}
          close={() => {
            setWalletOpen(false);
            setError("");
          }}
        >
          <p className="modal-intro">
            Use your wallet to fund issues, submit receipts and withdraw
            rewards.
          </p>
          {error && (
            <div className="alert error" role="alert">
              {error}
            </div>
          )}
          <button className="wallet-option" onClick={connect}>
            <Wallet size={23} />
            <div>
              <strong>Browser wallet</strong>
              <small>Connect your installed Ethereum wallet</small>
            </div>
            <ArrowRight size={18} />
          </button>
          {config?.local && (
            <>
              <button className="wallet-option" onClick={loadLocal}>
                <GitBranch size={23} />
                <div>
                  <strong>Local test wallet</strong>
                  <small>Test ETH only · Anvil on this computer</small>
                </div>
                <ArrowRight size={18} />
              </button>
              {localAccounts.length > 0 && (
                <div className="local-accounts">
                  {localAccounts.slice(0, 3).map((a, i) => (
                    <button
                      key={a}
                      onClick={() => {
                        setAccount(a);
                        setLocalWallet(true);
                        setChainId(config.chainId);
                        setWalletOpen(false);
                        setError("");
                      }}
                    >
                      Test wallet {i + 1} <code>{short(a)}</code>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
          {account && (
            <button
              className="text-button disconnect"
              onClick={() => {
                setAccount(undefined);
                setLocalWallet(false);
                setWalletOpen(false);
                setCredit("0");
              }}
            >
              Disconnect {short(account)}
            </button>
          )}
        </Modal>
      )}
    </>
  );
}
