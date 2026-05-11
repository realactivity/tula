#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# aria-backup.sh — Back up ~/.openclaw to the aria git repo and push.
# ---------------------------------------------------------------------------
#
# ============================== AGENTS.md ===================================
# # aria-backup.sh
#
# ## Purpose
# Idempotent backup of the user's `~/.openclaw/` directory (openclaw config
# + the "Tula" agent workspace) into a local git repo at `~/aria-repo`, then
# pushed to a private GitHub repo (default: `pswider/aria`).
#
# Run it any time you want a fresh snapshot. It is safe to re-run; if nothing
# changed, it commits nothing and exits 0.
#
# ## What it does
# 1. `rsync -a --delete` from `$ARIA_SOURCE` to `$ARIA_REPO_DIR`, excluding
#    every path in `PURGE` and `PROTECT`. `--delete` keeps the repo in sync
#    with the source (files deleted in the source are removed from the repo).
# 2. Explicitly `rm -rf`s every `PURGE` path under `$ARIA_REPO_DIR`. This is
#    what handles the case where a previous run committed a secret we now
#    want to scrub — the rsync `--exclude` alone wouldn't remove it.
#    `PROTECT` paths (this script, README.md, .gitignore, .git) are NOT
#    touched so the repo's metadata survives.
# 3. Runs a regex-based secret-pattern scan over the staged tree. Any hit
#    that isn't in `ALLOWLIST_GLOBS` aborts the run before we commit. This
#    catches things like a stray Ed25519 key in `identity/device.json`.
# 4. `git add -A`. If there are no changes, exits 0 cleanly.
# 5. Otherwise commits as `Backup YYYY-MM-DD HH:MM:SSZ` and pushes to
#    `$ARIA_REMOTE/$ARIA_BRANCH` (unless `--no-push`).
#
# ## Inputs (all optional env vars)
#   ARIA_SOURCE     Source directory                  (default: $HOME/.openclaw)
#   ARIA_REPO_DIR   Repo working tree                 (default: $HOME/aria-repo)
#   ARIA_REMOTE     Git remote name                   (default: origin)
#   ARIA_BRANCH     Git branch to push                (default: main)
#   GITHUB_TOKEN    Fine-grained PAT with Contents:write on the repo. If set,
#                   used as a one-shot push credential and NOT persisted to
#                   `.git/config`. If unset, the push relies on whatever auth
#                   the host has (gh, credential helper, SSH, etc.).
#
# ## Flags
#   --dry-run       Show planned actions, don't rsync/commit/push
#   --no-push       Stage + commit locally only
#   --no-scan       Skip the secret scan (DANGEROUS — only use for debugging)
#   -v|--verbose    Verbose rsync + git output
#   -h|--help       Print this header and exit
#
# ## Exit codes
#   0  Success (whether or not there were changes)
#   1  Generic error
#   2  Secret-pattern scan failed — see stderr for offending file(s)
#   3  Push failed (commit was made; resolve auth and retry `git push`)
#
# ## Exclusions (mirrors the repo's `.gitignore` — keep both in sync)
#   credentials/                          telegram pairing secrets
#   plugin-runtime-deps/                  ~405MB redistributable third-party code
#   logs/                                 local logs, may leak data
#   exec-approvals.json                   local approval cache
#   update-check.json                     regenerable
#   openclaw.json*                        live config, every .bak variant, and
#                                         .last-good — all carry API keys
#   agents/main/sessions/                 chat trajectories, large + leak risk
#   agents/main/agent/auth-profiles.json  model provider auth tokens
#   identity/device-auth.json             operator token
#   identity/device.json                  device Ed25519 keypair (private key)
#   devices/paired.json                   operator token
#   workspace/.filebrowser-admin-password admin password
#   workspace/.git/                       nested git, would shadow our repo
#
# Glob patterns are supported in PURGE entries (e.g. `openclaw.json*`).
# See the PURGE array definition for the full syntax notes.
#
# ## Adding new exclusions
# When you discover a new file that shouldn't be backed up:
#   1. Add the path to the `PURGE` array below (use repo-relative paths,
#      no trailing slash, no leading slash).
#   2. Add the same path/pattern to `aria-repo/.gitignore` (so anyone hand-
#      committing also gets protection).
#   3. Re-run the script. Step 2's `rm -rf` will scrub the file from the
#      working tree if a previous run committed it; the next commit removes
#      it from the tree on the remote.
#   4. For secrets that have already been pushed: also rotate the secret
#      upstream and (optionally) run a history rewrite — for a low-volume
#      repo like this, the cleanest path is `git filter-repo --invert-paths
#      --path <bad-file>` followed by a force-push (and rotate any token
#      that was used to push, since force-push needs write access).
#
# ## Adding a secret-scan allowlist entry
# When the scan flags a file but the match is a false positive (e.g. a CLI
# flag name like `--password` in a shell completion):
#   1. Add the file's path (relative to repo root, supports glob) to the
#      `ALLOWLIST_GLOBS` array below.
#   2. Document why with a comment next to the entry.
#
# ## Recovering from auth failure on push
# If push fails with 401/403, the commit is already made locally. Either:
#   - Set `GITHUB_TOKEN` and re-run with `--no-push` removed, OR
#   - Configure git auth (e.g. `gh auth login`) and run `git -C $ARIA_REPO_DIR push`.
#
# ## Restoring from this backup
# `git clone https://github.com/pswider/aria.git`, then copy the directories
# back into `~/.openclaw/`. Re-run `openclaw` to regenerate config and
# re-pair devices; the excluded auth/credential files are not restored.
# ============================ END AGENTS.md =================================

set -euo pipefail

# ---------- configuration --------------------------------------------------

ARIA_SOURCE="${ARIA_SOURCE:-$HOME/.openclaw}"
ARIA_REPO_DIR="${ARIA_REPO_DIR:-$HOME/aria-repo}"
ARIA_REMOTE="${ARIA_REMOTE:-origin}"
ARIA_BRANCH="${ARIA_BRANCH:-main}"

# Paths split into three buckets:
#
#   PURGE  — Skipped from source AND removed from the repo working tree if
#            already present. Use for secrets and junk we don't want sitting
#            in the repo even from a previous bad run.
#
#   PROTECT — Skipped from source AND preserved in the repo. Use for
#             repo-only files (this script, README, .gitignore, .git itself)
#             that don't live at the source.
#
# rsync's `--exclude` is used for both buckets (so the source side ignores
# them); after rsync, we explicitly `rm -rf` PURGE entries at the destination
# to clean up stragglers from older runs that didn't have them excluded yet.
#
# Glob characters (`*`, `?`, `[...]`) ARE supported in PURGE entries — rsync
# handles them natively in `--exclude` patterns, and the post-rsync purge
# step below uses `shopt -s nullglob` for the matching shell expansion.
# Keep patterns anchored to the repo root (no leading slash; the loops add
# context). Use a glob in preference to listing every numbered variant.
PURGE=(
    # secrets / PII
    'credentials'
    'agents/main/agent/auth-profiles.json'
    'agents/main/sessions'
    'identity/device-auth.json'
    'identity/device.json'
    'devices/paired.json'
    'exec-approvals.json'
    'openclaw.json*'                       # covers .json, .json.bak, .json.bak.<n>,
                                           # .json.bak.<timestamp>, .json.bak.<name>,
                                           # .json.last-good — all hold API keys.
    'workspace/.filebrowser-admin-password'
    'workspace/.git'
    # noise / regenerable
    'logs'
    'update-check.json'
    'plugin-runtime-deps'
)

PROTECT=(
    'aria-backup.sh'
    'README.md'
    '.gitignore'
    '.git'
    'scripts'
)

# Regex patterns that look like real credentials. Tuned to be high-signal;
# if a pattern fires, the run aborts unless the file is in ALLOWLIST_GLOBS.
SECRET_PATTERNS=(
    '"token"[[:space:]]*:[[:space:]]*"[A-Za-z0-9_-]{16,}"'
    '"password"[[:space:]]*:[[:space:]]*"[^"]{6,}"'
    'sk-[A-Za-z0-9]{20,}'
    'ghp_[A-Za-z0-9]{20,}'
    'github_pat_[A-Za-z0-9_]{40,}'
    'xoxb-[A-Za-z0-9-]{20,}'
    'AKIA[A-Z0-9]{16}'
    'Bearer[[:space:]]+[A-Za-z0-9._-]{20,}'
    'BEGIN [A-Z ]*PRIVATE KEY'
)

# File globs (relative to repo root) that are known false-positive sources
# for the secret scan. Keep this list short and commented.
ALLOWLIST_GLOBS=(
    '.gitignore'                              # contains the literal pattern words
    'README.md'                               # documents what was excluded
    'aria-backup.sh'                          # this file lists pattern words
    'completions/openclaw.bash'               # CLI flag names like --token
    'completions/openclaw.zsh'                # CLI flag names like --token
    'completions/openclaw.fish'               # CLI flag names like --token
    'completions/openclaw.ps1'                # CLI flag names like --token
    'media/inbound/account*.csv'              # CSV column headers (no values)
    'agents/main/agent/models.json'           # placeholder apiKey "codex-app-server"
)

# ---------- argument parsing -----------------------------------------------

DRY_RUN=0
NO_PUSH=0
NO_SCAN=0
VERBOSE=0

while [[ $# -gt 0 ]]; do
    case "$1" in
        --dry-run)   DRY_RUN=1 ;;
        --no-push)   NO_PUSH=1 ;;
        --no-scan)   NO_SCAN=1 ;;
        -v|--verbose) VERBOSE=1 ;;
        -h|--help)
            sed -n '2,/^# === END AGENTS.md/p' "$0" | sed 's/^# \{0,1\}//'
            exit 0
            ;;
        *)
            echo "unknown flag: $1 (try --help)" >&2
            exit 1
            ;;
    esac
    shift
done

log() { printf '[aria-backup] %s\n' "$*"; }
vlog() { [[ $VERBOSE -eq 1 ]] && log "$*" || true; }

# ---------- preflight ------------------------------------------------------

[[ -d "$ARIA_SOURCE" ]] || { log "source missing: $ARIA_SOURCE"; exit 1; }
[[ -d "$ARIA_REPO_DIR/.git" ]] || {
    log "repo missing or not a git repo: $ARIA_REPO_DIR"
    log "bootstrap with: git init $ARIA_REPO_DIR && cd $ARIA_REPO_DIR && git remote add $ARIA_REMOTE <url>"
    exit 1
}

command -v rsync >/dev/null || { log "rsync not installed"; exit 1; }
command -v git   >/dev/null || { log "git not installed";   exit 1; }

log "source:   $ARIA_SOURCE"
log "repo:     $ARIA_REPO_DIR"
log "remote:   $ARIA_REMOTE/$ARIA_BRANCH"
[[ $DRY_RUN -eq 1 ]] && log "mode:     DRY RUN (no writes)"

# ---------- step 1: rsync --------------------------------------------------

RSYNC_ARGS=(-a --delete)
[[ $VERBOSE -eq 1 ]] && RSYNC_ARGS+=(-v --stats) || RSYNC_ARGS+=(--quiet)
[[ $DRY_RUN -eq 1 ]] && RSYNC_ARGS+=(--dry-run)
for ex in "${PURGE[@]}"   ; do RSYNC_ARGS+=(--exclude="/$ex"); done
for ex in "${PROTECT[@]}" ; do RSYNC_ARGS+=(--exclude="/$ex"); done

log "rsync ${ARIA_SOURCE}/ -> ${ARIA_REPO_DIR}/ (purge=${#PURGE[@]}, protect=${#PROTECT[@]})"
rsync "${RSYNC_ARGS[@]}" "${ARIA_SOURCE}/" "${ARIA_REPO_DIR}/"

# ---------- step 2: purge secret/junk paths from repo ----------------------
#
# `shopt -s nullglob` makes globs that match nothing expand to zero args
# (rather than the literal pattern string), so the loop body skips cleanly
# for entries that don't exist on this run. Literal (non-glob) paths still
# work — they expand to themselves when present, and to nothing when not.

if [[ $DRY_RUN -eq 0 ]]; then
    shopt -s nullglob
    for pattern in "${PURGE[@]}"; do
        # Intentionally unquoted on the right-hand side so the shell expands
        # globs against the repo working tree.
        for target in "$ARIA_REPO_DIR"/$pattern; do
            if [[ -e "$target" || -L "$target" ]]; then
                vlog "purging ${target#$ARIA_REPO_DIR/}"
                rm -rf -- "$target"
            fi
        done
    done
    shopt -u nullglob
fi

# ---------- step 3: secret scan --------------------------------------------

scan_secrets() {
    local repo="$1"
    local pf
    pf=$(mktemp); trap 'rm -f "$pf"' RETURN
    printf '%s\n' "${SECRET_PATTERNS[@]}" > "$pf"

    local hits
    hits=$(grep -rEnH --binary-files=without-match \
                     --exclude-dir=.git \
                     -f "$pf" "$repo" 2>/dev/null || true)
    [[ -z "$hits" ]] && return 0

    local filtered=""
    while IFS= read -r line; do
        [[ -z "$line" ]] && continue
        local file="${line%%:*}"
        local rel="${file#$repo/}"
        local ok=0
        for glob in "${ALLOWLIST_GLOBS[@]}"; do
            # shellcheck disable=SC2053
            [[ "$rel" == $glob ]] && { ok=1; break; }
        done
        [[ $ok -eq 0 ]] && filtered+="${line}"$'\n'
    done <<< "$hits"

    if [[ -n "$filtered" ]]; then
        echo "" >&2
        echo "Secret-pattern scan FAILED. Matches outside ALLOWLIST_GLOBS:" >&2
        echo "------------------------------------------------------------" >&2
        printf '%s' "$filtered" >&2
        echo "------------------------------------------------------------" >&2
        echo "Either add the file path to EXCLUDES (real secret, don't back up)" >&2
        echo "or add a glob to ALLOWLIST_GLOBS (false positive, document why)." >&2
        return 1
    fi
    return 0
}

if [[ $NO_SCAN -eq 1 ]]; then
    log "secret scan: SKIPPED (--no-scan)"
elif [[ $DRY_RUN -eq 1 ]]; then
    log "secret scan: skipped in dry-run"
else
    log "secret scan: running"
    scan_secrets "$ARIA_REPO_DIR" || exit 2
    log "secret scan: clean"
fi

# ---------- step 4 & 5: commit ---------------------------------------------

cd "$ARIA_REPO_DIR"

if [[ $DRY_RUN -eq 1 ]]; then
    log "dry-run: would 'git add -A' and commit if there were changes; exiting"
    exit 0
fi

git add -A

if git diff --cached --quiet; then
    log "no changes to commit"
    exit 0
fi

CHANGES=$(git diff --cached --shortstat | sed 's/^ *//')
log "staged changes: ${CHANGES}"

TS=$(date -u '+%Y-%m-%d %H:%M:%SZ')
COMMIT_MSG="Backup ${TS}"
GIT_COMMITTER_NAME="${GIT_COMMITTER_NAME:-aria-backup}"
GIT_COMMITTER_EMAIL="${GIT_COMMITTER_EMAIL:-aria-backup@local}"
GIT_AUTHOR_NAME="${GIT_AUTHOR_NAME:-aria-backup}"
GIT_AUTHOR_EMAIL="${GIT_AUTHOR_EMAIL:-aria-backup@local}"
export GIT_COMMITTER_NAME GIT_COMMITTER_EMAIL GIT_AUTHOR_NAME GIT_AUTHOR_EMAIL

git commit -q -m "$COMMIT_MSG"
log "committed: $(git log -1 --oneline)"

# ---------- step 6: push ---------------------------------------------------

if [[ $NO_PUSH -eq 1 ]]; then
    log "push: SKIPPED (--no-push)"
    exit 0
fi

REMOTE_URL=$(git remote get-url "$ARIA_REMOTE" 2>/dev/null || true)
[[ -z "$REMOTE_URL" ]] && { log "remote '$ARIA_REMOTE' not configured"; exit 3; }

log "push: $ARIA_REMOTE $ARIA_BRANCH ($REMOTE_URL)"

if [[ -n "${GITHUB_TOKEN:-}" && "$REMOTE_URL" =~ ^https://github\.com/ ]]; then
    # One-shot push using the env-var token. Doesn't touch .git/config so the
    # token is never persisted to disk.
    PUSH_URL="${REMOTE_URL/https:\/\/github.com/https:\/\/x-access-token:${GITHUB_TOKEN}@github.com}"
    if git push "$PUSH_URL" "$ARIA_BRANCH:$ARIA_BRANCH"; then
        log "push: ok (via GITHUB_TOKEN, not persisted)"
    else
        log "push: FAILED"
        exit 3
    fi
else
    if git push "$ARIA_REMOTE" "$ARIA_BRANCH"; then
        log "push: ok"
    else
        log "push: FAILED — check git auth (gh auth login, credential helper, or set GITHUB_TOKEN)"
        exit 3
    fi
fi

log "done."
