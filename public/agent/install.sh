#!/bin/sh
# Web Monitor server agent installer (Linux, systemd, Python 3).
#   curl -fsSL https://webmonitor.ruyalab.com/agent/install.sh | sudo sh -s -- --token YOUR_TOKEN
#   ... | sudo sh -s -- --uninstall
# Options: --token T (required), --endpoint URL, --access-logs "glob,glob", --error-logs "glob,glob"
#
# What it does: downloads webmonitor-agent.py (checked against the SHA-256 below), creates the unprivileged user
# webmonitor-agent (member of the log group "adm" when it exists, so it can read web-server logs), writes
# /etc/webmonitor-agent.conf and a hardened systemd service. The agent only reads and sends; it never runs commands.
set -eu

BASE="https://webmonitor.ruyalab.com"
AGENT_SHA256="efef6c9b64bae9165c0f6ae4f7d11e07501addcb656cc6a73fcbe71aa2dfc78e"
TOKEN=""; ENDPOINT="$BASE/api/agent/ingest"; ACCESS=""; ERRORS=""; UNINSTALL=0
while [ $# -gt 0 ]; do
  case "$1" in
    --token) TOKEN="$2"; shift 2 ;;
    --endpoint) ENDPOINT="$2"; shift 2 ;;
    --access-logs) ACCESS="$2"; shift 2 ;;
    --error-logs) ERRORS="$2"; shift 2 ;;
    --uninstall) UNINSTALL=1; shift ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done

[ "$(id -u)" -eq 0 ] || { echo "Run as root (sudo)." >&2; exit 1; }

if [ "$UNINSTALL" -eq 1 ]; then
  systemctl disable --now webmonitor-agent 2>/dev/null || true
  rm -f /etc/systemd/system/webmonitor-agent.service /etc/webmonitor-agent.conf
  rm -rf /opt/webmonitor-agent /var/lib/webmonitor-agent
  systemctl daemon-reload 2>/dev/null || true
  id webmonitor-agent >/dev/null 2>&1 && userdel webmonitor-agent 2>/dev/null || true
  echo "Web Monitor agent removed."
  exit 0
fi

case "$TOKEN" in
  wma_*) ;;
  *) echo "Pass the agent token from Web Monitor: --token wma_..." >&2; exit 2 ;;
esac
command -v python3 >/dev/null 2>&1 || { echo "python3 is required (apt install python3 / dnf install python3)." >&2; exit 1; }
command -v systemctl >/dev/null 2>&1 || { echo "systemd is required." >&2; exit 1; }

TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT
if command -v curl >/dev/null 2>&1; then curl -fsSL "$BASE/agent/webmonitor-agent.py" -o "$TMP"; else wget -qO "$TMP" "$BASE/agent/webmonitor-agent.py"; fi
GOT=$(sha256sum "$TMP" | cut -d' ' -f1)
[ "$GOT" = "$AGENT_SHA256" ] || { echo "Checksum mismatch for webmonitor-agent.py ($GOT); not installing." >&2; exit 1; }

id webmonitor-agent >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin webmonitor-agent
getent group adm >/dev/null 2>&1 && usermod -aG adm webmonitor-agent || true

install -d -m 0755 /opt/webmonitor-agent
install -m 0755 "$TMP" /opt/webmonitor-agent/webmonitor-agent.py
install -d -o webmonitor-agent -g webmonitor-agent -m 0750 /var/lib/webmonitor-agent
umask 027
cat > /etc/webmonitor-agent.conf <<EOF
token=$TOKEN
endpoint=$ENDPOINT
access_logs=$ACCESS
error_logs=$ERRORS
EOF
chown root:webmonitor-agent /etc/webmonitor-agent.conf
chmod 0640 /etc/webmonitor-agent.conf

cat > /etc/systemd/system/webmonitor-agent.service <<'EOF'
[Unit]
Description=Web Monitor server agent (read-only metrics and log summaries)
After=network-online.target
Wants=network-online.target

[Service]
User=webmonitor-agent
Group=webmonitor-agent
SupplementaryGroups=adm
ExecStart=/usr/bin/env python3 /opt/webmonitor-agent/webmonitor-agent.py
Restart=always
RestartSec=30
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
PrivateTmp=yes
PrivateDevices=yes
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectControlGroups=yes
RestrictSUIDSGID=yes
LockPersonality=yes
ReadWritePaths=/var/lib/webmonitor-agent
CPUQuota=10%
MemoryMax=128M

[Install]
WantedBy=multi-user.target
EOF
getent group adm >/dev/null 2>&1 || sed -i '/^SupplementaryGroups=adm$/d' /etc/systemd/system/webmonitor-agent.service

# Log access. Debian / Ubuntu: the adm group can read web-server logs. RHEL / CentOS / Alma / Rocky often keep
# /var/log/httpd root-only and have no adm group: give the agent read-only access with ACLs (including a default ACL,
# so logs created by rotation stay readable). Only the log folders below are touched, and only to add read access.
can_read() { runuser -u webmonitor-agent -- test -r "$1" 2>/dev/null || su -s /bin/sh webmonitor-agent -c "test -r '$1'" 2>/dev/null; }
for dir in /var/log/nginx /var/log/apache2 /var/log/httpd; do
  [ -d "$dir" ] || continue
  unreadable=""
  for f in "$dir"/*access*log* "$dir"/*error*log*; do
    [ -f "$f" ] || continue
    can_read "$f" || unreadable="$unreadable $f"
  done
  [ -n "$unreadable" ] || continue
  if command -v setfacl >/dev/null 2>&1; then
    setfacl -m u:webmonitor-agent:rx "$dir" && setfacl -d -m u:webmonitor-agent:r "$dir" && setfacl -m u:webmonitor-agent:r "$dir"/*log* 2>/dev/null || true
    echo "Gave webmonitor-agent read-only access to $dir (ACL)."
  else
    echo "Note: webmonitor-agent cannot read$unreadable. Install the acl package and run:" >&2
    echo "  setfacl -m u:webmonitor-agent:rx $dir; setfacl -d -m u:webmonitor-agent:r $dir; setfacl -m u:webmonitor-agent:r $dir/*log*" >&2
  fi
done

systemctl daemon-reload
systemctl enable --now webmonitor-agent
sleep 3
if systemctl is-active --quiet webmonitor-agent; then
  echo "Web Monitor agent is running. The first full snapshot appears in Web Monitor within two minutes."
else
  echo "The service did not start; see: journalctl -u webmonitor-agent -n 50" >&2
  exit 1
fi
