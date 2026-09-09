#!/bin/bash
set -euo pipefail
# Expects a root-owned release directory unpacked by the SSH deployer.
TASK_RELEASE_DIR=${1:?release path required}
case "$TASK_RELEASE_DIR" in /opt/issue-fund/releases/*) ;; *) exit 2;; esac
cd "$TASK_RELEASE_DIR"
chown root:root /etc/issue-fund
chmod 0755 /etc/issue-fund
npm ci --omit=dev --ignore-scripts --no-audit --no-fund
chown -R root:root "$TASK_RELEASE_DIR"
chmod -R go-w "$TASK_RELEASE_DIR"
/usr/local/bin/node --check automation/run.mjs
/usr/local/bin/node --check automation/run-signer.mjs
install -m 0644 ops/digitalocean/issue-fund.service /etc/systemd/system/
install -m 0644 ops/digitalocean/issue-fund-signer.service /etc/systemd/system/
install -m 0644 ops/digitalocean/issue-fund-backup.service /etc/systemd/system/
install -m 0644 ops/digitalocean/issue-fund-backup.timer /etc/systemd/system/
systemd-analyze verify /etc/systemd/system/issue-fund*.service /etc/systemd/system/issue-fund-backup.timer
ln -sfn "$TASK_RELEASE_DIR" /opt/issue-fund/next
mv -Tf /opt/issue-fund/next /opt/issue-fund/current
caddy validate --config ops/digitalocean/Caddyfile --adapter caddyfile
install -m 0644 ops/digitalocean/Caddyfile /etc/caddy/Caddyfile
systemctl daemon-reload
systemctl enable issue-fund.service issue-fund-signer.service issue-fund-backup.timer
systemctl restart issue-fund-signer.service
systemctl restart issue-fund.service
systemctl start issue-fund-backup.timer
systemctl reload caddy
for TASK_HEALTH_ATTEMPT in $(seq 1 15); do
  if systemctl is-active --quiet issue-fund issue-fund-signer && test -S /run/issue-fund-ipc/signer.sock && curl --fail --silent http://127.0.0.1:4320/healthz >/dev/null; then
    exit 0
  fi
  sleep 2
done
printf 'The release did not become healthy. Inspect the service journal.\n' >&2
exit 1
