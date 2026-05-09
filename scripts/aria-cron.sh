#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# aria-cron.sh — non-interactive wrapper around aria-backup.sh.
# ---------------------------------------------------------------------------
#
# ============================== AGENTS.md ===================================
# # aria-cron.sh
#
# ## Purpose
# Glue script that lets `aria-backup.sh` run safely from cron (or any other
# non-interactive scheduler). Cron's environment is minimal — no PATH past
# /usr/bin:/bin, no env vars from your shell — so we explicitly source the
# token, set PATH, acquire a lock, and log everything.
#
# Cron should call THIS script, not `aria-backup.sh` directly.
#
# ## Concerns this handles
# - **Auth**: sources `~/.aria-cron-token` (mode 600), which sets GITHUB_TOKEN.
#   `aria-backup.sh` consumes GITHUB_TOKEN as a one-shot push credential and
#   does not persist it.
# - **Concurrency**: uses `flock -n` against `/tmp/aria-backup.lock` so a
#   slow backup never overlaps the next cron tick.
# - **Logging**: appends stdout+stderr to `~/aria-backup.log`. Truncates the
#   log if it exceeds LOG_MAX_BYTES so it can't fill the disk.
# - **PATH**: forces a sane PATH so `git`, `rsync`, `python3`, `curl` resolve.
# - **Exit propagation**: exits with the backup script's exit code. cron MTAs
#   (or any external monitor) can spot non-zero exits and alert.
#
# ## Inputs
# - `~/.aria-cron-token` — required. A `KEY=VALUE` file. Must define
#   `GITHUB_TOKEN=<fine-grained-PAT>`. Mode must be 600 (this script will
#   refuse to source it otherwise).
# - All env vars consumed by `aria-backup.sh` are honored if exported here
#   first (e.g. `ARIA_REPO_DIR`).
#
# ## Crontab line
#   CRON_TZ=America/New_York
#   0 3 * * * /home/azureuser/aria-repo/scripts/aria-cron.sh
#
# ## Manual test (one-shot)
#   /home/azureuser/aria-repo/scripts/aria-cron.sh && tail -n 30 ~/aria-backup.log
#
# ## Where logs go
#   ~/aria-backup.log    appended-to on every run, truncated at LOG_MAX_BYTES.
#
# ## Adding a different scheduler
# If you ever move off cron (systemd timer, GitHub Actions runner, etc.) the
# only contract this script depends on is: a Bourne shell, a token file at
# `~/.aria-cron-token`, and write access to `~/aria-backup.log`. Everything
# else is self-contained.
# ============================ END AGENTS.md =================================

set -euo pipefail

# ---------- configuration --------------------------------------------------

TOKEN_FILE="${ARIA_TOKEN_FILE:-$HOME/.aria-cron-token}"
LOCK_FILE="${ARIA_LOCK_FILE:-/tmp/aria-backup.lock}"
LOG_FILE="${ARIA_LOG_FILE:-$HOME/aria-backup.log}"
LOG_MAX_BYTES=${ARIA_LOG_MAX_BYTES:-1048576}   # 1 MiB
BACKUP_SCRIPT="${ARIA_BACKUP_SCRIPT:-$HOME/aria-repo/aria-backup.sh}"

export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

# ---------- log rotation (truncate if too big) -----------------------------

if [[ -f "$LOG_FILE" ]]; then
    size=$(stat -c%s "$LOG_FILE" 2>/dev/null || echo 0)
    if (( size > LOG_MAX_BYTES )); then
        # Keep the last 200 lines, drop the rest.
        tail -n 200 "$LOG_FILE" > "${LOG_FILE}.tmp" && mv "${LOG_FILE}.tmp" "$LOG_FILE"
    fi
fi

# ---------- redirect everything to the log ---------------------------------

exec >>"$LOG_FILE" 2>&1
echo ""
echo "============================================================"
echo "[aria-cron] $(date -u '+%Y-%m-%d %H:%M:%SZ') — start"
echo "============================================================"

# ---------- preflight ------------------------------------------------------

if [[ ! -x "$BACKUP_SCRIPT" ]]; then
    echo "[aria-cron] ERROR: backup script not found or not executable: $BACKUP_SCRIPT"
    exit 1
fi

if [[ ! -f "$TOKEN_FILE" ]]; then
    echo "[aria-cron] ERROR: token file not found: $TOKEN_FILE"
    echo "[aria-cron] create it with:"
    echo "[aria-cron]   echo 'GITHUB_TOKEN=ghp_...' > $TOKEN_FILE && chmod 600 $TOKEN_FILE"
    exit 1
fi

# Refuse to source a token file with loose permissions (group/other readable).
mode=$(stat -c%a "$TOKEN_FILE")
if [[ "$mode" != "600" && "$mode" != "400" ]]; then
    echo "[aria-cron] ERROR: token file has insecure mode $mode (need 600 or 400)"
    echo "[aria-cron] fix with: chmod 600 $TOKEN_FILE"
    exit 1
fi

# ---------- source token ---------------------------------------------------

set -a   # auto-export everything sourced
# shellcheck source=/dev/null
. "$TOKEN_FILE"
set +a

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
    echo "[aria-cron] ERROR: $TOKEN_FILE did not set GITHUB_TOKEN"
    exit 1
fi

# ---------- run under flock ------------------------------------------------

# `flock -n` returns immediately if the lock is held; perfect for cron — the
# next tick will retry rather than queueing up backups.
exec flock -n "$LOCK_FILE" "$BACKUP_SCRIPT" "$@"
