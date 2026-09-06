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
import {
  STATIC_MODE,
  connectProver,
  disconnectProver,
  hasProverToken,
} from "./static-api";
import type { Bounty, Config, Job, Preview } from "./types";
import { Modal } from "./Modal";
import { RepositoryHub } from "./RepositoryHub";
import { FundDialog, type FundingRequest } from "./FundDialog";

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
  const [proverOpen, setProverOpen] = useState(false);
  const [proverConnected, setProverConnected] = useState(hasProverToken);
  const [pairing, setPairing] = useState(false);
  const [proverError, setProverError] = useState("");
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
  const [selected, setSelected] = useState<number | undefined>(
    () => Number(location.hash.match(/^#bounty-(\d+)$/)?.[1]) || undefined,
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [fundIssueUrl, setFundIssueUrl] = useState("");
  const [repositoriesOpen, setRepositoriesOpen] = useState(
    () => location.hash === "#repositories",
  );
  const openFunding = (url = "") => {
    setFundIssueUrl(url);
    setError("");
    setCreateOpen(true);
  };
  const openRepositories = () => {
    setCreateOpen(false);
    setSelected(undefined);
    setRepositoriesOpen(true);
    history.replaceState(null, "", "#repositories");
  };
  const explore = () => {
    setSelected(undefined);
    setRepositoriesOpen(false);
    history.replaceState(null, "", "#");
  };
  const [help, setHelp] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState("");
  const [credit, setCredit] = useState("0");
  const [lastTx, setLastTx] = useState("");
  const [files, setFiles] = useState<{ merge?: File; closure?: File }>({});
  const [preview, setPreview] = useState<Preview>();
  const [job, setJob] = useState<Job>();
  const [inspecting, setInspecting] = useState(false);
  const [startingProof, setStartingProof] = useState(false);
  const bounty = bounties.find((b) => b.id === selected);
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
    api<{ amount: string }>(`/credits/${account}`)
      .then((x) => setCredit(x.amount))
      .catch(() => {});
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
  useEffect(() => {
    if (!job || !["queued", "proving"].includes(job.status)) return;
    const t = setInterval(
      () =>
        api<Job>(`/proofs/${job.id}`)
          .then(setJob)
          .catch((e) => setError(friendly(e))),
      2500,
    );
    return () => clearInterval(t);
  }, [job]);
  useEffect(() => {
    let active = true;
    if (selected) {
      const id = localStorage.getItem(
        `mergebounty:job:${config?.contract}:${selected}`,
      );
      if (id)
        api<Job>(`/proofs/${id}`)
          .then((j) => {
            if (!active) return;
            setJob(j);
            setPreview(j.preview);
          })
          .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [selected, config?.contract]);
  const now = config?.chainTime ?? Date.now() / 1000;
  const wrongNetwork = !!account && chainId !== config?.chainId;
  const choose = (b: Bounty) => {
    setRepositoriesOpen(false);
    setSelected(b.id);
    setFiles({});
    setPreview(undefined);
    setJob(undefined);
    setError("");
    history.replaceState(null, "", `#bounty-${b.id}`);
  };
  useEffect(() => {
    const navigate = () => {
      setRepositoriesOpen(location.hash === "#repositories");
      const id = Number(location.hash.match(/^#bounty-(\d+)$/)?.[1]);
      setSelected(id || undefined);
      setFiles({});
      setPreview(undefined);
      setJob(undefined);
      setError("");
    };
    window.addEventListener("hashchange", navigate);
    return () => window.removeEventListener("hashchange", navigate);
  }, []);

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
  async function transact(name: string, args: unknown[], value?: bigint) {
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
        address: config!.contract,
        abi: config!.abi,
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
    const added = after.find((b) => b.id === Number(funded));
    if (added) choose(added);
  }
  async function inspect() {
    if (!files.merge || !files.closure || !bounty) return;
    setError("");
    setInspecting(true);
    setPreview(undefined);
    setJob(undefined);
    try {
      const r = await api<Preview>("/receipts/inspect", {
        bountyId: bounty.id,
        merge: await files.merge.text(),
        closure: await files.closure.text(),
      });
      setPreview(r);
    } catch (e) {
      setError(friendly(e));
    } finally {
      setInspecting(false);
    }
  }
  async function prove() {
    if (!files.merge || !files.closure || !bounty) return;
    setError("");
    setStartingProof(true);
    try {
      const j = await api<Job>("/proofs", {
        bountyId: bounty.id,
        merge: await files.merge.text(),
        closure: await files.closure.text(),
      });
      setJob(j);
      localStorage.setItem(
        `mergebounty:job:${config?.contract}:${bounty.id}`,
        j.id,
      );
    } catch (e) {
      setError(friendly(e));
    } finally {
      setStartingProof(false);
    }
  }
  async function importProof(file?: File) {
    if (!file || !bounty) return;
    setError("");
    try {
      if (file.size > 100000)
        throw new Error("Choose an exported proof file under 100 KB.");
      const result = JSON.parse(await file.text());
      const j = await api<Job>("/proofs/import", {
        bountyId: bounty.id,
        result,
      });
      setJob(j);
      setPreview(j.preview);
      localStorage.setItem(
        `mergebounty:job:${config?.contract}:${bounty.id}`,
        j.id,
      );
    } catch (e) {
      setError(friendly(e));
    }
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
      <header className={`topbar${STATIC_MODE ? " with-prover" : ""}`}>
        <a className="brand" href="#" onClick={explore}>
          <img
            src="/brand/decentralpark/logo.png"
            alt=""
            width="42"
            height="42"
          />
          <span className="brand-name">
            Decentral Park<small>MergeBounty</small>
          </span>
        </a>
        <nav>
          <button
            className={!selected && !repositoriesOpen ? "nav-active" : ""}
            onClick={explore}
          >
            Explore bounties
          </button>
          <button
            className={repositoriesOpen ? "nav-active" : ""}
            onClick={openRepositories}
          >
            Repositories
          </button>
          <button onClick={() => setHelp(true)}>
            How it works <ArrowUpRight size={13} />
          </button>
        </nav>
        <div className="top-actions">
          <span className="network">
            <i />
            {config?.chainName ?? (STATIC_MODE ? "Gnosis" : "Local testnet")}
          </span>
          {STATIC_MODE && (
            <button className="button" onClick={() => setProverOpen(true)}>
              <LockKeyhole size={16} />
              {proverConnected ? "Prover paired" : "Connect prover"}
            </button>
          )}
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
        {connectionError && (
          <div className="alert error" role="alert">
            <strong>Connection needs attention.</strong> {connectionError}
            <button onClick={refresh}>Retry</button>
          </div>
        )}
        {config?.developmentCeremony && (
          <div className="environment">
            <span>
              <span className="dot" />{" "}
              {config.local ? "LOCAL DEVELOPMENT" : "GNOSIS · EXPERIMENTAL"}
            </span>{" "}
            {config.local
              ? "Real contract transactions. Test ETH only. Development proof setup."
              : "Real xDAI. Unaudited contracts and a development proof setup. Use small amounts."}
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
                  <small className="tx-hash">Transaction {short(lastTx)}</small>
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
        {repositoriesOpen ? (
          <RepositoryHub
            bounties={bounties}
            fund={openFunding}
            viewBounty={choose}
            back={explore}
          />
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
                  Prove it and get paid. No payout operator required.
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
                  Funds held by code. Payouts verified with private proofs.
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
                    Proof verified<small>Reward ready to withdraw</small>
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
                      key={b.id}
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
                        {money(b.amount)} <span>{symbol}</span>
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
              <button className="text-button" onClick={() => setHelp(true)}>
                Understand the protocol <ArrowRight size={17} />
              </button>
            </section>
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
                  {money(bounty.amount)} <small>{symbol}</small>
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
                      <code>{bounty.branch}</code>. Before the maintainer merges
                      it, put this bounty reference and your wallet in the PR
                      title.
                    </p>
                  ) : (
                    <p>
                      {bounty.status === 1
                        ? `The verified merge of PR #${bounty.pr} earned this bounty.`
                        : "This bounty is closed. Its reward was returned to the funder."}
                    </p>
                  )}
                  <a
                    className="button"
                    href={`https://github.com/${bounty.repo}/issues/${bounty.issue}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open issue on GitHub <ExternalLink size={15} />
                  </a>
                  {bounty.status === 0 && (
                    <>
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
                    </>
                  )}
                </section>
                <section className="panel claim-panel">
                  <div className="panel-title">
                    <h2>Prove the merge. Claim the reward.</h2>
                    <LockKeyhole size={19} />
                  </div>
                  {bounty.status === 1 ? (
                    <div className="settled">
                      <CheckCircle2 size={38} />
                      <h3>This bounty has been paid.</h3>
                      <p>
                        PR #{bounty.pr} earned {money(bounty.amount)} {symbol}{" "}
                        for {short(bounty.recipient)}.
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
                    <>
                      <p>
                        Download the original GitHub notifications as .eml
                        files. You'll need the merged-PR email and the issue
                        email that says “closed as completed via” that PR.
                      </p>
                      <div className="uploads">
                        {(["merge", "closure"] as const).map((kind, i) => (
                          <label
                            className={`upload ${files[kind] ? "has-file" : ""}`}
                            key={kind}
                          >
                            <input
                              type="file"
                              accept=".eml,message/rfc822"
                              disabled={
                                startingProof ||
                                (!!job &&
                                  ["queued", "proving"].includes(job.status))
                              }
                              aria-label={
                                kind === "merge"
                                  ? "Merged PR email"
                                  : "Issue closure email"
                              }
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f && f.size > 100000) {
                                  setError("Choose an .eml file under 100 KB.");
                                  return;
                                }
                                setFiles((x) => ({ ...x, [kind]: f }));
                                setPreview(undefined);
                                setJob(undefined);
                                localStorage.removeItem(
                                  `mergebounty:job:${config?.contract}:${bounty.id}`,
                                );
                              }}
                            />
                            {files[kind] ? (
                              <FileCheck2 size={25} />
                            ) : (
                              <Upload size={24} />
                            )}
                            <strong>
                              {i + 1}.{" "}
                              {kind === "merge"
                                ? "Merged PR email"
                                : "Issue closure email"}
                            </strong>
                            <span>
                              {files[kind]?.name ??
                                "Choose an original .eml file"}
                            </span>
                            <small>
                              {kind === "merge"
                                ? "“Merged #… into main.”"
                                : "“Closed #… as completed via #…”"}
                            </small>
                          </label>
                        ))}
                      </div>
                      {STATIC_MODE && (
                        <div className="alert">
                          <span>
                            {proverConnected
                              ? "Local prover paired for this browser session."
                              : "Email proofs need the prover running on this computer."}
                          </span>
                          <button onClick={() => setProverOpen(true)}>
                            {proverConnected
                              ? "Check connection"
                              : "Connect prover"}
                          </button>
                        </div>
                      )}
                      <div className="privacy-note">
                        <LockKeyhole size={14} />
                        Proving runs on your local computer. Your mailbox
                        details and reply links stay private.
                      </div>
                      <label className="proof-import">
                        Already have proofs?{" "}
                        <span>Import verified proof file</span>
                        <input
                          type="file"
                          accept=".json,application/json"
                          aria-label="Import proof file"
                          onChange={(e) => {
                            importProof(e.target.files?.[0]);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      {!preview && (
                        <button
                          className="button primary"
                          disabled={
                            !files.merge || !files.closure || inspecting
                          }
                          onClick={inspect}
                        >
                          {inspecting ? (
                            <Loader2 size={17} className="spin" />
                          ) : (
                            <ShieldCheck size={17} />
                          )}{" "}
                          {inspecting
                            ? "Checking signatures…"
                            : "Check receipts"}
                        </button>
                      )}
                      {job?.status === "failed" && !preview && (
                        <div className="alert error" role="alert">
                          {job.error} Choose the original emails to retry.
                        </div>
                      )}
                      {preview && (
                        <div className="proof-review">
                          <div className="verified-label">
                            <CheckCircle2 size={17} />
                            Signatures and bounty match
                          </div>
                          <dl>
                            <dt>Closing pull request</dt>
                            <dd>#{preview.pr}</dd>
                            <dt>Payout wallet</dt>
                            <dd className="full-address">{preview.wallet}</dd>
                            <dt>Reward</dt>
                            <dd>
                              {money(bounty.amount)} {symbol}
                            </dd>
                          </dl>
                          {preview.wallet.toLowerCase() !==
                            account?.toLowerCase() && (
                            <p className="inline-note">
                              You can submit this claim, but payment will go to
                              the wallet shown above.
                            </p>
                          )}
                          {!job && (
                            <button
                              className="button primary"
                              disabled={startingProof}
                              onClick={prove}
                            >
                              {startingProof
                                ? "Preparing proofs…"
                                : "Generate private proofs"}{" "}
                              <ArrowRight size={16} />
                            </button>
                          )}
                          {job &&
                            ["queued", "proving"].includes(job.status) && (
                              <div className="proof-progress" role="status">
                                <Loader2 className="spin" size={20} />
                                <div>
                                  <strong>{job.stage}</strong>
                                  <p>
                                    Full email proofs can take several minutes.
                                    You can return to this bounty while the
                                    local prover is running.
                                  </p>
                                  <button
                                    className="text-button"
                                    onClick={() =>
                                      api(`/proofs/${job.id}/cancel`, {}).catch(
                                        (e) => setError(friendly(e)),
                                      )
                                    }
                                  >
                                    Cancel proof generation
                                  </button>
                                </div>
                              </div>
                            )}
                          {job?.status === "failed" && (
                            <div role="alert" className="alert error">
                              {job.error}
                              {files.merge && files.closure ? (
                                <button onClick={prove}>Try again</button>
                              ) : (
                                <span>
                                  Choose the two original emails above to retry.
                                </span>
                              )}
                            </div>
                          )}
                          {job?.status === "ready" && (
                            <>
                              <div className="verified-label">
                                <ShieldCheck size={17} />
                                Both zero-knowledge proofs verified
                              </div>
                              <button
                                className="button primary"
                                disabled={!!pending || wrongNetwork}
                                onClick={() =>
                                  account
                                    ? transact("claim", [
                                        BigInt(bounty.id),
                                        job.result!.merged,
                                        job.result!.closed,
                                      ]).catch(() => {})
                                    : setWalletOpen(true)
                                }
                              >
                                {pending === "claim" ? (
                                  <Loader2 className="spin" size={17} />
                                ) : (
                                  <Wallet size={17} />
                                )}{" "}
                                {account
                                  ? "Submit claim"
                                  : "Connect wallet to claim"}
                              </button>
                              <button
                                className="text-button"
                                onClick={() => {
                                  const u = URL.createObjectURL(
                                    new Blob(
                                      [JSON.stringify(job.result, null, 2)],
                                      { type: "application/json" },
                                    ),
                                  );
                                  const a = document.createElement("a");
                                  a.href = u;
                                  a.download = `mergebounty-${bounty.id}-proof.json`;
                                  a.click();
                                  URL.revokeObjectURL(u);
                                }}
                              >
                                Export proofs <ArrowDownLeft size={15} />
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </>
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
                    <dd>0%</dd>
                  </dl>
                  <hr />
                  <div className="inline-note">
                    <ShieldCheck size={18} />
                    The contract verifies the proof and fixes the recipient. A
                    relayer cannot redirect your reward.
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
                    Read the receipt requirements and learn what a proof
                    reveals.
                  </p>
                  <button className="text-button" onClick={() => setHelp(true)}>
                    View the guide <ArrowRight size={15} />
                  </button>
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
          Decentral Park / MergeBounty
        </span>
        <span>Code for the common good.</span>
        <button onClick={() => setHelp(true)}>
          Protocol & privacy <ArrowUpRight size={13} />
        </button>
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
            Withdraw {money(credit)} {symbol} from your credited balance. Your
            connected wallet authorizes the transfer.
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
                await transact("withdraw", [destination]);
                setWithdrawOpen(false);
              } catch {}
            }}
          >
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
            Use your wallet to fund issues, submit proofs and withdraw rewards.
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
      {proverOpen && (
        <Modal
          title="Connect your local prover"
          close={() => setProverOpen(false)}
        >
          <p>
            The website is static. Generating proofs uses the MergeBounty prover
            on this computer, with the matching proving key. Your original
            emails stay on this computer.
          </p>
          <p>
            Start it with <code>npm run prover:gnosis</code> in the MergeBounty
            project, then paste the code from{" "}
            <code>.local/prover-pairing-code</code>. Allow local network access
            if your browser asks.
          </p>
          {proverError && (
            <div className="alert error" role="alert">
              {proverError}
            </div>
          )}
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setPairing(true);
              setProverError("");
              const token = String(
                new FormData(event.currentTarget).get("pairingCode"),
              );
              try {
                await connectProver(token);
                setProverConnected(true);
                setProverOpen(false);
                setNotice(
                  "Local prover connected to this Gnosis deployment. You can generate private proofs.",
                );
              } catch (e) {
                setProverError(friendly(e));
              } finally {
                setPairing(false);
              }
            }}
          >
            <label>
              Pairing code
              <input
                name="pairingCode"
                type="password"
                autoComplete="off"
                required
                minLength={64}
                maxLength={64}
                spellCheck={false}
              />
            </label>
            <button className="button primary" disabled={pairing}>
              {pairing ? "Checking prover…" : "Connect and check prover"}
            </button>
          </form>
          {proverConnected && (
            <button
              className="text-button"
              onClick={() => {
                disconnectProver();
                setProverConnected(false);
                setProverOpen(false);
              }}
            >
              Disconnect prover
            </button>
          )}
          <p className="fine-print">
            The code pairs only this browser session. Funding, withdrawing, and
            importing an existing proof work without the prover. Keep this
            computer awake while proving.
          </p>
        </Modal>
      )}
      {help && (
        <Modal
          title="From open issue to earned reward"
          close={() => setHelp(false)}
        >
          <div className="guide">
            <div>
              <span>01</span>
              <section>
                <h3>Fund the work</h3>
                <p>
                  Create a bounty for an exact GitHub repository, issue and
                  target branch. {symbol} is held by the immutable escrow.
                </p>
              </section>
            </div>
            <div>
              <span>02</span>
              <section>
                <h3>Make the fix</h3>
                <p>
                  Add the copied bounty reference and your wallet to your PR
                  title. Include “Closes #issue” in the description. Subscribe
                  to both the PR and issue before the merge.
                </p>
              </section>
            </div>
            <div>
              <span>03</span>
              <section>
                <h3>Download two receipts</h3>
                <p>
                  In Gmail, open the specific message, choose its three-dot
                  menu, then “Download message.” Use GitHub's merge event and
                  the linked issue-closure event. A comment that says “Merged”
                  does not qualify.
                </p>
              </section>
            </div>
            <div>
              <span>04</span>
              <section>
                <h3>Prove, claim, withdraw</h3>
                <p>
                  The local prover checks the GitHub DKIM signature and
                  generates two private proofs. The contract verifies them,
                  credits the wallet in the merge-time title, and lets that
                  wallet withdraw.
                </p>
              </section>
            </div>
          </div>
          <div className="terms">
            <LockKeyhole size={21} />
            <p>
              Public: the PR/issue subjects, native event prefix, DKIM metadata,
              wallet and reward. Private: sender and recipient addresses,
              remaining email body and reply links. v1 supports GitHub's ASCII,
              7-bit plain-text MIME notification format and pins one GitHub
              signing key at deployment.
            </p>
          </div>
          <p className="fine-print">
            {config?.local
              ? "The development deployment uses test ETH and a local trusted setup."
              : "This Gnosis deployment uses real xDAI, unaudited contracts and a development trusted setup."}
            GitHub remains the source of truth; this contract does not judge
            code quality. Repository renames and transfers are not automatically
            reconciled.
          </p>
          <button className="button primary" onClick={() => setHelp(false)}>
            Got it <Check size={16} />
          </button>
        </Modal>
      )}
    </>
  );
}
