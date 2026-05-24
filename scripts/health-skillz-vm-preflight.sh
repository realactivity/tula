#!/usr/bin/env bash
set -euo pipefail

# Read-only readiness check for hosting jmandel/health-skillz on an OpenClaw VM.
# This script does not modify system state.

BASE_URL="${BASE_URL:-}"
PORT="${PORT:-8000}"
TAILSCALE_HOST="${TAILSCALE_HOST:-}"

ok() { printf '[ok] %s\n' "$1"; }
warn() { printf '[warn] %s\n' "$1"; }
err() { printf '[error] %s\n' "$1"; }

check_bin() {
  local bin="$1"
  if command -v "$bin" >/dev/null 2>&1; then
    ok "Found $bin: $(command -v "$bin")"
  else
    err "Missing required binary: $bin"
    return 1
  fi
}

EXIT_CODE=0

echo "== health-skillz VM preflight =="
echo "PORT=${PORT}"
[[ -n "${BASE_URL}" ]] && echo "BASE_URL=${BASE_URL}" || echo "BASE_URL=<not-set>"
[[ -n "${TAILSCALE_HOST}" ]] && echo "TAILSCALE_HOST=${TAILSCALE_HOST}" || true
echo

check_bin node || EXIT_CODE=1
check_bin bun || EXIT_CODE=1
check_bin zip || EXIT_CODE=1
check_bin git || EXIT_CODE=1
check_bin systemctl || EXIT_CODE=1
check_bin curl || EXIT_CODE=1

echo
echo "== runtime checks =="
if node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 20 ? 0 : 1)"; then
  ok "Node version is >= 20 ($(node --version))"
else
  err "Node version must be >= 20 for current Tula app stack. Found $(node --version)"
  EXIT_CODE=1
fi

if bun --version >/dev/null 2>&1; then
  ok "Bun version $(bun --version)"
fi

if systemctl is-system-running >/dev/null 2>&1; then
  ok "systemd available and running"
else
  warn "systemd is present but reports non-running state; verify service control permissions"
fi

echo
echo "== network posture checks =="
if ss -ltn | awk '{print $4}' | grep -E "(^|:)${PORT}$" >/dev/null 2>&1; then
  warn "Port ${PORT} already has a listener. Pick a different port or stop the existing service."
else
  ok "Port ${PORT} appears free"
fi

if command -v tailscale >/dev/null 2>&1; then
  ok "Tailscale CLI installed"
  if tailscale status >/dev/null 2>&1; then
    ok "Tailscale daemon reachable"
  else
    warn "Tailscale CLI exists but daemon/status check failed"
  fi
else
  warn "Tailscale not installed. Private-only access is still recommended for PHI workloads."
fi

if [[ -n "${BASE_URL}" ]]; then
  if [[ "${BASE_URL}" =~ ^https:// ]]; then
    ok "BASE_URL uses HTTPS (${BASE_URL})"
  else
    warn "BASE_URL should use HTTPS for SMART OAuth callbacks (${BASE_URL})"
  fi
fi

echo
if [[ "${EXIT_CODE}" -eq 0 ]]; then
  ok "Preflight passed. Safe to proceed with install script."
else
  err "Preflight failed. Fix errors above before install."
fi

exit "${EXIT_CODE}"
