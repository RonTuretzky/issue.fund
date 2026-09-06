# Operations

## Proving artifacts

`npm run circuits:build` compiles `circuits/Receipt.circom` to R1CS/WASM. `npm run setup` creates development Powers of Tau parameters, contributes fresh entropy, prepares phase 2, performs the circuit-specific Groth16 setup, contributes again and exports the verification key and Solidity verifier.

The default local ceremony is for development. It is computationally expensive and writes several multi-gigabyte files. Do not interrupt it merely because a stage takes a long time; inspect `artifacts/setup.log` when running with output redirected there. Keep enough free disk space for the PTAU, R1CS, ZKEY and witness files together.

To use an externally obtained phase-1 file, independently verify its published cryptographic checksum and set `MERGEBOUNTY_PTAU=/absolute/path/to/verified.ptau`. The file must support power 23. The script still performs a **local** circuit-specific phase-2 contribution and labels the result a development ceremony. Do not treat a successful export as an audit.

`node scripts/download-ptau.mjs` downloads the public power-23 file from the [RISC Zero mirror](https://github.com/risc0/risc0/blob/main/groth16_proof/README.md), resumes completed HTTP ranges, and checks the independent BLAKE2b checksum published by [iden3/snarkjs](https://github.com/iden3/snarkjs). It only renames the download to `artifacts/hermez23.ptau` after a complete checksum match. Run setup with `MERGEBOUNTY_PTAU=artifacts/hermez23.ptau npm run setup` to use it. The file is approximately 9 GiB.

Changing the circuit or regenerating keys requires regenerating proofs and deploying a matching verifier. Do not mix artifacts from different circuits/ceremonies. Preserve the old artifacts if any escrow still relies on them. The generated verifier source is reviewable; its parameters are public.

Setup reuses a complete artifact set and refuses a partial one. A checked-in verifier source alone does not block a fresh setup. If a step fails, preserve the existing artifact directory, recover that step using the commands in `scripts/setup.mjs`, and finish the remaining exports. Do not remove keys associated with a funded escrow. Local phase-1 preparation writes a `.partial` file and promotes it only after success.

## Gnosis service

`npm run prover:gnosis` starts the existing prover on loopback port 4320 for the deployment in `public/deployment.gnosis.json`. The first run creates an owner-readable pairing code at `.local/prover-pairing-code`. Paste it into the live page's pairing dialog; it is retained only in that tab's session storage. The page sends raw emails only to this local service. The service validates Host, Origin, the pairing code, and the deployed verification-key/source hashes. It does not expose an RPC proxy or any signing key.

The static page uses `src/static-api.ts` to read Gnosis and verify imported proofs through the actual escrow. Build it using `npm run build:gnosis`; hosting metadata selects `dist/`. The development-mode frontend (`npm run dev`) still uses Anvil and its separate service.

Keep the exact existing `artifacts/Receipt.zkey`, `artifacts/verification-key.json`, and `artifacts/Receipt_js/` files. Re-running setup on a new computer will not recreate the Gnosis deployment's proving key. See [GNOSIS.md](GNOSIS.md).

## Local services

| Port | Process                                                        |
| ---- | -------------------------------------------------------------- |
| 4320 | Paired Gnosis proof service, started with `npm run prover:gnosis` |
| 8547 | Anvil, chain ID 31337                                          |
| 4319 | Express local proof service; also serves `dist/` after a build |
| 5174 | Vite development frontend, proxying `/api` and `/rpc`          |

The services listen on loopback. Requests with another Host or Origin are rejected by the proof service. There are no mailbox credentials or account private keys in the application. Do not expose the services through a tunnel or reverse proxy as a public deployment.

The default deployment pins the Poseidon hash of GitHub's observed `pf2023` RSA public key:

```text
18769159890606851885526203517158331386071551795170342791119488780143683832216
```

`MERGEBOUNTY_DKIM_KEY_HASH` is a deployment-time override for explicitly reviewed keys. It does not change an existing escrow. Passing an arbitrary key would create an escrow for that arbitrary signer; the UI must never imply it authenticates GitHub automatically.

## Recovery

- **Chain unavailable:** start Anvil on port 8547 and use Retry. An empty new chain requires a deployment; old proofs may no longer satisfy new bounty creation times.
- **Wrong network:** switch the browser wallet to the displayed chain. The explicit Anvil test wallet works without an extension.
- **Unsupported email:** use the original downloaded message, with the native merge/linked closure event. Unicode, forwarded, oversized or differently encoded messages are intentionally rejected.
- **Prover restarted:** unfinished jobs become failed, and private intermediate files are removed. Upload the originals to retry.
- **Proof cancelled:** cancellation stops witness generation/proving and removes private files. The funded bounty remains open.
- **Proof ready:** export it before removing local job history. Import rechecks the actual verifier and bounty policy. Someone holding exported proofs can submit them but cannot redirect the recipient.
- **Transaction rejected/reverted:** the interface reports the failure and allows retry; reread current bounty status first.
- **ETH destination rejects transfers:** choose another destination in the withdrawal dialog. Only the credited account can authorize that change.
- **GitHub key rotation:** the immutable escrow cannot be updated. Pending funds remain refundable under their original deadlines; new key support requires a reviewed new deployment.

## API

`GET /api/config`, `GET /api/bounties`, `GET /api/credits/:address`, `POST /api/receipts/inspect`, `POST /api/proofs`, `GET /api/proofs/:id`, `POST /api/proofs/:id/cancel`, `POST /api/proofs/import`.

Receipt POST requests use `{bountyId, merge, closure}`, where the latter two are raw `.eml` strings. Import uses `{bountyId, result:{merged,closed}}` with Solidity proof calldata. Raw uploads are limited to 100 KB per file and 210 KB per JSON request. One proof job runs at a time to avoid exhausting memory. Public jobs are addressed by random UUID and retained locally for resumption; private working files are not retained after completion.
