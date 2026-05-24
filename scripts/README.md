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
git clone https://github.com/realactivity/tula.git ~/tula
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

The script does NOT log you in to the chosen CLI - that step is
interactive and must be done manually after the script finishes. See
[`docs/agent/coding-agent.md`](../docs/agent/coding-agent.md) for the
full walkthrough including troubleshooting (workspace device-auth
policy blocks, OAuth state mismatch over SSH tunnel, broken interactive
PATH).

## `agent-backup.sh`

Idempotent backup of an agent host's `~/.openclaw/` directory (openclaw
config + the Tula agent workspace) into a local git repo, with a
secret-pattern scan and an optional `git push`.

This script is what produces the **private** sister repo where the
operational state of a deployed Tula agent is preserved. It is **not** for
public data - PHI and personal context never leave the agent host except
into a private remote of your own.

### Highlights

- `rsync -a --delete` from `~/.openclaw/` to the repo working tree, with an
  exclusion list that mirrors the openclaw threat model:
  - `agents/main/sessions/` - chat trajectories (large, may include
    credentials in tool output)
  - `agents/main/agent/auth-profiles.json` - model provider auth tokens
  - `identity/device-auth.json`, `identity/device.json` - device identity
    keypair and operator token
  - `devices/paired.json` - operator pairing token
  - `openclaw.json`, `openclaw.json.bak*`, `openclaw.json.last-good` -
    main config (contains API keys)
  - `credentials/` - telegram pairing + allow-from secrets
  - `exec-approvals.json` - local approval cache
  - `update-check.json` - regenerable
  - `logs/` - local logs (may leak data)
  - `plugin-runtime-deps/` - ~405 MB of redistributable third-party code
  - `workspace/.filebrowser-admin-password` - admin password
  - `workspace/.git/` - nested git that would shadow the backup repo
- Regex-based secret-pattern scan over the staged tree before commit.
  Aborts on hits not in `ALLOWLIST_GLOBS`.
- One-shot `GITHUB_TOKEN` auth for push (never persisted to `.git/config`).
- `--dry-run`, `--no-push`, `--no-scan`, `--verbose`, `--help` flags.

### Usage

```bash
# Default: snapshot ~/.openclaw → ~/agent-repo, commit, push to origin/main
./agent-backup.sh

# Preview only
./agent-backup.sh --dry-run

# Stage + commit but don't push
./agent-backup.sh --no-push

# Override defaults via env vars
AGENT_SOURCE=$HOME/.openclaw \
AGENT_REPO_DIR=$HOME/agent-repo \
AGENT_REMOTE=origin \
AGENT_BRANCH=main \
GITHUB_TOKEN=ghp_... \
./agent-backup.sh
```

Read the header of `agent-backup.sh` for the full operating manual - it's
self-documenting.

## `agent-cron.sh`

Non-interactive wrapper around `agent-backup.sh` for cron / systemd timer use.

Cron's environment is minimal (no PATH past `/usr/bin:/bin`, no shell env
vars), so this wrapper:

1. Sources `~/.agent-cron-token` (mode 600 enforced) - must define
   `GITHUB_TOKEN`.
2. Sets a sane PATH (`git`, `rsync`, `python3`, `curl` resolve).
3. Acquires `flock -n /tmp/agent-backup.lock` so a slow run can't overlap
   the next cron tick.
4. Logs stdout+stderr to `~/agent-backup.log`, truncating when the file
   exceeds 1 MiB.
5. Exits with the backup script's exit code so cron MTAs can alert.

### Sample crontab entry

```cron
CRON_TZ=America/New_York
0 3 * * * /home/azureuser/agent-repo/scripts/agent-cron.sh
```

### One-shot manual test

```bash
~/agent-repo/scripts/agent-cron.sh && tail -n 30 ~/agent-backup.log
```

## Setup the first time

```bash
# 1. Create a fine-grained PAT with Contents:write on your private backup repo.
# 2. Drop it in ~/.agent-cron-token
echo 'GITHUB_TOKEN=ghp_...' > ~/.agent-cron-token
chmod 600 ~/.agent-cron-token

# 3. Initialize the repo working tree (one time)
mkdir -p ~/agent-repo && cd ~/agent-repo
git init -b main
git remote add origin https://github.com/<you>/tula-vm-state.git

# 4. First snapshot
./agent-backup.sh
```

## `email-smoke-test/`

Phase 1 connectivity test for the email-router. A small Node project
(its own `package.json`) that does device-code OAuth against Microsoft
Graph and lists the 5 most recent messages in `aria@realactivity.com`.

Run on the VM after registering the `Tula Email Agent` app in Entra:

```bash
cd ~/tula/scripts/email-smoke-test
npm install
export TULA_CLIENT_ID=<guid> TULA_TENANT_ID=<guid>
node smoke-test.mjs
```

See [`email-smoke-test/README.md`](email-smoke-test/README.md) for the
full Entra setup walkthrough and troubleshooting. This scaffold is
throwaway - Phase 2 lifts it into `skills/email-router/scripts/` and
deletes this directory.

## `health-skillz-vm-preflight.sh`

Read-only prerequisite check for hosting `jmandel/health-skillz` on the same
OpenClaw VM.

Checks:

- required binaries (`node`, `bun`, `zip`, `git`, `systemctl`, `curl`)
- Node major version (>=20)
- local port availability
- optional Tailscale status
- `BASE_URL` sanity (if provided)

```bash
cd ~/tula
chmod +x scripts/health-skillz-vm-preflight.sh
BASE_URL="https://<your-hostname>" scripts/health-skillz-vm-preflight.sh
```

## `install-health-skillz-vm.sh`

VM-side installer for running `health-skillz` locally under systemd and wiring
config for your OpenClaw deployment.

It clones/pulls the upstream repo, builds brands/JWKS assets, writes
`config.openclaw.json`, creates `/etc/systemd/system/health-skillz.service`,
starts the service, and checks `/health`.

```bash
cd ~/tula
chmod +x scripts/install-health-skillz-vm.sh
BASE_URL="https://<your-hostname>" \
CLIENT_ID="<epic-client-id>" \
scripts/install-health-skillz-vm.sh
```

See [`docs/health-skillz-vm-hosting.md`](../docs/health-skillz-vm-hosting.md)
for full flow, acceptance checks, and rollback guidance.

## `set-openclaw-health-skillz-env.sh`

Persist `HEALTH_SKILLZ_BASE_URL` for the `openclaw` systemd daemon via a
drop-in override so the value survives daemon restarts and host reboots.

```bash
cd ~/tula
chmod +x scripts/set-openclaw-health-skillz-env.sh
scripts/set-openclaw-health-skillz-env.sh "https://<your-hostname>"
```

This writes:

- `/etc/systemd/system/openclaw.service.d/10-health-skillz-base-url.conf`

Then runs:

- `systemctl daemon-reload`
- `systemctl restart openclaw`

## Provenance

The `agent-backup.sh` / `agent-cron.sh` scripts originated in a private
operational repo (then named `aria-*`). They are reproduced here so that
anyone running a Tula agent can use the same backup pattern for their own
private snapshot repo. The renamed names align with the open
[`TRADEMARK.md`](../TRADEMARK.md) policy: the open repo uses Tula /
"agent" wording; "Aria" names RealActivity's separate commercial platform.
