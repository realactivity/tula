# Skills Development Guide

How Tula skills are authored, tested, and deployed to a running OpenClaw
agent.

## Architecture

```
┌──────────────────────┐         ┌──────────────────────┐
│   tula/ (this repo)  │         │   OpenClaw on VM     │
│                      │         │                      │
│  skills/             │         │  ~/.openclaw/        │
│   ├── AGENTS.md      │         │   workspace/         │
│   ├── epic-note/     │ ──────▶ │    skills/           │
│   ├── med-pdf/       │  rsync  │     ├── epic-note/   │
│   └── ...              │         │     ├── med-pdf/     │
│                      │         │     └── ...            │
│  evals/              │         │                      │
│   └── <skill>/       │         │  Agent uses the      │
│     └── tasks/       │         │  skills at runtime.  │
│                      │         │                      │
│  Source of truth.    │         │  Runtime only.       │
│  Where Waza tests.   │         │  No tests run here.  │
└──────────────────────┘         └──────────────────────┘
```

- **`tula/`** is the source of truth. Skills are authored, version-controlled,
  and tested here. Each skill ships with an evaluation suite under `evals/`.
- **OpenClaw on the VM** is the runtime. Skills are deployed there as plain
  directories under `~/.openclaw/workspace/skills/`.
- **Waza** is the local testing tool - it parses `SKILL.md`, scaffolds eval
  tasks, executes them against a model, and grades the output. Waza never
  runs on the VM.

## Priority Rule

When authoring or refactoring a skill, the priority is **non-negotiable**:

1. **OpenClaw runtime fidelity comes first.** A skill must be parsed and used
   correctly by openclaw's agent. The
   [official openclaw skill spec](https://github.com/openclaw/openclaw/blob/main/docs/tools/skills.md)
   governs what's required.
2. **Waza checks are secondary polish.** Apply Waza recommendations only
   when they don't reduce openclaw fidelity.

This is documented in [`tula/skills/AGENTS.md`](../skills/AGENTS.md). Read it
before writing a new skill.

## House Style

Tula skills follow the openclaw canonical style - see `med-pdf` as the
reference template:

- `name` + `description` in frontmatter (single-line)
- Optional `metadata.openclaw` (single-line JSON) for emoji and gating
- Body sections in this order:
  - `## When to Use` - ✅ trigger list
  - `## When NOT to Use` - ❌ anti-trigger list
  - `## Workflow` - numbered, agent-directed steps
  - `## Examples` - linked to `references/examples.md`
  - `## Privacy` - when PHI or sensitive data is involved
  - `## Troubleshooting` - common failure modes
- Long content lives in `references/` modules linked from `SKILL.md`
- Scripts live in `scripts/` (Node ESM `.mjs` preferred)

Voice: second person, agent-directed, imperative, terse. See
[`tula/skills/AGENTS.md`](../skills/AGENTS.md) for the full conventions.

## Existing Skills

| Skill | Purpose | Status |
|---|---|---|
| [`epic-note`](../skills/epic-note/) | Drafts patient-portal messages for PCP/specialist | Complete, 4 eval tasks |
| [`med-pdf`](../skills/med-pdf/) | Parses medical PDFs into structured JSON | Complete, 5 eval tasks. **Reference template.** |

## Authoring a New Skill

```powershell
# 1. Scaffold
waza new skill <name>

# 2. Refactor SKILL.md to match med-pdf house style
#    - drop license: field
#    - swap ## Trigger phrases -> ## When to Use ✅
#    - add ## When NOT to Use ❌, ## Privacy, ## Troubleshooting
#    - move long content into references/
#    - add metadata.openclaw.requires.bins if scripts need them

# 3. Validate
waza check skills/<name>
#    Targets:
#      Spec Compliance: 9/9
#      Links: all valid
#      Module count: 2-3
#      Token budget: prefer <500, accept higher if openclaw fidelity demands it

# 4. Scaffold and customize evals
waza new eval <name>
#    Edit tasks/*.yaml with realistic scenarios:
#      - 1-2 positive triggers
#      - 1-2 negative triggers (anti-trigger / wrong-skill routing)
#      - 1 safety/PHI boundary task if applicable

# 5. Test against the eval
waza run evals/<name>/eval.yaml -v
#    Requires GitHub Copilot CLI authenticated (see "Testing" below)
```

## Testing

Waza supports two executors:

| Executor | Auth needed | Use case |
|---|---|---|
| `mock` | None | Validate eval pipeline structure (graders fire, schema OK) |
| `copilot-sdk` | GitHub Copilot CLI authenticated | Real model evaluation against `claude-sonnet-4.6` |

To use real model evals you need a **GitHub Copilot subscription** (free tier
works). Install and authenticate the CLI:

```powershell
npm install -g @github/copilot
copilot
# inside the TUI: /login
# follow device-code flow in browser
# then /exit
```

After login, `waza run evals/<skill>/eval.yaml -v` will execute against
`claude-sonnet-4.6` via Copilot.

Switch eval.yaml to `executor: mock` for offline structure testing.

## Deploying to the VM

Skills are deployed by **pulling** on the VM, not pushing from your laptop.
This works regardless of host OS (Windows/macOS/Linux) and matches how
openclaw expects to be administered.

### One-time setup on the VM

```bash
ssh <your-openclaw-vm>
git clone https://github.com/realactivity/tula.git ~/tula
chmod +x ~/tula/scripts/deploy-skills.sh
```

### Every deploy after that

```bash
ssh <your-openclaw-vm>
~/tula/scripts/deploy-skills.sh
```

This script:

1. `git pull --ff-only` in `~/tula`
2. `rsync -a --delete` every directory under `tula/skills/` that has a
   `SKILL.md` to `~/.openclaw/workspace/skills/<name>/`
3. Runs `openclaw skills list` and confirms each deployed skill shows
   `✓ ready`

Useful flags:

| Flag | Effect |
|---|---|
| `--dry-run` | Show planned changes, don't write |
| `--skill <name>` | Deploy a single skill |
| `--no-pull` | Skip `git pull` (use whatever's checked out) |
| `--no-verify` | Skip the `openclaw skills list` check |

OpenClaw's skills watcher picks up new/changed skills automatically - no
daemon restart needed.

### Why not rsync from your laptop?

It works on macOS/Linux (`rsync -av --delete skills/<name>/ user@host:...`),
but on Windows it requires WSL or Cygwin to get rsync. The VM-pull pattern
sidesteps that and gives you `git pull` + verification for free.

### Don't deploy `evals/`

Evals stay in `tula/` and run locally only. The deploy script enforces this
by only syncing directories under `skills/`.

## Privacy

- PHI never leaves the agent's workspace at runtime.
- The `tula` repo and its `evals/` use only synthetic patient context.
- Real medical PDFs and personal data are kept on the VM under
  `~/.openclaw/workspace/.med-pdf-cache/`, `workspace/memory/`, and
  `workspace/MEMORY.md`.
- Backups of the VM workspace go to a **private** sister repo (not this one)
  via the `agent-backup.sh` script. See [`scripts/README.md`](../scripts/README.md).

## References

- [OpenClaw skill spec](https://github.com/openclaw/openclaw/blob/main/docs/tools/skills.md) - definitive
- [agentskills.io spec](https://agentskills.io) - what openclaw is compatible with
- [Microsoft Waza](https://github.com/microsoft/waza) - eval framework used here
- [`tula/skills/AGENTS.md`](../skills/AGENTS.md) - Tula's own conventions doc
