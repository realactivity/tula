#!/usr/bin/env bash
#
# deprovision.sh — scrub a Tula source VM for image capture.
#
# This script transforms a fully-configured, possibly-Paul-personal source
# VM into a generalized tenant-template state, ready for `az vm generalize`
# and `az image create`. It is the operator's last step before image capture.
#
# Idempotent: safe to run twice (the second run is a no-op for already-cleared
# items).
#
# Safety:
#   - Refuses to run on a tenant VM (hostname matches `tula-tenant-*`).
#   - Refuses to run without `--confirm` to prevent accidental invocation.
#   - `--dry-run` prints the plan without making changes.
#   - Logs every action to /var/log/tula-deprovision-<timestamp>.log.
#   - Final secret-scan exits non-zero if anything looks like a key.
#
# License: Apache-2.0 (inherited from the Tula repository).
#
# See companion spec: ~/.openclaw/workspace/docs/TENANT_TEMPLATE_BUILD.md
#

set -euo pipefail

# -------------------------------------------------------------------------
# Configuration
# -------------------------------------------------------------------------

TULA_HOME="${TULA_HOME:-/home/azureuser/tula}"
OPENCLAW_HOME="${OPENCLAW_HOME:-/home/azureuser/.openclaw}"
WORKSPACE="$OPENCLAW_HOME/workspace"
ARIA_REPO="${ARIA_REPO:-/home/azureuser/aria-repo}"
TEMPLATE_VERSION="${TEMPLATE_VERSION:-}"

TIMESTAMP="$(date -u +%Y%m%d-%H%M%S)"
LOG_FILE="/var/log/tula-deprovision-${TIMESTAMP}.log"

DRY_RUN=0
CONFIRM=0

# -------------------------------------------------------------------------
# Argument parsing
# -------------------------------------------------------------------------

usage() {
    cat <<EOF
Usage: $0 [--dry-run] [--confirm] [--version <X.Y.Z>]

Options:
  --dry-run           Print the plan; do not modify anything.
  --confirm           Required to actually perform the scrub.
  --version <X.Y.Z>   Tag the image with this version (default: from \$TEMPLATE_VERSION env).
  -h, --help          Print this help.

This script must be run with sudo. It scrubs the calling VM for image
capture. See ~/.openclaw/workspace/docs/TENANT_TEMPLATE_BUILD.md § 5.
EOF
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --dry-run) DRY_RUN=1; shift ;;
        --confirm) CONFIRM=1; shift ;;
        --version) TEMPLATE_VERSION="$2"; shift 2 ;;
        -h|--help) usage; exit 0 ;;
        *) echo "Unknown arg: $1" >&2; usage; exit 2 ;;
    esac
done

# -------------------------------------------------------------------------
# Pre-flight checks
# -------------------------------------------------------------------------

if [[ "$EUID" -ne 0 ]] && [[ "$DRY_RUN" -eq 0 ]]; then
    echo "ERROR: must run with sudo (not dry-run)" >&2
    exit 1
fi

CURRENT_HOSTNAME="$(hostname)"
if [[ "$CURRENT_HOSTNAME" =~ ^tula-tenant- ]]; then
    cat >&2 <<EOF
ERROR: this host is named "$CURRENT_HOSTNAME", which matches the tenant
naming pattern (tula-tenant-*). This script refuses to run on a tenant
VM — doing so would destroy a live patient's record.

If you are sure this is a misnamed bake host, rename it first:
    sudo hostnamectl set-hostname tula-bake-vm
EOF
    exit 1
fi

if [[ "$CONFIRM" -eq 0 ]] && [[ "$DRY_RUN" -eq 0 ]]; then
    cat >&2 <<EOF
ERROR: missing --confirm. This script makes destructive changes. To proceed:
    sudo $0 --confirm

To preview without changes:
    $0 --dry-run
EOF
    exit 1
fi

if [[ -z "$TEMPLATE_VERSION" ]] && [[ "$DRY_RUN" -eq 0 ]]; then
    echo "WARNING: no --version given; will stamp as 'untagged-${TIMESTAMP}'" >&2
    TEMPLATE_VERSION="untagged-${TIMESTAMP}"
fi

# -------------------------------------------------------------------------
# Logging helpers
# -------------------------------------------------------------------------

if [[ "$DRY_RUN" -eq 0 ]]; then
    touch "$LOG_FILE"
    chmod 644 "$LOG_FILE"
    exec > >(tee -a "$LOG_FILE") 2>&1
fi

log() {
    local prefix="[$(date -u +%H:%M:%S)]"
    if [[ "$DRY_RUN" -eq 1 ]]; then
        echo "$prefix [DRY-RUN] $*"
    else
        echo "$prefix $*"
    fi
}

run() {
    log "RUN: $*"
    if [[ "$DRY_RUN" -eq 0 ]]; then
        eval "$@"
    fi
}

# Apparent owner of $HOME — needed because we may be invoked via sudo and
# need to drop privileges for non-root scrubs.
TARGET_USER="azureuser"
TARGET_HOME="/home/$TARGET_USER"

# -------------------------------------------------------------------------
# Step 1 — stop running services
# -------------------------------------------------------------------------

step_1_stop_services() {
    log "==== Step 1: stop services ===="
    run "systemctl stop aria-backup.timer 2>/dev/null || true"
    run "systemctl stop aria-backup-notify.service 2>/dev/null || true"
    run "systemctl stop openclaw-gateway.service 2>/dev/null || true"
    run "systemctl stop openclaw-chat.service 2>/dev/null || true"
    # Kill any user-space openclaw / claude / codex / next-server processes.
    run "pkill -u $TARGET_USER -f 'openclaw|claude --|codex|next-server' 2>/dev/null || true"
    sleep 1
}

# -------------------------------------------------------------------------
# Step 2 — disable services that the tenant will re-enable
# -------------------------------------------------------------------------

step_2_disable_services() {
    log "==== Step 2: disable per-tenant services ===="
    run "systemctl disable aria-backup.timer 2>/dev/null || true"
    run "systemctl disable openclaw-gateway.service 2>/dev/null || true"
    run "systemctl disable openclaw-chat.service 2>/dev/null || true"
}

# -------------------------------------------------------------------------
# Step 3 — replace identity files with templates
# -------------------------------------------------------------------------

step_3_reset_identity() {
    log "==== Step 3: reset tenant identity files ===="
    local templates_src="$TULA_HOME/templates"
    if [[ ! -d "$templates_src" ]]; then
        log "WARNING: templates directory $templates_src does not exist; skipping identity reset"
        return
    fi

    # MEMORY.md, USER.md — replace with template versions
    for f in MEMORY.template.md USER.template.md profile.template.yaml; do
        local target="${f%.template.*}.${f##*.}"
        # The templates are named MEMORY.template.md, USER.template.md, profile.template.yaml
        case "$f" in
            MEMORY.template.md)         target="MEMORY.md" ;;
            USER.template.md)           target="USER.md" ;;
            profile.template.yaml)      target="memory/profile.yaml" ;;
        esac
        local src="$templates_src/$f"
        local dst="$WORKSPACE/$target"
        if [[ -f "$src" ]]; then
            run "mkdir -p \"$(dirname \"$dst\")\""
            run "cp \"$src\" \"$dst\""
            run "chown $TARGET_USER:$TARGET_USER \"$dst\""
        fi
    done

    # IDENTITY.md — replace with the canonical template version
    if [[ -f "$templates_src/IDENTITY.template.md" ]]; then
        run "cp \"$templates_src/IDENTITY.template.md\" \"$WORKSPACE/IDENTITY.md\""
    fi

    # HEARTBEAT.md — clear, leave the file empty/comment-only
    run "echo '# HEARTBEAT.md — empty by default; tenant configures via heartbeat skill or onboarding.' > \"$WORKSPACE/HEARTBEAT.md\""

    # memory/*.md — clear daily logs
    run "rm -rf \"$WORKSPACE/memory\"/*.md 2>/dev/null || true"
    run "rm -f \"$WORKSPACE/memory/heartbeat-state.json\" 2>/dev/null || true"
}

# -------------------------------------------------------------------------
# Step 4 — clear PHI caches
# -------------------------------------------------------------------------

step_4_clear_phi_caches() {
    log "==== Step 4: clear PHI caches ===="
    for dir in \
        "$WORKSPACE/.health-records-cache" \
        "$WORKSPACE/.med-pdf-cache" \
        "$WORKSPACE/.myhealth-pulse-cache" \
        "$WORKSPACE/tula/fhir" \
        "$WORKSPACE/pmv-review" \
        "$WORKSPACE/pmv-verify" \
        "$WORKSPACE/my-aria-screenshots" \
        "$WORKSPACE/amendment-output" \
        "$WORKSPACE/amendments"; do
        if [[ -d "$dir" ]]; then
            run "rm -rf \"$dir\""
        fi
    done
}

# -------------------------------------------------------------------------
# Step 5 — clear loose files in workspace root (preserve curated docs)
# -------------------------------------------------------------------------

step_5_clear_workspace_root_loose() {
    log "==== Step 5: clear loose files in workspace root ===="
    # Files we explicitly keep in the image:
    local KEEP_PATTERN='^(SOUL|AGENTS|MEMORY|USER|IDENTITY|TOOLS|HEARTBEAT|TRADEMARK|NOTICE)\.md$|^docs$|^skills$|^memory$|^claude$'
    # Anything else at workspace root is fair game
    if [[ -d "$WORKSPACE" ]]; then
        cd "$WORKSPACE"
        for entry in *; do
            [[ "$entry" == "*" ]] && break  # empty dir
            if echo "$entry" | grep -qE "$KEEP_PATTERN"; then
                continue
            fi
            run "rm -rf \"$WORKSPACE/$entry\""
        done
        cd - >/dev/null
    fi
}

# -------------------------------------------------------------------------
# Step 6 — wipe media folders
# -------------------------------------------------------------------------

step_6_wipe_media() {
    log "==== Step 6: wipe inbound/outbound media ===="
    run "rm -rf \"$OPENCLAW_HOME/media/inbound\"/* 2>/dev/null || true"
    run "rm -rf \"$OPENCLAW_HOME/media/outbound\"/* 2>/dev/null || true"
}

# -------------------------------------------------------------------------
# Step 7 — wipe sessions / runs / state
# -------------------------------------------------------------------------

step_7_wipe_sessions() {
    log "==== Step 7: wipe openclaw sessions and runs ===="
    run "rm -rf \"$OPENCLAW_HOME/sessions\"/* 2>/dev/null || true"
    run "rm -rf \"$OPENCLAW_HOME/runs\"/* 2>/dev/null || true"
    run "rm -f  \"$OPENCLAW_HOME/state.json\" 2>/dev/null || true"
}

# -------------------------------------------------------------------------
# Step 8 — wipe cron state
# -------------------------------------------------------------------------

step_8_wipe_cron() {
    log "==== Step 8: wipe openclaw cron state ===="
    run "rm -f  \"$OPENCLAW_HOME/cron/state.json\" 2>/dev/null || true"
    run "rm -rf \"$OPENCLAW_HOME/cron/runs\" 2>/dev/null || true"
}

# -------------------------------------------------------------------------
# Step 9 — sanitize openclaw.json (strip tokens, keep schema)
# -------------------------------------------------------------------------

step_9_sanitize_openclaw_config() {
    log "==== Step 9: sanitize openclaw config ===="
    local cfg="$OPENCLAW_HOME/openclaw.json"
    if [[ -f "$cfg" ]]; then
        if [[ "$DRY_RUN" -eq 1 ]]; then
            log "(would sanitize $cfg via python3)"
        else
            python3 - "$cfg" <<'PYEOF'
import json, sys, copy
path = sys.argv[1]
with open(path) as f:
    cfg = json.load(f)

SENSITIVE_VALUE_KEYS = {
    "apiKey", "token", "botToken", "accessToken", "refreshToken",
    "secret", "clientSecret", "webhookSecret", "appPassword",
    "password", "credentials"
}

def scrub(obj, path_str=""):
    if isinstance(obj, dict):
        for k in list(obj.keys()):
            full = f"{path_str}.{k}" if path_str else k
            if k in SENSITIVE_VALUE_KEYS:
                # Wipe value; keep key for schema clarity
                if isinstance(obj[k], dict):
                    scrub(obj[k], full)
                else:
                    obj[k] = ""
            else:
                scrub(obj[k], full)
    elif isinstance(obj, list):
        for item in obj:
            scrub(item, path_str)

scrub(cfg)

# Also clear accounts.*.credentials by-name
accts = cfg.get("messages", {}).get("accounts", [])
for acct in accts if isinstance(accts, list) else []:
    if isinstance(acct, dict) and "credentials" in acct:
        if isinstance(acct["credentials"], dict):
            for k in list(acct["credentials"].keys()):
                acct["credentials"][k] = ""

with open(path, "w") as f:
    json.dump(cfg, f, indent=2)

print(f"sanitized {path}", file=sys.stderr)
PYEOF
        fi
    fi
}

# -------------------------------------------------------------------------
# Step 10 — clear any .env / .env.local files inside app subtrees
# -------------------------------------------------------------------------

step_10_clear_env_files() {
    log "==== Step 10: clear app .env files ===="
    # Find .env.local / .env files in tula/apps/* and truncate
    if [[ -d "$TULA_HOME/apps" ]]; then
        while IFS= read -r f; do
            run "truncate -s 0 \"$f\""
        done < <(find "$TULA_HOME/apps" -maxdepth 3 -name '.env.local' -o -name '.env' 2>/dev/null)
    fi
}

# -------------------------------------------------------------------------
# Step 11 — preserved (no-op; sensible openclaw defaults stay in image)
# -------------------------------------------------------------------------

# Step 12 — clear aria-backup local state
step_12_clear_aria_backup() {
    log "==== Step 12: clear aria-backup local clone ===="
    if [[ -d "$ARIA_REPO" ]]; then
        run "rm -rf \"$ARIA_REPO\""
    fi
}

# -------------------------------------------------------------------------
# Step 13 — clear coding-agent state (preserve global config)
# -------------------------------------------------------------------------

step_13_clear_coding_agents() {
    log "==== Step 13: clear coding-agent state ===="
    # Claude: keep settings.json (the global model config), nuke any per-conversation data
    run "rm -rf \"$TARGET_HOME/.claude/projects\" 2>/dev/null || true"
    run "rm -rf \"$TARGET_HOME/.claude/conversations\" 2>/dev/null || true"
    run "rm -rf \"$TARGET_HOME/.claude/sessions\" 2>/dev/null || true"
    run "rm -rf \"$TARGET_HOME/.claude/shell-snapshots\" 2>/dev/null || true"
    # Codex
    run "rm -rf \"$TARGET_HOME/.codex/sessions\" 2>/dev/null || true"
    run "rm -rf \"$TARGET_HOME/.codex/conversations\" 2>/dev/null || true"
    # OpenCode (if present)
    run "rm -rf \"$TARGET_HOME/.opencode\" 2>/dev/null || true"
}

# -------------------------------------------------------------------------
# Step 14 — clear shell history
# -------------------------------------------------------------------------

step_14_clear_shell_history() {
    log "==== Step 14: clear shell history ===="
    for f in .bash_history .zsh_history .python_history .lesshst .wget-hsts .node_repl_history; do
        run "rm -f \"$TARGET_HOME/$f\" 2>/dev/null || true"
    done
    # Also for root, in case any sudo commands left a trail
    for f in .bash_history .python_history; do
        run "rm -f \"/root/$f\" 2>/dev/null || true"
    done
}

# -------------------------------------------------------------------------
# Step 15 — rotate and vacuum logs
# -------------------------------------------------------------------------

step_15_clear_logs() {
    log "==== Step 15: rotate and vacuum journals and logs ===="
    run "journalctl --rotate"
    run "journalctl --vacuum-time=1s"
    # Truncate (not delete — keeps logrotate happy) common log files
    for f in /var/log/auth.log /var/log/syslog /var/log/dpkg.log /var/log/apt/history.log /var/log/apt/term.log /var/log/cloud-init.log /var/log/cloud-init-output.log; do
        if [[ -f "$f" ]]; then
            run "truncate -s 0 \"$f\""
        fi
    done
    # Specifically nuke any tula-deprovision logs except this one
    for f in /var/log/tula-deprovision-*.log; do
        [[ "$f" == "$LOG_FILE" ]] && continue
        [[ -f "$f" ]] && run "rm -f \"$f\""
    done
}

# -------------------------------------------------------------------------
# Step 16 — clear machine-id (waagent will regenerate)
# -------------------------------------------------------------------------

step_16_clear_machine_id() {
    log "==== Step 16: clear machine-id ===="
    run "truncate -s 0 /etc/machine-id"
    run "rm -f /var/lib/dbus/machine-id"
    run "ln -sf /etc/machine-id /var/lib/dbus/machine-id"
}

# -------------------------------------------------------------------------
# Step 17 — remove SSH host keys (waagent regenerates)
# -------------------------------------------------------------------------

step_17_remove_ssh_host_keys() {
    log "==== Step 17: remove SSH host keys ===="
    run "rm -f /etc/ssh/ssh_host_*"
}

# -------------------------------------------------------------------------
# Step 18 — clear ops authorized_keys
# -------------------------------------------------------------------------

step_18_clear_authorized_keys() {
    log "==== Step 18: clear ops authorized_keys (cloud-init re-injects) ===="
    run "truncate -s 0 \"$TARGET_HOME/.ssh/authorized_keys\""
}

# -------------------------------------------------------------------------
# Step 19 — apt clean
# -------------------------------------------------------------------------

step_19_apt_clean() {
    log "==== Step 19: apt clean ===="
    run "apt-get clean"
}

# -------------------------------------------------------------------------
# Step 20 — clear /tmp and /var/tmp
# -------------------------------------------------------------------------

step_20_clear_tmp() {
    log "==== Step 20: clear /tmp and /var/tmp ===="
    run "find /tmp -mindepth 1 -delete 2>/dev/null || true"
    run "find /var/tmp -mindepth 1 -delete 2>/dev/null || true"
}

# -------------------------------------------------------------------------
# Step 22 — final secret scan
# -------------------------------------------------------------------------

step_22_secret_scan() {
    log "==== Step 22: final secret-pattern scan ===="
    # Patterns that should never appear in a baked image
    # NB: kept reasonably tight to avoid false positives in code samples
    local patterns=(
        'sk-ant-[A-Za-z0-9_-]{20,}'      # Anthropic
        'sk-proj-[A-Za-z0-9_-]{20,}'     # OpenAI project-scoped
        'xai-[A-Za-z0-9]{20,}'           # xAI
        'elabs[-_][A-Za-z0-9_-]{20,}'    # ElevenLabs (best-effort)
        'ghp_[A-Za-z0-9]{36}'            # GitHub classic PAT
        'github_pat_[A-Za-z0-9_]{60,}'   # GitHub fine-grained PAT
        '[0-9]{9,10}:AAH[A-Za-z0-9_-]{30,}'  # Telegram bot token
        'AKIA[0-9A-Z]{16}'               # AWS access key
    )
    local found=0
    for pat in "${patterns[@]}"; do
        # Scan workspace, tula source tree, openclaw config, root home — fast paths
        local hits
        hits=$(grep -rIE "$pat" "$WORKSPACE" "$TULA_HOME" "$OPENCLAW_HOME" 2>/dev/null | grep -vE '\.git/|node_modules/|\.next/' | head -20 || true)
        if [[ -n "$hits" ]]; then
            log "POSSIBLE SECRET LEAK matching pattern: $pat"
            echo "$hits" | head -5
            found=1
        fi
    done
    if [[ "$found" -eq 1 ]]; then
        log "ERROR: secret-scan FAILED — review above and re-run after cleanup"
        return 1
    else
        log "secret-scan: clean"
        return 0
    fi
}

# -------------------------------------------------------------------------
# Step 23 — stamp the image
# -------------------------------------------------------------------------

step_23_stamp_image() {
    log "==== Step 23: stamp image with provenance ===="
    local stamp_file="/etc/tula-template-version"
    local tula_git_sha="unknown"
    local tula_git_tag="unknown"
    if [[ -d "$TULA_HOME/.git" ]]; then
        tula_git_sha=$(sudo -u "$TARGET_USER" git -C "$TULA_HOME" rev-parse HEAD 2>/dev/null || echo unknown)
        tula_git_tag=$(sudo -u "$TARGET_USER" git -C "$TULA_HOME" describe --tags --always 2>/dev/null || echo unknown)
    fi
    local openclaw_ver="unknown"
    if command -v openclaw >/dev/null 2>&1; then
        openclaw_ver=$(openclaw --version 2>/dev/null | head -1 || echo unknown)
    fi
    local node_ver
    node_ver=$(node --version 2>/dev/null || echo unknown)

    if [[ "$DRY_RUN" -eq 1 ]]; then
        log "(would write $stamp_file with version=$TEMPLATE_VERSION, tula-git-sha=$tula_git_sha)"
        return
    fi

    cat > "$stamp_file" <<EOF
# Tula tenant-template image provenance
version=$TEMPLATE_VERSION
baked-at=$(date -u +%FT%TZ)
tula-git-sha=$tula_git_sha
tula-git-tag=$tula_git_tag
openclaw-version=$openclaw_ver
node-version=$node_ver
deprovision-log=$LOG_FILE
EOF
    chmod 644 "$stamp_file"
    log "wrote $stamp_file"
}

# -------------------------------------------------------------------------
# Main
# -------------------------------------------------------------------------

main() {
    log "tula-deprovision starting"
    log "  host: $CURRENT_HOSTNAME"
    log "  user: $TARGET_USER"
    log "  template version: $TEMPLATE_VERSION"
    log "  dry-run: $DRY_RUN"
    log "  confirm: $CONFIRM"
    log "  log file: $LOG_FILE"
    echo

    step_1_stop_services
    step_2_disable_services
    step_3_reset_identity
    step_4_clear_phi_caches
    step_5_clear_workspace_root_loose
    step_6_wipe_media
    step_7_wipe_sessions
    step_8_wipe_cron
    step_9_sanitize_openclaw_config
    step_10_clear_env_files
    step_12_clear_aria_backup
    step_13_clear_coding_agents
    step_14_clear_shell_history
    step_15_clear_logs
    step_16_clear_machine_id
    step_17_remove_ssh_host_keys
    step_18_clear_authorized_keys
    step_19_apt_clean
    step_20_clear_tmp
    if ! step_22_secret_scan; then
        log "ABORTING due to failed secret scan"
        exit 3
    fi
    step_23_stamp_image

    log ""
    log "==================================================================="
    log "deprovision complete."
    log ""
    log "Next steps (run from your operator laptop, NOT here):"
    log "  ssh azureuser@$CURRENT_HOSTNAME 'sudo waagent -deprovision+user -force'"
    log "  az vm deallocate -g <RG> -n $CURRENT_HOSTNAME"
    log "  az vm generalize -g <RG> -n $CURRENT_HOSTNAME"
    log "  az image create  -g <RG> -n tula-tenant-template-<version> --source $CURRENT_HOSTNAME"
    log ""
    log "This host is now in a generalize-ready state. DO NOT reboot it"
    log "before capture, or you will need to re-run this script."
    log "==================================================================="
}

main "$@"
