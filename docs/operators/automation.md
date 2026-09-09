# Automation operator guide

Implementation status: the collector, registry API, encrypted store, chain indexer,
restricted signer and relay have local integration tests. The frontend has automatic/manual setup, fee quotes, per-escrow links and
withdrawals, with local browser coverage. The DigitalOcean service is deployed at
https://api.issue.fund with automatic disclosure disabled. The GitHub App installation, real-mail security tests,
and the genuine GitHub-to-Gnosis acceptance run are still in progress. The live
frontend continues to use the original deployment until that work is verified.

## Accounts and permissions

Use a dedicated, human-owned GitHub account that is **not** an owner, collaborator,
organization member with repository access, or otherwise exempt from conversation
locks on enrolled repositories. Do not use a maintainer's mailbox as the collector.

The supplied token authenticates as `DecentralParkNY`. It is a fine-grained PAT.
GitHub rejects its per-repository subscription access; the watching endpoint does
not support that token type. Create a **classic PAT** for that account, starting
with `public_repo` for this public-only service. The service checks the exact
subscription endpoint and fails with `classic_watch_token_required` rather than
silently pretending it has subscribed. Private-repository scope is unnecessary.
See [GitHub's watching API](https://docs.github.com/en/rest/activity/watching#set-a-repository-subscription).

A separate maintainer-installed GitHub App needs Metadata read, Issues write and
Pull requests write. It only checks repository identity and collaborator status,
and locks completed bounty issues/PRs. It does not check out code, run PR code,
create contributions, or decide what deserves a reward. Installing the App is
maintainer consent; a public sponsor pasting an issue URL is not consent.

## Provide Gmail access

The implemented adapter reads original mail over TLS IMAP; it does not send mail,
mark messages as read, follow links, or download attachments separately.

1. Create a dedicated Gmail mailbox and add/verify it on the collector's GitHub account.
2. In GitHub notification settings, enable email for watched repositories, including
   issue and pull-request activity. Ensure custom repository/organization routing
   points to this mailbox. Do not forward notifications from a personal mailbox.
3. Enable Google's 2-Step Verification, then create an app password named
   `issue.fund collector`. See [Google's instructions](https://support.google.com/accounts/answer/185833).
4. On the operator machine, edit the private, ignored file
   `.local/secrets/collector.env`. Set `MAIL_ADDRESS`, `MAIL_PASSWORD`, and the
   replacement `COLLECTOR_GITHUB_TOKEN`. `MAIL_HOST=imap.gmail.com` is already set.
   Do not put these values in Git, an issue, a frontend environment variable,
   a public deployment manifest, or a screenshot. Keep this file mode `0600`.
5. The deployment script must transfer that file directly to the collector's
   protected service environment file. Test login and genuine GitHub delivery
   before enabling automatic disclosure.

Google may not offer app passwords for some account/security configurations.
An IMAP OAuth access token is also supported, but token refresh is not implemented
and [Gmail IMAP's OAuth scope](https://developers.google.com/workspace/gmail/imap/xoauth2-protocol#oauth_20_scopes) is broader than Gmail API `gmail.readonly`. The
adapter opening a mailbox read-only does not make the underlying credential a
read-only credential. A Gmail REST OAuth adapter would be a separate addition.

## Why the delivery and lock checks matter

GitHub reply addresses are posting credentials. The earlier controlled test in
[issue #2](https://github.com/RonTuretzky/issue.fund/issues/2) demonstrated comment
impersonation from another mailbox. This is separate from payout authentication.

The actual receipt samples sign `Reply-To` but do **not** sign
`X-GitHub-Recipient` or `X-GitHub-Recipient-Address`. Merely comparing those
unsigned fields with the collector account would allow a replayed email with a
forged recipient assertion to pass the disclosure check.

`verifyGmailDelivery` therefore only accepts data fetched directly from the
configured Gmail mailbox, requires its top trusted Authentication-Results to
report direct SPF authorization for GitHub's envelope sender, and checks the
collector identity/address. DKIM is independently verified locally afterward.
This depends on the provider's ingress-header trust boundary described in
[RFC 8601](https://www.rfc-editor.org/rfc/rfc8601.html). It is an operational
identity check, not a new cryptographic claim about an unsigned header. Imported
or forwarded EML files cannot be fed to a public collector endpoint; none exists.

Before _any_ RPC simulation, estimation, or broadcast containing receipt bytes,
the relay checks installation consent, current repository identity, the
collector's absence from the collaborator list, and both conversation locks.
Owners and collaborators can remain exempt from locks. Locks can later be
removed and roles can change; permanently public credentials can become useful
again. See [GitHub's lock rules](https://docs.github.com/en/communities/moderating-comments-and-conversations/locking-conversations).

`DISCLOSURE_VALIDATION_FILE` is deliberately absent until the live acceptance
matrix has passed. Its JSON must identify the collector, provider, mailbox and
public **non-secret** evidence for each required result:

- direct delivery;
- forged recipient rejection and forwarded replay rejection;
- blocked issue and PR replies for the outside collector;
- rejected owner/collaborator exemption;
- unlock risk demonstrated;
- genuine paired receipt claim.

Do not fill this file with fixture-test results. Local tests prove the code's
behavior on their inputs, not Gmail's or GitHub's real delivery/lock behavior.
Validation permits an operational mitigation, not a permanent privacy guarantee.

## Service layout

The frontend remains static on GitHub Pages. A separate DigitalOcean service runs:

- `automation/run.mjs`: loopback HTTP API, repository registry, mailbox reader,
  confirmed chain indexer, encrypted receipt store, and relay coordinator.
- `automation/run-signer.mjs`: a separate process/user with the relay private key,
  independent storage key and nonce/budget ledger. The collector accesses it over
  a permission-restricted Unix socket. It accepts only zero-value claims to
  approved escrows and zero-value self-transfers to cancel an existing reservation.

The signer never receives GitHub or mailbox credentials. The public HTTP service
has no sign endpoint and no mail-upload endpoint. Source deployments require
Node 22.13+ (SQLite is experimental in the installed Node 22 runtime), installed
npm dependencies, persistent storage, TLS reverse proxy, and process supervision.
The deployed runtime is Node 24.21.0 LTS. Separate user/file/network isolation and
on-host database restore have been checked. Complete the real-mail acceptance
matrix before enabling relay; infrastructure health is not delivery readiness.

`DEPLOYMENTS_FILE` contains an array of approved manifests, including chain ID,
escrow/verifier addresses, ABI, pinned DKIM key and `fromBlock`. Add the new V2
escrow alongside V1 when it is deployed. The backend validates the chain and
immutable verifier/key; include `runtimeHash` for bytecode pinning. V2 manifests
also pin `feeBps` and `feeRecipient`. Never delete the legacy deployment from
clients while users have open bounties or credits there.

## API and readiness

- `POST /v1/issues/prepare` with `{ "url": "https://github.com/owner/repo/issues/42" }`
  checks public issue/repository identity and maintainer installation, creates a
  durable registration, then prepares/reconciles watching.
- `GET /v1/issues/status?url=...` returns `preparing`, `ready`, or `attention`, with
  check/delivery timestamps and an enumerated recovery code.
- `GET /v1/bounties/:chain/:escrow/:id/status` exposes job progress and transaction
  hashes, never raw emails or credentials.
- `GET /healthz` reports process availability. `/v1/health` exposes component
  health. Process availability alone does not mean automatic claims are ready.

Ready requires a recent subscription check, healthy mailbox polling, an actual
verified notification received after watching began, and completed disclosure
validation. Delivery can still fail afterward. For a new repository, normal
notification activity can establish the first delivery; if there is none, the
UI must keep Preparing and offer explicit manual collection rather than promise
automation. A controlled setup notification can be created with maintainer consent.

Direct contract funding is indexed too. The service attempts to prepare its issue
but marks late subscription explicitly. Historical original DKIM mail cannot be
reconstructed from GitHub REST data. Manual and independent submissions remain
possible under the contract's existing rules.

## Relay and recovery

The relay tracks `(chainId, escrow, bountyId)`, pairs out-of-order receipts, checks
current bounty terms, and reserves one in-flight nonce for its dedicated wallet.
It persists the encrypted signed transaction before broadcast. An uncertain RPC
response triggers an identical retry, not another nonce. After two minutes it
can replace a pending transaction at the same nonce within price/budget limits.
When a competing claim settles first, it can cancel its unused nonce without
sending funds to another wallet. Confirmation and block hashes control settlement
status, and an orphaned recent claim can be resubmitted.

Defaults: 12 confirmation blocks, 15 million gas maximum per claim, 10 gwei gas
price ceiling, 0.2 native coin maximum claim gas cost, and 1 native coin reserved
per UTC day in the signer. These are ceilings, not fee-income guarantees. Check
current gas costs and the relay balance before offering sponsorship. Budget
reservations are conservative and are not refunded just because a transaction
was replaced or reverted. Fees accrue to the fee wallet separately from relay gas.

Recent transaction reorg checks cover the latest 200 settled transactions; funding
scan rollback rewinds 5,000 blocks and also checks active funding block hashes.
Each poll scans at most 500 blocks per escrow and durably queues discovered
funding before advancing its checkpoint. It refreshes at most 25 queued and 25
active bounties per escrow, with a persistent rotating sweep. Failed queued reads
retry after 30 seconds without blocking later bounties. These are work-count
limits, not a wall-clock guarantee; RPC latency still affects cycle time. Automatic
issue discovery makes at most one registration attempt per poll, and retries the
same unenrolled issue no more than once per 15 minutes. An explicit user preparation
request can still enroll it immediately. A detected scan reorg also queues settled
jobs whose funding remains canonical, so orphaned refunds/withdrawals are reread.
For a deeper incident, pause the relay and rebuild/check the index from deployment
blocks before resuming. Do not run multiple signer processes with different
ledgers for the same wallet.

The store uses SQLite WAL with full synchronization and AES-256-GCM for raw mail
and signed transaction payloads. Back up the database with SQLite's online backup
API, not by copying a live database while ignoring its WAL. Keep the encryption
keys in a separate protected backup. Test restore before production. Unmatched
mail is discarded; unrelated authenticated notifications can update delivery
health without retaining their body. Receipt admission is capped at 100 MB.
Active jobs and pending nonce families retain evidence. Settled jobs keep a separate
terminal timestamp that indexing does not reset; after 30 days, the collector
unpins expired receipts and erases settled signed-transaction payloads while keeping
hashes and nonce history. A reorg resets the terminal timestamp. Receipt and signed
transaction admission share a 100 MB encrypted-payload cap; SQLite metadata, WAL and
backup disk use still need monitoring. Backups may retain deleted records for their
own 30-day window. Automatic recent-transaction reorg recovery is bounded by both
the last 200 settlements and payload retention; older incidents need operator
reconciliation. Keys are never part of database snapshots.

No secrets or raw errors are logged. Components expose enumerated error codes.
`relay_needs_gas`, `github_permissions_missing`, `mailbox_unavailable`,
`conversation_lock_required`, key/template changes and storage-capacity errors
must alert the operator. Logging/alert delivery and a restore drill are deployment
acceptance items, not completed merely by this document.

## Verification commands

```sh
forge test -vv
npm test
npm run test:automation
npm run build:gnosis
```

Automation integration tests start isolated Anvil processes and terminate them.
They use generated RSA keys and synthetic native-email fixtures exclusively on
chain 31337. The genuine production acceptance run is tracked separately.

## DigitalOcean deployment files

`ops/digitalocean/provision.mjs` provisions one dedicated Ubuntu 24.04 droplet, a
separate SSH key and a tagged firewall. Its $6/month base size has provider backups
enabled at additional cost. SSH is restricted to the provisioning machine’s public
IPv4; update that firewall rule in DigitalOcean if the operator address changes.
The bootstrap installs the pinned Node 24.21.0 LTS archive after checking its
published SHA-256, Caddy, system users and security updates. No credentials are
placed in cloud-init user data.

The collector and signer use separate Unix users and protected environment files.
The signer unit has a private network namespace and accepts only its Unix socket.
Root-owned source releases are read-only to both services. Caddy terminates HTTPS
for `api.issue.fund` and forwards only to the loopback API. The database backup
timer takes daily online snapshots and verifies SQLite integrity. Keep a protected
off-host copy and separate key backup, then restore with both services stopped.
Before starting a restored signer, reconcile its ledger with live chain and pending
nonces; never treat an old snapshot as proof that a nonce was unused.

## One-time App registration

Run `node ops/digitalocean/register-app.mjs` locally and open
http://127.0.0.1:4331 in a browser signed into the GitHub account that should own
the service App. The manifest preconfigures Metadata read, Issues write and Pull
requests write, disables webhooks and user OAuth, and returns the generated App
configuration to a loopback callback. The callback verifies a random state and
saves the private key and other credentials only to the ignored mode-0600 file
`.local/secrets/github-app.json`. It then opens GitHub's installation page. Start
with the designated public acceptance repository.

`prepare-config.mjs` includes a saved App configuration when present. It generates
a setup environment with automatic disclosure and relay still disabled. Do not
use it to overwrite an already-enabled production environment; edit that protected
configuration deliberately, preserving the validation record and operational limits.
Never put the operator registration server on the public API hostname. The public
service does not implement a credential-exchange route.

## Verified deployment checkpoint

### External availability monitoring

`ops/digitalocean/monitoring.mjs` provisions a single DigitalOcean HTTPS check for
`https://api.issue.fund/healthz` from US East, US West and Europe. It defaults to
a read-only plan; `--apply` creates or reconciles that named check. It reuses the
existing resource and refuses conflicting targets or duplicate names. Provider
credentials stay on the operator machine. September 9 verification found all
three regions UP and confirmed a rerun did not create another check.

This probe measures HTTP/TLS process availability. It does not prove notification
delivery, worker freshness, claim eligibility, relay balance or backup success.
Component-level and backup-failure alert delivery remain launch requirements.
DigitalOcean [prices Uptime](https://docs.digitalocean.com/products/uptime/details/pricing/)
at $1 per check per month, billed hourly, with a 672-hour monthly first-check
credit. No Spaces bucket has been provisioned by this setup.

After the operator chooses the notification address, run:

```sh
ALERT_EMAIL='operator@example.com' node ops/digitalocean/monitoring.mjs --apply --enable-alerts
```

Replace the example with the approved address; DigitalOcean requires a verified
account address for Uptime email alerts. This reconciles global outage (2 minutes),
certificate expiry (14 days), CPU over 85% (10 minutes), memory over 85% (5 minutes)
and disk over 80% (5 minutes). Resource alerts target only the issue.fund droplet.
Read-back verifies the configured targets, thresholds and recipients. Configured
alerts still need a controlled notification-delivery drill; the script does not
claim that API success means an email was received. A check-only rerun leaves
existing notifications in place. Alert recipients and provider tokens are not
included in its output or public deployment record.

The current check has **no alert destinations**. Choosing an address, enabling
alerts and confirming delivery remain pending. The documented Spaces key API
returned 404 for the supplied account access, and the browser console requires
login. Recurring off-host database export therefore still needs a private storage
destination and scoped credentials. Existing online snapshots, provider backups
and the verified one-time off-host copy remain available.

### Service verification

The service at https://api.issue.fund currently indexes V1 with automatic disclosure
and the relay worker disabled. The public frontend remains on its previous Pages
release. The 2026-09-09 deployment checks covered separate secret access, the
signer's private network namespace, IPC policy rejection, recovery of both
processes after a forced stop, database restore and a matching protected off-host
backup copy. A full live notification/claim run is still required.

The signer unit holds an exclusive file lock before removing a stale socket, and
its runtime directory persists across restarts so the collector's mount does not
point to a replaced directory. Run production only through these service units;
do not launch a second signer manually against the same key and ledger. The
release installer waits for both processes, the Unix socket and loopback health
before reporting success.
