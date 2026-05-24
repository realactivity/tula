#!/usr/bin/env bash
set -euo pipefail

# Persist HEALTH_SKILLZ_BASE_URL for the OpenClaw systemd service.
# This survives daemon restarts and host reboots.

BASE_URL="${BASE_URL:-${1:-}}"
DROPIN_DIR="/etc/systemd/system/openclaw.service.d"
DROPIN_FILE="${DROPIN_DIR}/10-health-skillz-base-url.conf"

usage() {
  cat <<'EOF'
Usage:
  ./set-openclaw-health-skillz-env.sh <base_url>

Or:
  BASE_URL="https://your-hostname" ./set-openclaw-health-skillz-env.sh

Example:
  ./set-openclaw-health-skillz-env.sh "https://tula-vm.tail1234.ts.net:8000"

What this does:
  1) Writes a systemd drop-in for openclaw:
     /etc/systemd/system/openclaw.service.d/10-health-skillz-base-url.conf
  2) Runs systemctl daemon-reload
  3) Restarts openclaw
  4) Prints effective Environment for openclaw
EOF
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

if [[ -z "${BASE_URL}" ]]; then
  usage
  exit 1
fi

if ! command -v systemctl >/dev/null 2>&1; then
  echo "systemctl not found. This helper requires a systemd host." >&2
  exit 1
fi

if [[ ! "${BASE_URL}" =~ ^https?:// ]]; then
  echo "BASE_URL must start with http:// or https:// (received: ${BASE_URL})" >&2
  exit 1
fi

echo "Writing OpenClaw env override drop-in:"
echo "  ${DROPIN_FILE}"
echo

sudo mkdir -p "${DROPIN_DIR}"
sudo tee "${DROPIN_FILE}" >/dev/null <<EOF
[Service]
Environment="HEALTH_SKILLZ_BASE_URL=${BASE_URL}"
EOF

sudo systemctl daemon-reload
sudo systemctl restart openclaw

echo
echo "OpenClaw environment now includes:"
sudo systemctl show openclaw --property=Environment --no-pager

echo
echo "Done. HEALTH_SKILLZ_BASE_URL will persist across restarts/reboots."
