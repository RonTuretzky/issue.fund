# Cloudflare hosting

issue.fund is a static React application. Cloudflare Workers Static Assets serves the contents of `dist/` using `wrangler.jsonc`; there is no application Worker, database, email upload endpoint or proving service. The browser talks directly to GitHub's public API and the configured Gnosis RPC.

## Deployment status

The issue.fund domain is active in the intended Cloudflare account. The first publish attempt on September 6, 2026 was rejected by Cloudflare with authentication error 10000 on the Workers API. The provided token could read domain/DNS settings but could not publish the Worker. No DNS record was changed. The static bundle and configuration passed the local deployment dry run.

The existing [public preview](https://mergebounty-gnosis.turetzkyron.chatgpt.site) remains available while the Workers permissions are updated.

## Deploy

1. Use Node 22 and `npm ci --ignore-scripts`.
2. Supply `CLOUDFLARE_API_TOKEN` through a secret manager or CI environment. Do not put credentials in source, CLI arguments, a `VITE_` variable or the deployment manifest.
3. The token needs **Account → Workers Scripts → Edit** for the account in `wrangler.jsonc`. Custom-domain setup also needs **Zone → Zone → Read** and **Zone → DNS → Edit** for `issue.fund`. If creating a Worker route, include **Zone → Workers Routes → Edit**. Limit resources to the relevant account and zone.
4. Run `npm run deploy:cloudflare`. This checks generated documentation, type-checks, builds the static Gnosis app and publishes it. Wrangler attaches `issue.fund` as the custom domain; no separate application server is needed.
5. Open `https://issue.fund/#docs`, `/#repositories` and an existing bounty. Check the network and contract addresses against `public/deployment.gnosis.json`. Read-only verification does not need a wallet or a transaction.

For a preflight without publishing, run `npm run build:gnosis` then `npx wrangler deploy --dry-run`. To inspect and restore a previous Worker deployment, use `npx wrangler deployments list` and `npx wrangler rollback <VERSION_ID>`.

The deployment credentials stay outside the static bundle. Original `.eml` files remain in browser memory until the user consents to submitting the signed contents to a public RPC and chain. A change of hosting origin starts a new browser-local repository bookmark list; on-chain bounties and wallet balances do not move.

## Maintained content

Edit `shared/documentation.mjs` and run `npm run docs:build`. `npm run docs:check` prevents website and repository guides from diverging. Contract deployment is a separate action described in [GNOSIS.md](GNOSIS.md); updating the website never redeploys contracts.

References: [Static Assets](https://developers.cloudflare.com/workers/static-assets/), [Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/), [Wrangler authentication](https://developers.cloudflare.com/workers/wrangler/system-environment-variables/).
