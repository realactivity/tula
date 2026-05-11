#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# deploy-skills.sh — Deploy Tula skills from a local tula clone to OpenClaw.
# ---------------------------------------------------------------------------
#
# ============================== AGENTS.md ===================================
# # deploy-skills.sh
#
# ## Purpose
# Sync skills from a local clone of the `tula` repo to an OpenClaw agent's
# workspace at `~/.openclaw/workspace/skills/`. Run this on the VM where
# OpenClaw is installed, *not* on a developer workstation.
#
# OpenClaw's skills watcher picks up changes on the next session, so a
# successful run is enough — no daemon restart required.
#
# ## What it does
# 1. (Optional) `git pull --ff-only` in the tula clone so you're deploying
#    HEAD of `main`.
# 2. For each top-level directory under `tula/skills/` that contains a
#    `SKILL.md`, `rsync -a --delete` it to
#    `~/.openclaw/workspace/skills/<name>/`.
# 3. (Optional) Run `openclaw skills list` and grep for each deployed skill
#    to confirm it shows `✓ ready`.
#
# Note: `tula/skills/AGENTS.md` is NOT a skill — it's the conventions doc —
# so it's filtered out.
#
# ## Usage
#   deploy-skills.sh                      Deploy all skills, pull first, verify after
#   deploy-skills.sh --dry-run            Show planned actions, don't write
#   deploy-skills.sh --skill epic-note    Deploy just one skill
#   deploy-skills.sh --no-pull            Skip git pull (use whatever's checked out)
#   deploy-skills.sh --no-verify          Skip openclaw skills list verification
#   deploy-skills.sh --help               Print this header and exit
#
# ## Inputs (all optional env vars)
#   TULA_REPO_DIR     Path to local tula clone (default: $HOME/tula)
#   OPENCLAW_SKILLS   Destination skills dir (default: $HOME/.openclaw/workspace/skills)
#
# ## Exit codes
#   0  Success (all requested skills deployed and verified)
#   1  Generic error (missing repo, rsync failure, etc.)
#   2  Verification failed — at least one skill didn't show as `✓ ready`
#
# ## First-time setup on a new VM
#   1. Clone tula somewhere stable:
#        git clone https://github.com/pswider/tula.git ~/tula
#   2. (Optional) chmod +x ~/tula/scripts/deploy-skills.sh
#   3. Run:
#        ~/tula/scripts/deploy-skills.sh
#
# ## When you push a skill update from your dev machine
#   ssh <vm-host>
#   ~/tula/scripts/deploy-skills.sh
# ============================ END AGENTS.md =================================

set -euo pipefail

# ---------- configuration --------------------------------------------------

TULA_REPO_DIR="${TULA_REPO_DIR:-$HOME/tula}"
OPENCLAW_SKILLS="${OPENCLAW_SKILLS:-$HOME/.openclaw/workspace/skills}"

DO_PULL=1
DO_VERIFY=1
DRY_RUN=0
ONLY_SKILL=""

# ---------- arg parsing ----------------------------------------------------

while [[ $# -gt 0 ]]; do
    case "$1" in
        --help|-h)
            sed -n '2,/^# === END AGENTS.md/p' "$0" | sed 's/^# \?//'
            exit 0
            ;;
        --dry-run)    DRY_RUN=1; shift ;;
        --no-pull)    DO_PULL=0; shift ;;
        --no-verify)  DO_VERIFY=0; shift ;;
        --skill)      ONLY_SKILL="$2"; shift 2 ;;
        *)
            echo "[deploy-skills] unknown flag: $1" >&2
            echo "[deploy-skills] try --help" >&2
            exit 1
            ;;
    esac
done

# ---------- preflight ------------------------------------------------------

if [[ ! -d "$TULA_REPO_DIR/.git" ]]; then
    echo "[deploy-skills] ERROR: $TULA_REPO_DIR is not a git checkout"
    echo "[deploy-skills] clone first: git clone https://github.com/pswider/tula.git $TULA_REPO_DIR"
    exit 1
fi

if [[ ! -d "$TULA_REPO_DIR/skills" ]]; then
    echo "[deploy-skills] ERROR: $TULA_REPO_DIR/skills does not exist"
    exit 1
fi

mkdir -p "$OPENCLAW_SKILLS"

# ---------- pull ------------------------------------------------------------

if (( DO_PULL )); then
    echo "[deploy-skills] git pull in $TULA_REPO_DIR"
    if (( DRY_RUN )); then
        echo "[deploy-skills] (dry-run) would: cd $TULA_REPO_DIR && git pull --ff-only"
    else
        ( cd "$TULA_REPO_DIR" && git pull --ff-only )
    fi
fi

# ---------- discover skills -------------------------------------------------

mapfile -t SKILL_DIRS < <(find "$TULA_REPO_DIR/skills" -mindepth 2 -maxdepth 2 -name SKILL.md -printf '%h\n' | sort)

if (( ${#SKILL_DIRS[@]} == 0 )); then
    echo "[deploy-skills] no skills found under $TULA_REPO_DIR/skills"
    exit 1
fi

DEPLOYED=()

# ---------- deploy each skill ----------------------------------------------

for src in "${SKILL_DIRS[@]}"; do
    name="$(basename "$src")"

    if [[ -n "$ONLY_SKILL" && "$name" != "$ONLY_SKILL" ]]; then
        continue
    fi

    dst="$OPENCLAW_SKILLS/$name"

    echo ""
    echo "[deploy-skills] -> $name"
    echo "    src: $src/"
    echo "    dst: $dst/"

    if (( DRY_RUN )); then
        rsync -avn --delete "$src/" "$dst/" | sed 's/^/    /'
    else
        rsync -av --delete "$src/" "$dst/" | sed 's/^/    /'
        DEPLOYED+=("$name")
    fi
done

if [[ -n "$ONLY_SKILL" && ${#DEPLOYED[@]} -eq 0 && $DRY_RUN -eq 0 ]]; then
    echo "[deploy-skills] ERROR: --skill $ONLY_SKILL did not match any skill under $TULA_REPO_DIR/skills"
    exit 1
fi

# ---------- verify ----------------------------------------------------------

if (( DO_VERIFY && DRY_RUN == 0 )); then
    if ! command -v openclaw >/dev/null 2>&1; then
        echo "[deploy-skills] WARN: openclaw not on PATH — skipping verification"
        exit 0
    fi

    echo ""
    echo "[deploy-skills] verifying with: openclaw skills list"
    skills_output="$(openclaw skills list 2>&1)"

    failed=0
    for name in "${DEPLOYED[@]}"; do
        line="$(echo "$skills_output" | grep -E "${name}\b" | head -1 || true)"
        if [[ -z "$line" ]]; then
            echo "    ✗ $name (not visible to openclaw)"
            failed=1
        elif echo "$line" | grep -q '✓ ready'; then
            echo "    ✓ $name (ready)"
        else
            status_line="$(echo "$line" | tr -s ' ')"
            echo "    ⚠ $name (found but not ready): $status_line"
            failed=1
        fi
    done

    if (( failed )); then
        exit 2
    fi
fi

echo ""
echo "[deploy-skills] done."
