#!/bin/bash
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y --no-install-recommends ca-certificates curl xz-utils caddy sqlite3 unattended-upgrades
NODE_VERSION=v24.21.0
TASK_NODE_DIR=$(mktemp -d)
cd "$TASK_NODE_DIR"
curl --fail --silent --show-error --location "https://nodejs.org/dist/$NODE_VERSION/node-$NODE_VERSION-linux-x64.tar.xz" -o node.tar.xz
curl --fail --silent --show-error --location "https://nodejs.org/dist/$NODE_VERSION/SHASUMS256.txt" -o SHASUMS256.txt
TASK_NODE_SHA=$(awk -v file="node-$NODE_VERSION-linux-x64.tar.xz" '$2 == file {print $1}' SHASUMS256.txt)
test ${#TASK_NODE_SHA} -eq 64
printf '%s  node.tar.xz\n' "$TASK_NODE_SHA" | sha256sum --check --status
tar -xJf node.tar.xz -C /usr/local --strip-components=1
cd /
rm -rf "$TASK_NODE_DIR"
groupadd --system issue-fund-ipc || true
id issue-fund >/dev/null 2>&1 || useradd --system --home /var/lib/issue-fund --shell /usr/sbin/nologin issue-fund
id issue-fund-signer >/dev/null 2>&1 || useradd --system --home /var/lib/issue-fund-signer --shell /usr/sbin/nologin issue-fund-signer
usermod -aG issue-fund-ipc issue-fund
usermod -aG issue-fund-ipc issue-fund-signer
install -d -m 0755 /opt/issue-fund/releases /etc/issue-fund
install -d -m 0700 -o issue-fund -g issue-fund /var/lib/issue-fund /etc/issue-fund/collector
install -d -m 0700 -o issue-fund-signer -g issue-fund-signer /var/lib/issue-fund-signer /etc/issue-fund/signer
install -d -m 0700 /var/backups/issue-fund
cat >/etc/ssh/sshd_config.d/50-issue-fund.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
EOF
sshd -t
systemctl reload ssh
cat >/etc/tmpfiles.d/issue-fund.conf <<'EOF'
d /run/issue-fund-ipc 2770 issue-fund-signer issue-fund-ipc -
EOF
systemd-tmpfiles --create /etc/tmpfiles.d/issue-fund.conf
cat >/etc/caddy/Caddyfile <<'EOF'
:80 {
  respond /healthz "issue.fund provisioning" 503
  respond "Not found" 404
}
EOF
systemctl enable --now caddy
systemctl reload caddy
systemctl enable --now unattended-upgrades
printf 'ready\n' >/var/lib/issue-fund-bootstrap-ready
