# CLAUDE.md - Claude Code notes

**Read [`AGENTS.md`](AGENTS.md) first.** It is the canonical repo guide for all
coding agents (orientation, hard rules, verification, contribution paths).

This file adds Claude Code-specific notes only.

## Claude Code

- Prefer the repo verification commands in `AGENTS.md` before reporting done.
- On Windows dev machines, run bash scripts via Git Bash when PowerShell lacks
  `bash`/`jq`: `"C:\Program Files\Git\bin\bash.exe" -lc "cd /path/to/tula && ..."`
- Live Waza runs need Copilot CLI auth; mock CI does not.
- Do not commit unless the user asks. When committing, always `git commit -s`.

## Quick links

- Skill authoring: [`skills/AGENTS.md`](skills/AGENTS.md)
- Eval build spec: [`docs/build-spec-patient-agent-eval-standard-v0.1.md`](docs/build-spec-patient-agent-eval-standard-v0.1.md)
- Runtime workspace (VM, not this repo): [`docs/agent/AGENTS.md`](docs/agent/AGENTS.md)
