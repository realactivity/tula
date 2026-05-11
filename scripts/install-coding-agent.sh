#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# install-coding-agent.sh — Set up OpenClaw's coding-agent delegate.
# ---------------------------------------------------------------------------
#
# ============================== AGENTS.md ===================================
# # install-coding-agent.sh
#
# ## Purpose
# Install a coding delegate CLI (Claude Code or Codex) on an OpenClaw VM
# and enable the bundled `coding-agent` skill in `openclaw.json`. After
# this script runs, the agent can spawn the chosen CLI for multi-file
# coding work — refactors, building features, PR review, etc.
#
# This script does NOT log you in to the chosen CLI. That step is
# interactive and must be done manually after the script finishes.
#
# ## What it does
# 1. `sudo npm install -g <package>` for the chosen CLI:
#      - claude  → @anthropic-ai/claude-code
#      - codex   → @openai/codex
# 2. Verifies the binary is on PATH and prints its version.
# 3. (codex only) Drops `model = "gpt-5.5"` into `~/.codex/config.toml`.
# 4. (claude only) Merges `permissions.defaultMode = "bypassPermissions"`
#    and `permissions.skipDangerousModePermissionPrompt = true` into
#    `~/.claude/settings.json`. Without this, OpenClaw spawns claude
#    non-interactively and Claude Code silently refuses to write files
#    because it can't show its permission prompt.
# 5. Patches `~/.openclaw/openclaw.json` with:
#      skills.entries.coding-agent.enabled = true
#    (backup written to openclaw.json.bak.coding-agent first run)
# 6. Runs `openclaw skills list` and confirms `coding-agent` shows ✓ ready.
#
# ## Usage
#   install-coding-agent.sh                 Install Claude Code (default), enable skill
#   install-coding-agent.sh --cli claude    Same as default
#   install-coding-agent.sh --cli codex     Install Codex CLI instead
#   install-coding-agent.sh --no-enable     Install only, don't touch openclaw.json
#   install-coding-agent.sh --help          Print this header and exit
#
# ## After this script — manual login
# Claude Code:
#   claude
#   /login   (inside the TUI; follow Anthropic OAuth in your browser)
#   /exit
#
# Codex:
#   codex login --device-auth
#   (paste the printed code at the URL it prints, sign in to ChatGPT)
#
# Note: if your ChatGPT account is in a workspace whose admin disables
# device-code authentication, choose your **personal** account on the
# OAuth screen, or use Claude Code instead.
#
# ## Why pick which?
# - **Claude Code** — uses Anthropic OAuth, defaults to Claude Sonnet 4.6
#   for coding (or Opus 4.7 if you `/model`-switch). Smoothest if your
#   OpenClaw agent is already on Anthropic auth.
# - **Codex** — uses ChatGPT OAuth or device-auth, defaults to gpt-5.5 in
#   the config we drop. Strongest agentic coding benchmarks; needs an
#   active ChatGPT subscription that allows the device flow.
#
# ## Exit codes
#   0  Success
#   1  Generic error (npm install failed, openclaw.json missing, etc.)
#   2  Verification failed — coding-agent didn't show as ✓ ready
# ============================ END AGENTS.md =================================

set -euo pipefail

CLI="claude"
DO_ENABLE=1

while [[ $# -gt 0 ]]; do
    case "$1" in
        --help|-h)
            sed -n '2,/^# === END AGENTS.md/p' "$0" | sed 's/^# \?//'
            exit 0
            ;;
        --cli)        CLI="$2"; shift 2 ;;
        --no-enable)  DO_ENABLE=0; shift ;;
        *)
            echo "[install-coding-agent] unknown flag: $1" >&2
            echo "[install-coding-agent] try --help" >&2
            exit 1
            ;;
    esac
done

case "$CLI" in
    claude) PKG="@anthropic-ai/claude-code"; BIN="claude" ;;
    codex)  PKG="@openai/codex";              BIN="codex" ;;
    *)
        echo "[install-coding-agent] ERROR: --cli must be 'claude' or 'codex' (got: $CLI)" >&2
        exit 1
        ;;
esac

# ---------- preflight ------------------------------------------------------

if ! command -v npm >/dev/null 2>&1; then
    echo "[install-coding-agent] ERROR: npm not found. Install Node.js first." >&2
    exit 1
fi

if (( DO_ENABLE )) && [[ ! -f "$HOME/.openclaw/openclaw.json" ]]; then
    echo "[install-coding-agent] ERROR: ~/.openclaw/openclaw.json not found." >&2
    echo "[install-coding-agent] Is OpenClaw installed and configured on this host?" >&2
    exit 1
fi

# ---------- install --------------------------------------------------------

echo "[install-coding-agent] installing $PKG ..."
if command -v "$BIN" >/dev/null 2>&1; then
    echo "[install-coding-agent] $BIN already on PATH ($(command -v "$BIN")) — re-running install to update"
fi
sudo npm install -g "$PKG"

echo ""
echo "[install-coding-agent] $BIN version:"
"$BIN" --version

# ---------- codex config ---------------------------------------------------

if [[ "$CLI" == "codex" ]]; then
    mkdir -p "$HOME/.codex"
    cfg="$HOME/.codex/config.toml"
    if [[ ! -f "$cfg" ]] || ! grep -q '^model[[:space:]]*=' "$cfg"; then
        echo "[install-coding-agent] writing default model = \"gpt-5.5\" to $cfg"
        cat > "$cfg" <<'TOML'
# Pin GPT-5.5 as the default model for Codex CLI (and any tools that spawn it).
# Override per-call with: codex --model <other>
model = "gpt-5.5"
TOML
    else
        echo "[install-coding-agent] $cfg already has a model setting — leaving alone"
    fi
fi

if [[ "$CLI" == "claude" ]]; then
    echo ""
    echo "[install-coding-agent] configuring ~/.claude/settings.json for headless spawn"
    python3 - <<'PY'
import json
from pathlib import Path

p = Path.home() / ".claude" / "settings.json"
p.parent.mkdir(parents=True, exist_ok=True)
cfg = json.loads(p.read_text()) if p.exists() else {}

perms = cfg.setdefault("permissions", {})
changed = False
if perms.get("defaultMode") != "bypassPermissions":
    perms["defaultMode"] = "bypassPermissions"
    changed = True
if perms.get("skipDangerousModePermissionPrompt") is not True:
    perms["skipDangerousModePermissionPrompt"] = True
    changed = True

if changed:
    p.write_text(json.dumps(cfg, indent=2) + "\n")
    print("    permissions.defaultMode = bypassPermissions")
    print("    permissions.skipDangerousModePermissionPrompt = true")
else:
    print("    already configured — no change")
PY
fi

# ---------- enable skill ---------------------------------------------------

if (( DO_ENABLE )); then
    echo ""
    echo "[install-coding-agent] enabling coding-agent skill in ~/.openclaw/openclaw.json"
    python3 - <<'PY'
import json, os, shutil, sys
from pathlib import Path

cfg_path = Path.home() / ".openclaw" / "openclaw.json"
bak_path = cfg_path.with_suffix(".json.bak.coding-agent")

with cfg_path.open() as f:
    cfg = json.load(f)

ca = cfg.setdefault("skills", {}).setdefault("entries", {}).setdefault("coding-agent", {})
if ca.get("enabled") is True:
    print("    already enabled — no change")
    sys.exit(0)

shutil.copy2(cfg_path, bak_path)
print(f"    backup: {bak_path}")
ca["enabled"] = True

tmp = cfg_path.with_suffix(".json.tmp")
with tmp.open("w") as f:
    json.dump(cfg, f, indent=2)
os.replace(tmp, cfg_path)
print("    enabled.")
PY
fi

# ---------- verify ---------------------------------------------------------

if (( DO_ENABLE )) && command -v openclaw >/dev/null 2>&1; then
    echo ""
    echo "[install-coding-agent] verifying with: openclaw skills list"
    if openclaw skills list 2>&1 | grep -E 'coding-agent' | grep -q '✓ ready'; then
        echo "    ✓ coding-agent (ready)"
    else
        echo "    ⚠ coding-agent did not show as ✓ ready — check openclaw skills list manually"
        exit 2
    fi
fi

# ---------- next steps ----------------------------------------------------

cat <<EOF

[install-coding-agent] done.

NEXT STEP: log in to $BIN (interactive). One of:

  Claude Code:
    $BIN
    # inside TUI:
    /login
    /exit

  Codex (workspace device-auth blocked? pick personal account on the OAuth page):
    codex login --device-auth

The agent will spawn $BIN automatically when it invokes the coding-agent skill.
EOF
