#!/usr/bin/env bash
set -euo pipefail

# Install and configure jmandel/health-skillz on an OpenClaw VM.
# This script is intended to run ON the VM.

REPO_URL="${REPO_URL:-https://github.com/jmandel/health-skillz.git}"
INSTALL_DIR="${INSTALL_DIR:-$HOME/health-skillz}"
CONFIG_FILE="${CONFIG_FILE:-config.openclaw.json}"
SERVICE_NAME="${SERVICE_NAME:-health-skillz}"
PORT="${PORT:-8000}"
BASE_URL="${BASE_URL:-}"
CLIENT_ID="${CLIENT_ID:-}"
SCOPE_SET="${SCOPE_SET:-patient/*.rs}"
BRAND_FILE="${BRAND_FILE:-./brands/epic-sandbox.json}"
BRAND_NAME="${BRAND_NAME:-epic-sandbox}"
TAILSCALE_ONLY="${TAILSCALE_ONLY:-1}"

usage() {
  cat <<'EOF'
Usage:
  BASE_URL="https://<your-url>" CLIENT_ID="<epic-client-id>" ./install-health-skillz-vm.sh

Optional environment variables:
  REPO_URL, INSTALL_DIR, CONFIG_FILE, SERVICE_NAME, PORT,
  CLIENT_ID, SCOPE_SET, BRAND_FILE, BRAND_NAME, TAILSCALE_ONLY

Notes:
  - BASE_URL and CLIENT_ID are required.
  - BASE_URL must match Epic SMART redirect/JWKS registration.
  - This script creates a systemd unit and starts the service.
EOF
}

if [[ "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ -z "${BASE_URL}" || -z "${CLIENT_ID}" ]]; then
  usage
  exit 1
fi

need_bin() {
  local b="$1"
  command -v "$b" >/dev/null 2>&1 || {
    echo "Missing required binary: $b" >&2
    exit 1
  }
}

need_bin git
need_bin bun
need_bin node
need_bin zip
need_bin systemctl

echo "== install health-skillz on VM =="
echo "INSTALL_DIR=${INSTALL_DIR}"
echo "BASE_URL=${BASE_URL}"
echo "PORT=${PORT}"
echo "SERVICE_NAME=${SERVICE_NAME}"
echo

if [[ ! -d "${INSTALL_DIR}/.git" ]]; then
  git clone "${REPO_URL}" "${INSTALL_DIR}"
else
  git -C "${INSTALL_DIR}" pull --ff-only
fi

cd "${INSTALL_DIR}"
bun install

mkdir -p data static brands
bun run build:brands
bun run generate-jwks
ln -snf "$(pwd)/brands" static/brands

cat > "${CONFIG_FILE}" <<EOF
{
  "server": {
    "port": ${PORT},
    "baseURL": "${BASE_URL}"
  },
  "brands": [
    {
      "name": "${BRAND_NAME}",
      "file": "${BRAND_FILE}",
      "clientId": "${CLIENT_ID}",
      "scopes": "${SCOPE_SET}",
      "redirectURL": "${BASE_URL}/connect/callback",
      "tags": ["epic", "sandbox", "openclaw-vm"]
    }
  ],
  "session": {
    "timeoutMinutes": 60
  }
}
EOF

SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

sudo tee "${SERVICE_FILE}" >/dev/null <<EOF
[Unit]
Description=health-skillz REST service for OpenClaw VM
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${USER}
Group=${USER}
WorkingDirectory=${INSTALL_DIR}
Environment=CONFIG_PATH=${INSTALL_DIR}/${CONFIG_FILE}
Environment=PORT=${PORT}
Environment=NODE_ENV=production
Environment=ENABLE_TEST_PROVIDER=false
ExecStart=/usr/bin/env bun run start
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

if [[ "${TAILSCALE_ONLY}" == "1" ]]; then
  echo "Applying optional host firewall hardening for private-only access."
  if command -v ufw >/dev/null 2>&1; then
    sudo ufw allow 22/tcp >/dev/null 2>&1 || true
    sudo ufw deny "${PORT}"/tcp >/dev/null 2>&1 || true
  fi
fi

sudo systemctl daemon-reload
sudo systemctl enable --now "${SERVICE_NAME}"

echo
echo "== health checks =="
curl -fsS "http://127.0.0.1:${PORT}/health" || {
  echo "Local health check failed. See logs: journalctl -u ${SERVICE_NAME} -n 100 --no-pager" >&2
  exit 1
}
echo "Local /health OK"

echo
echo "Done."
echo "Service logs: journalctl -u ${SERVICE_NAME} -f"
echo "Config file: ${INSTALL_DIR}/${CONFIG_FILE}"
echo "Remember to set HEALTH_SKILLZ_BASE_URL=${BASE_URL} in OpenClaw runtime environment."
