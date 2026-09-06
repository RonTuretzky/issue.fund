# GitHub Pages hosting with Cloudflare DNS

[issue.fund](https://issue.fund) is a public static React application hosted by **GitHub Pages**. Cloudflare manages its DNS. It does not need a Cloudflare Worker, application server, database, or proving service. The browser reads GitHub's public API and the configured Gnosis RPC directly.

## GitHub configuration

Repository: [`RonTuretzky/issue.fund`](https://github.com/RonTuretzky/issue.fund).

In **Settings → Pages**, use **Deploy from a branch**, select **codex/pages** and **/ (root)**, and save. The custom domain is **issue.fund**. Enable **Enforce HTTPS** once GitHub finishes provisioning its certificate.

The publication branch contains only the built website, a `.nojekyll` marker to skip Jekyll, and a `CNAME` file containing `issue.fund`. Application source remains on `main`. GitHub's default Pages address redirects to the custom domain. The app uses hash routes, so documentation and bounty links do not require server-side routing rules.

## Cloudflare DNS configuration

Use **DNS only** (gray cloud) for these records so GitHub can validate the domain and issue its HTTPS certificate. TTL may be Auto.

| Type | Name | Target |
| --- | --- | --- |
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | ronturetzky.github.io |

The custom domain must be saved in GitHub Pages before pointing DNS to GitHub. The `www` record targets the GitHub account hostname, without a repository path; GitHub redirects it to the apex domain. Existing email, TXT and unrelated DNS records should be left intact.

Cloudflare permissions needed to manage these records are **Zone → DNS → Edit**, scoped to **issue.fund**. **Zone → Zone → Read** allows discovering the zone. No Workers or Pages account permission is needed for this setup.

## Publish changes

Use Node 22. Authenticate `gh` as the repository owner, or provide a suitably scoped `GH_TOKEN` through a secret manager or CI environment. Do not put credentials in source, CLI arguments, a `VITE_` variable or the deployment manifest.

```sh
npm ci --ignore-scripts
npm run docs:build   # after editing handbook content
npm run build:gnosis
# Commit the source changes so site-version.json identifies the release.
npm run deploy:pages
```

`deploy:pages` checks documentation, type-checks and builds the Gnosis app, then publishes `dist/` to `codex/pages` with a normal fast-forward Git commit. It uses a temporary checkout, preserves Git author/signing settings, and removes the checkout afterward. The script never publishes the source tree or local email files. `site-version.json` records the source commit for a deployed build.

The initial branch publication must exist before Pages can be enabled. Subsequent pushes rebuild the site automatically. Inspect the repository's Pages settings and deployment history if the site does not update. No Cloudflare DNS change is required for later releases.

## Verify and recover

Open [the documentation](https://issue.fund/#docs), [repositories](https://issue.fund/#repositories) and an existing bounty in a fresh browser. Confirm the network and contract addresses against `public/deployment.gnosis.json`. These checks need no wallet or transaction. Check `/site-version.json` to identify the published source.

To roll back the website, revert the source change on `main`, rebuild, and run `npm run deploy:pages`. Website deployment never moves funds or redeploys contracts. Domain and certificate setup may take time to propagate; do not bypass certificate validation. Before disabling Pages or removing its custom domain, remove or repoint the corresponding DNS records.

A change of hosting origin starts a new browser-local repository bookmark list. On-chain bounties and wallet balances stay in the same Gnosis contracts. Original `.eml` files remain in browser memory until the user consents to submitting the signed contents to a public RPC and chain.

The [previous Sites preview](https://mergebounty-gnosis.turetzkyron.chatgpt.site) is a separate publication and is not automatically updated by `deploy:pages`.

References: [GitHub custom domains and DNS values](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site), [GitHub Pages publishing sources](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site), [Cloudflare DNS records](https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/).
