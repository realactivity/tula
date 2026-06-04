# Tula Backup — Operator Runbook ({{TENANT_ID}})

_Last verified end-to-end: {{BACKUP_LAST_VERIFIED_AT}}_

<!--
This file is a TEMPLATE. It gets copied to a tenant's PRIVATE operator
location (NOT the public repo) during provisioning, and the placeholders
are filled by the onboarding skill. Generic scaffolding patterns live here;
tenant-identifying content NEVER goes in the public `realactivity/tula`
repo — see CONTRIBUTING.md and the `depaulify` design note.

Placeholders this template expects:
  {{TENANT_ID}}                — short tenant identifier
  {{TENANT_BACKUP_REPO}}       — e.g. <github-org>/<tenant>-vm-state (PRIVATE)
  {{TENANT_BACKUP_BRANCH}}     — default: main
  {{TENANT_BACKUP_REMOTE_HOST}} — default: github.com
  {{TENANT_GITHUB_LOGIN}}      — operator's GitHub login used for `gh auth`
  {{TENANT_RECORDS_PATH}}      — e.g. workspace/.health-records-cache/<date>/<provider>.json
  {{BACKUP_LAST_VERIFIED_AT}}  — ISO date of last end-to-end restore test
-->

## What this protects

Everything the tenant's agent needs to wake up in the same state on a fresh VM:

- `~/.openclaw/workspace/` — the agent's brain (MEMORY.md, daily notes, skills, caches, USER.md, IDENTITY.md)
- `~/.openclaw/agents/*/agent/` — model and plugin catalogs (sans auth tokens)
- `~/.openclaw/cron/`, `flows/`, `canvas/`, etc. — runtime state
- `~/.openclaw/identity/` — node identity (sans private device key)

**Excluded by design** (regenerable or sensitive):
- `credentials/`, `auth-profiles*.json`, `identity/device.json`, `identity/device-auth.json`, `devices/paired.json`, `openclaw.json*` — all hold live API keys or device private keys. Rotate after restore.
- `logs/`, `update-check.json`, `exec-approvals.json` — local noise.
- `plugin-runtime-deps/`, `npm/` — third-party code; reinstall via `openclaw plugins install`.
- `agents/main/sessions/` — chat trajectories, large + privacy-sensitive.
- `**/.git/` (except the backup repo's own) — nested checkouts.

## Architecture (one-liner)

`~/.openclaw/` → `rsync --delete` (with PURGE list) → `~/aria-repo/` → `git push` → `{{TENANT_BACKUP_REPO}}` (PRIVATE).

Runs hourly via `aria-backup.timer` systemd unit. Logs go to `journalctl -u aria-backup.service`.

## Pre-flight checks

```bash
# Is the repo still private?
gh repo view {{TENANT_BACKUP_REPO}} --json visibility -q .visibility
# expected: PRIVATE

# Is the timer healthy?
systemctl status aria-backup.timer aria-backup.service --no-pager -l

# When did the last successful backup land?
gh repo view {{TENANT_BACKUP_REPO}} --json pushedAt -q .pushedAt

# How many commits behind/ahead is local?
cd ~/aria-repo && git fetch origin && git status -sb
```

## Restore: full disaster recovery on a fresh VM

```bash
# 0. On the new VM, install prerequisites
sudo apt update && sudo apt install -y git curl rsync python3
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo gpg --dearmor -o /usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list
sudo apt update && sudo apt install -y gh

# 1. Authenticate to GitHub as the operator (account that owns {{TENANT_BACKUP_REPO}})
gh auth login   # choose: {{TENANT_BACKUP_REMOTE_HOST}}, HTTPS, login with browser

# 2. Clone the backup
mkdir -p ~/restore && cd ~/restore
git clone https://{{TENANT_BACKUP_REMOTE_HOST}}/{{TENANT_BACKUP_REPO}}.git
cd $(basename {{TENANT_BACKUP_REPO}})

# 3. Install OpenClaw (gives us ~/.openclaw scaffold)
#    Follow https://docs.openclaw.ai for the current install command.

# 4. Restore the workspace (overlay onto the empty scaffold)
rsync -a --exclude=.git --exclude=README.md --exclude=scripts --exclude=aria-backup.sh \
      ./ ~/.openclaw/

# 5. Re-pair this node (regenerates identity/device.json + device-auth.json)
openclaw    # follow the setup-code/QR prompt

# 6. Re-add provider API keys (they were NOT backed up)
#    Restore from your password manager.

# 7. Reinstall plugins
openclaw plugins install <plugin-name>   # repeat for each from prior config

# 8. Re-enable the backup itself
sudo cp scripts/systemd/aria-backup.service /etc/systemd/system/
sudo cp scripts/systemd/aria-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now aria-backup.timer

# 9. Sanity-check
openclaw status
ls -la ~/.openclaw/workspace/MEMORY.md
```

## Restore: partial — grab one file

```bash
git clone --depth 1 https://{{TENANT_BACKUP_REMOTE_HOST}}/{{TENANT_BACKUP_REPO}}.git /tmp/restore
cp /tmp/restore/workspace/memory/<filename>.md ~/.openclaw/workspace/memory/
rm -rf /tmp/restore
```

## Restore: time-travel — file as of a specific date

```bash
cd ~/aria-repo
git fetch origin
git log --before="<YYYY-MM-DD>" --oneline | head -1
git show <commit-sha>:workspace/MEMORY.md > /tmp/MEMORY-snapshot.md
```

## Verify backup integrity (monthly)

```bash
TEST_DIR=$(mktemp -d)
cd "$TEST_DIR"
git clone --depth 1 https://{{TENANT_BACKUP_REMOTE_HOST}}/{{TENANT_BACKUP_REPO}}.git restored
cd $(basename {{TENANT_BACKUP_REPO}})

# Critical files present?
for f in workspace/MEMORY.md {{TENANT_RECORDS_PATH}}; do
  test -f "$f" && echo "OK: $f ($(du -h "$f" | cut -f1))" || echo "MISSING: $f"
done

# Cache JSON intact? (adapt this check to the tenant's actual cache schema)
python3 -c "
import json, sys
with open('{{TENANT_RECORDS_PATH}}') as f: d = json.load(f)
# tenant-specific assertions go here
print('OK: integrity check passed')
"

# Secrets NOT present? (these MUST always be absent)
for bad in credentials openclaw.json identity/device.json agents/main/agent/auth-profiles.json; do
  test -e "$bad" && echo "LEAK: $bad SHOULD NOT BE HERE" || echo "OK: $bad correctly excluded"
done

cd / && rm -rf "$TEST_DIR"
```

## Common failures

| Symptom | Cause | Fix |
|---|---|---|
| `push: FAILED — check git auth` | Token expired, or repo divergence from manual commit | `cd ~/aria-repo && git pull --rebase origin {{TENANT_BACKUP_BRANCH}} && git push` |
| `large-file guard FAILED` | A new openclaw plugin dropped a big binary somewhere | Add the parent dir to `PURGE` in `aria-backup.sh` and to `.gitignore` |
| `Secret-pattern scan FAILED` | New file in workspace contains a real-looking secret | If real: add to `PURGE`. If false positive: add glob to `ALLOWLIST_GLOBS` with a comment |
| `privacy guard: REFUSING to push ... is PUBLIC` | Repo visibility was hand-toggled in the GitHub UI | Flip it back: `gh repo edit {{TENANT_BACKUP_REPO}} --visibility private --accept-visibility-change-consequences` |
| Push rejected `pre-receive hook declined`, "File X is N MB" | Old large file still in history | `git-filter-repo --invert-paths --path <bad-path>` then `git push --force origin {{TENANT_BACKUP_BRANCH}}` |
| Hourly timer healthy but `pushedAt` is stale | Backup running but push silently failing | `journalctl -u aria-backup.service -n 100 --no-pager` |
| `not a git repo: $ARIA_REPO_DIR` | `~/aria-repo` got nuked | Re-clone: `git clone https://{{TENANT_BACKUP_REMOTE_HOST}}/{{TENANT_BACKUP_REPO}}.git ~/aria-repo` |

## Things that should NOT be backed up here

If you find any of these in the repo, treat it as a security incident:
- Anything matching `*-private-key*`, `*.pem`, `*.token`
- Live API keys (model providers, search providers, voice providers, messaging bot tokens)
- Filebrowser admin password
- Messaging-platform pairing secrets
- Device Ed25519 private key (`identity/device.json`)
- **Anyone else's health data** — this backup is for the single tenant identified by `{{TENANT_ID}}` only

If found: add to `PURGE` array, run `git-filter-repo --invert-paths --path <bad-path>`, force-push, and **rotate the leaked credential**.

## Threat model & known risks

**Protects against:**
- VM disk failure / accidental `rm -rf` of `~/.openclaw/`
- Cloud-region outage (GitHub is separate from the VM's hosting provider)
- Single-bad-edit regret (any prior commit recoverable)

**Does NOT protect against:**
- GitHub account takeover — whoever holds `{{TENANT_GITHUB_LOGIN}}`'s credentials reads everything. Mitigation: 2FA + passkey on the account, fine-grained tokens for the gh CLI.
- GitHub itself being breached — tenant data is encrypted in transit (TLS) and at rest (GitHub server-side), but not under a key only the operator holds. Optional hardening: `age`-encrypt sensitive directories before commit, with the key in a separate password manager.
- Compromise of `~/.openclaw/openclaw.json` (not in backup, but on the VM) — that file holds every provider API key. VM compromise → key leak.

## Operator contacts (filled by onboarding skill)

- **Tenant private backup repo:** https://{{TENANT_BACKUP_REMOTE_HOST}}/{{TENANT_BACKUP_REPO}} (PRIVATE)
- **Backup script:** `~/tula/scripts/aria-backup.sh`
- **Systemd units:** `/etc/systemd/system/aria-backup.{timer,service}`
- **Filled instance of this runbook:** lives in the tenant's PRIVATE backup repo at `workspace/operator/BACKUP-RUNBOOK.md`, NOT in the public `realactivity/tula` repo.
