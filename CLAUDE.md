# CLAUDE.md — Tula repo orientation for Claude Code

You are a coding subagent working in `realactivity/tula`, the open-source Tula skill repo. Read this before touching anything.

## What this repo is

Tula is a personal health intelligence agent built on OpenClaw. This repo contains:
- `skills/` — OpenClaw agent skills (the core product)
- `evals/` — Waza eval suites for each skill
- `scripts/` — backup pipeline, deploy, provisioning, CI helpers
- `templates/` — golden-image tenant-onboarding templates
- `apps/` — My Aria patient portal UI
- `articles/` — published technical writing
- `docs/` — architecture and guides

## Hard rules before you commit anything

1. **DCO sign-off required on every commit.** Use `git commit -s`. CI will reject without `Signed-off-by: Paul J. Swider <pswider@realactivity.com>`.
2. **ASCII only.** No em-dashes (`—`), curly quotes (`""`), arrows (`→`). Run `node scripts/strip-ai-chars.mjs` on any new files before committing. CI runs this check.
3. **No PHI in public commits.** Patient names, MRNs, health system names, backup repo URLs, GitHub login `pswider` in operator-facing content — these belong in the private `tula-vm-state` repo, not here. Use `{{PLACEHOLDERS}}` for anything tenant-specific.
4. **Conventional commits.** `feat:`, `docs:`, `fix:`, `refactor:`, `chore:`. Body should tell the story — reviewers read `git log`.
5. **Stay on your branch.** Check `git branch` first. Never force-push without explicit authorization in your task brief.

## Skill authoring house style

Every skill lives in `skills/<name>/` with this shape:
```
skills/<name>/
  SKILL.md          # frontmatter (name, description, metadata) + body
  references/       # docs loaded on demand
  scripts/          # deterministic helpers
  evals/<name>/     # waza eval suite (lives at evals/, not inside skills/)
```

- `SKILL.md` description must be quoted in frontmatter YAML.
- Run `waza check skills/<name>` before committing. Advisories are ok; link errors and orphaned files are not.
- Reference files must be linked from somewhere in the skill (not orphaned).
- Example fixtures go in `references/examples/` and must be linked from `references/examples.md`.

## Backup pipeline

The backup script was renamed: `aria-backup.sh` → `agent-backup.sh` (commit `3667e11`). Variable names also changed (`ARIA_REPO_DIR` → `AGENT_REPO_DIR`, etc.). Don't create new references to the old names.

## Templates

`templates/` uses `{{UPPER_SNAKE}}` placeholders. See `templates/README.md` for the full placeholder vocabulary. Never put real tenant data in a template file.

## Verification before reporting done

```bash
# Bash scripts
bash -n scripts/<name>.sh

# ASCII check on new files
node scripts/strip-ai-chars.mjs --dry <paths>

# Skill structural check
waza check skills/<name>

# Skill script smoke test (if applicable)
bash evals/<name>/run_script_checks.sh

# PHI grep (for public-repo commits)
grep -rnE "pswider|realactivity/tula-vm-state|beverly|Driscoll|amlodipine|Zepbound" <paths>
```

## Commit the right way

```bash
git add <files>
git commit -s -m "feat(<scope>): short description

Longer body explaining why, not just what. Reference any design
decisions or trade-offs. If something was risky, say so."
```

## What's in the live VM workspace (don't confuse with this repo)

The agent's live state lives at `/home/azureuser/.openclaw/workspace/`. That's a separate location. Some files from this repo get deployed there via `scripts/deploy-skills.sh`. Don't edit live workspace files unless your task brief specifically says to — that's Tula's home, not a dev sandbox.
