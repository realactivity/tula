# Backups

<!--
L2 / load-on-demand. How this tenant's state is backed up. Populate once a
backup pipeline is actually running. If none is set up yet, this file can say
so in one line — "no automated backup yet" — and that honesty is the point.
The reference implementation is scripts/aria-backup.sh + scripts/BACKUP-RUNBOOK.md
in the source repo.
-->

## Architecture (one-liner)
`~/.openclaw/` -> `rsync --delete` (with PURGE list) -> local git repo -> `git push` -> `{{TENANT_BACKUP_REPO}}` (private).

## Schedule
<!-- e.g. hourly systemd timer at /etc/systemd/system/aria-backup.timer.
     State cadence, smear, Persistent=, RuntimeMaxSec=, and the failure handler. -->

## Script
`scripts/aria-backup.sh` (source of truth lives in the tula source repo; deployed copy runs on the VM).

## Pre-commit guards (all must pass before push)
1. **Secret scan** — regex for tokens/keys, with an allowlist for false positives. Aborts on hit.
2. **Large-file guard** — refuses to stage any file over the configured cap (default 50 MB, under GitHub's 100 MB hard cap). Aborts on hit.
3. **Privacy guard** — checks remote visibility and refuses to push if the repo is not PRIVATE. Aborts on hit.

## What's backed up
<!-- The workspace brain (MEMORY.md, daily notes, skills, caches), agent state,
     identity (sans private device key). List the specifics for this tenant. -->

## What's NOT backed up (and why)
| Path | Reason |
|---|---|
| `credentials/`, `auth-profiles*.json`, `identity/device.json`, `identity/device-auth.json`, `devices/paired.json` | Live secrets / device private keys |
| `openclaw.json*` | Holds every provider API key |
| `agents/main/sessions/` | Chat trajectories — large + privacy-sensitive |
| `logs/`, `update-check.json`, `exec-approvals.json` | Regenerable noise |
| `plugin-runtime-deps/`, `npm/` | Third-party code, hundreds of MB, reinstallable via `openclaw plugins install` |
| `**/.git/` (except the backup repo's own) | Nested checkouts |

## Repo posture
<!-- Verified <YYYY-MM-DD>: visibility PRIVATE, approximate size, and a note on
     whether sensitive data folders are intentionally included (see
     stewardship.md — this is a per-frame decision). -->
- **Repo:** `{{TENANT_BACKUP_REPO}}`
- **Branch:** `{{TENANT_BACKUP_BRANCH}}`
- **Visibility:** PRIVATE (enforced by the privacy guard)

## Runbook
**Full operator runbook:** `scripts/BACKUP-RUNBOOK.md` — full DR clone on a fresh VM, partial file recovery, time-travel restore, monthly integrity check, common-failure table, threat model.

## Active-state checks
```bash
# Is the timer healthy?
systemctl status aria-backup.timer aria-backup.service --no-pager -l

# Last successful push?
gh repo view {{TENANT_BACKUP_REPO}} --json pushedAt -q .pushedAt

# Local vs remote drift?
cd ~/aria-repo && git fetch origin && git status -sb
```

## When NOT to re-recommend
Once backups are running, don't propose setting them up. If asked "is the backup working?" — actually run the checks above; don't extrapolate.
