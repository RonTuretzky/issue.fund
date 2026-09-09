# Automation operator guide

Implementation status: the collector, registry API, encrypted store, chain indexer,
restricted signer and relay have local integration tests. Production onboarding,
DigitalOcean deployment, the GitHub App installation, real-mail security tests,
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
The production runtime version and restart/backup behavior still need deployment
verification; do not infer that from the in-process integration tests.

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
For a deeper incident, pause the relay and rebuild/check the index from deployment
blocks before resuming. Do not run multiple signer processes with different
ledgers for the same wallet.

The store uses SQLite WAL with full synchronization and AES-256-GCM for raw mail
and signed transaction payloads. Back up the database with SQLite's online backup
API, not by copying a live database while ignoring its WAL. Keep the encryption
keys in a separate protected backup. Test restore before production. Unmatched
mail is discarded; unrelated authenticated notifications can update delivery
health without retaining their body. Receipt admission is capped at 100 MB.
Active jobs retain evidence; terminal-job retention and signed-transaction cleanup
need operational review before enabling unattended long-term operation.

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
