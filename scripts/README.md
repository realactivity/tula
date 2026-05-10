# Scripts

Operational scripts for deploying, running, and backing up a Tula agent.

## `deploy-skills.sh`

Pull-based skill deployer. Runs **on the OpenClaw VM**. Updates a local
clone of `tula`, then `rsync`s every directory under `tula/skills/` that
contains a `SKILL.md` into `~/.openclaw/workspace/skills/`. Optionally
verifies each skill shows `✓ ready` via `openclaw skills list`.

### One-time setup

```bash
ssh <your-openclaw-vm>
git clone https://github.com/pswider/tula.git ~/tula
chmod +x ~/tula/scripts/deploy-skills.sh
```

### Usage

```bash
# Default: pull, deploy all skills, verify
~/tula/scripts/deploy-skills.sh

# Preview only
~/tula/scripts/deploy-skills.sh --dry-run

# Single skill
~/tula/scripts/deploy-skills.sh --skill epic-note

# Don't pull (use whatever's currently checked out)
~/tula/scripts/deploy-skills.sh --no-pull

# Skip openclaw skills list verification
~/tula/scripts/deploy-skills.sh --no-verify
```

### Why VM-pull, not laptop-push?

- Works regardless of host OS (Windows users don't need WSL/Cygwin for rsync).
- Verification (`openclaw skills list`) only makes sense on the VM anyway.
- `git pull` ensures you deploy a real, version-controlled state.

## `install-coding-agent.sh`

Set up the OpenClaw `coding-agent` delegate. Installs a coding CLI
(Claude Code by default, or Codex with `--cli codex`), enables the
bundled `coding-agent` skill in `~/.openclaw/openclaw.json` (with
backup), and verifies `openclaw skills list` shows it as `✓ ready`.

```bash
ssh <your-openclaw-vm>
~/tula/scripts/install-coding-agent.sh                # Claude Code (default)
~/tula/scripts/install-coding-agent.sh --cli codex    # Codex instead
~/tula/scripts/install-coding-agent.sh --no-enable    # Install only, don't touch openclaw.json
```

The script does NOT log you in to the chosen CLI — that step is
interactive and must be done manually after the script finishes. See
[`docs/agent/coding-agent.md`](../docs/agent/coding-agent.md) for the
full walkthrough including troubleshooting (workspace device-auth
policy blocks, OAuth state mismatch over SSH tunnel, broken interactive
PATH).

## `aria-backup.sh`

## `aria-backup.sh`

Idempotent backup of an agent host's `~/.openclaw/` directory (openclaw
config + the Tula agent workspace) into a local git repo, with a
secret-pattern scan and an optional `git push`.

This script is what produces the **private** sister repo where the
operational state of a deployed Tula agent is preserved. It is **not** for
public data — PHI and personal context never leave the agent host except
into a private remote of your own.

### Highlights

- `rsync -a --delete` from `~/.openclaw/` to the repo working tree, with an
  exclusion list that mirrors the openclaw threat model:
  - `agents/main/sessions/` — chat trajectories (large, may include
    credentials in tool output)
  - `agents/main/agent/auth-profiles.json` — model provider auth tokens
  - `identity/device-auth.json`, `identity/device.json` — device identity
    keypair and operator token
  - `devices/paired.json` — operator pairing token
  - `openclaw.json`, `openclaw.json.bak*`, `openclaw.json.last-good` —
    main config (contains API keys)
  - `credentials/` — telegram pairing + allow-from secrets
  - `exec-approvals.json` — local approval cache
  - `update-check.json` — regenerable
  - `logs/` — local logs (may leak data)
  - `plugin-runtime-deps/` — ~405 MB of redistributable third-party code
  - `workspace/.filebrowser-admin-password` — admin password
  - `workspace/.git/` — nested git that would shadow the backup repo
- Regex-based secret-pattern scan over the staged tree before commit.
  Aborts on hits not in `ALLOWLIST_GLOBS`.
- One-shot `GITHUB_TOKEN` auth for push (never persisted to `.git/config`).
- `--dry-run`, `--no-push`, `--no-scan`, `--verbose`, `--help` flags.

### Usage

```bash
# Default: snapshot ~/.openclaw → ~/aria-repo, commit, push to origin/main
./aria-backup.sh

# Preview only
./aria-backup.sh --dry-run

# Stage + commit but don't push
./aria-backup.sh --no-push

# Override defaults via env vars
ARIA_SOURCE=$HOME/.openclaw \
ARIA_REPO_DIR=$HOME/aria-repo \
ARIA_REMOTE=origin \
ARIA_BRANCH=main \
GITHUB_TOKEN=ghp_... \
./aria-backup.sh
```

Read the header of `aria-backup.sh` for the full operating manual — it's
self-documenting.

## `aria-cron.sh`

Non-interactive wrapper around `aria-backup.sh` for cron / systemd timer use.

Cron's environment is minimal (no PATH past `/usr/bin:/bin`, no shell env
vars), so this wrapper:

1. Sources `~/.aria-cron-token` (mode 600 enforced) — must define
   `GITHUB_TOKEN`.
2. Sets a sane PATH (`git`, `rsync`, `python3`, `curl` resolve).
3. Acquires `flock -n /tmp/aria-backup.lock` so a slow run can't overlap
   the next cron tick.
4. Logs stdout+stderr to `~/aria-backup.log`, truncating when the file
   exceeds 1 MiB.
5. Exits with the backup script's exit code so cron MTAs can alert.

### Sample crontab entry

```cron
CRON_TZ=America/New_York
0 3 * * * /home/azureuser/aria-repo/scripts/aria-cron.sh
```

### One-shot manual test

```bash
~/aria-repo/scripts/aria-cron.sh && tail -n 30 ~/aria-backup.log
```

## Setup the first time

```bash
# 1. Create a fine-grained PAT with Contents:write on your private aria repo.
# 2. Drop it in ~/.aria-cron-token
echo 'GITHUB_TOKEN=ghp_...' > ~/.aria-cron-token
chmod 600 ~/.aria-cron-token

# 3. Initialize the repo working tree (one time)
mkdir -p ~/aria-repo && cd ~/aria-repo
git init -b main
git remote add origin https://github.com/<you>/aria.git

# 4. First snapshot
./aria-backup.sh
```

## Provenance

Both scripts originated in a private operational repo. They are reproduced
here so that anyone running a Tula agent can use the same backup pattern
for their own private snapshot repo.
