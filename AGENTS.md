# AGENTS.md - Tula repo guide for coding agents

You are working in **realactivity/tula**: the open-source Tula skill and eval
repo. Read this file first. It is the canonical orientation for Cursor, Copilot,
Codex, Claude Code, and other repo-scoped coding agents.

**Not the same file as:**

- [`skills/AGENTS.md`](skills/AGENTS.md) - how to author OpenClaw skills
- [`docs/agent/AGENTS.md`](docs/agent/AGENTS.md) - runtime workspace playbook on a
  deployed VM (`~/.openclaw/workspace/`). Do not copy that file here.

---

## What Tula is (30 seconds)

Tula is a **personal health intelligence agent** built on
[OpenClaw](https://github.com/openclaw/openclaw). Skills run on a self-hosted
VM; health data stays in the user's workspace. This repo ships skills, Waza eval
suites, deploy scripts, and the **Patient Agent Eval Standard v0.1** (forkable
by any patient-facing agent vendor).

**Watch first:**

- [YouTube live demo (~16 min)](https://youtu.be/FcLl6fASpgw) - Epic MyChart at
  [10:00](https://youtu.be/FcLl6fASpgw?t=600)
- [Video guide](docs/demo.md) - both videos, share copy, next steps
- [Podcast interview (~17 min)](https://agentandcopilot.com/cloud-wars-minute/ai-agent-and-copilot-podcast-openclaw-powered-healthcare-assistant-builds-patient-agency/)

**Fork the eval standard:** [`evals/README.md`](evals/README.md) (78 tasks, 8
skills + composition bundle). Article:
[`articles/how-will-you-know-if-your-patient-ai-is-working.md`](articles/how-will-you-know-if-your-patient-ai-is-working.md).

---

## Repo map

| Path | What lives here |
|---|---|
| [`skills/`](skills/) | OpenClaw skills (core product). Each skill: `SKILL.md`, `references/`, `scripts/` |
| [`evals/`](evals/) | Waza eval suites per skill + composition bundle + `_templates/` |
| [`docs/`](docs/) | Architecture, deploy guide, eval status, build spec, runtime agent templates |
| [`apps/`](apps/) | My Aria patient portal UI |
| [`services/wren/`](services/wren/) | Self-hostable SMART on FHIR records relay |
| [`scripts/`](scripts/) | CI gates, deploy-skills, backup, eval runners |
| [`templates/`](templates/) | Tenant onboarding placeholders (`{{UPPER_SNAKE}}`) |
| [`articles/`](articles/) | Published technical writing |
| [`results/`](results/) | Gitignored live eval JSON snapshots (optional publish) |

Eval suites live at `evals/<skill>/`, **not** inside `skills/<skill>/`.

Live agent state on a deployed VM:
`/home/azureuser/.openclaw/workspace/`. Do not edit VM workspace files unless
the task brief says so.

---

## Hard rules (non-negotiable)

1. **DCO sign-off on every commit.** `git commit -s`. See [`CONTRIBUTING.md`](CONTRIBUTING.md).
2. **ASCII only.** No em-dashes, curly quotes, Unicode arrows. Run
   `node scripts/strip-ai-chars.mjs --dry <paths>` on new files.
3. **No PHI in public commits.** No real patient names, MRNs, hospital names,
   operator login IDs in operator-facing content. Synthetic persona only in
   evals: **Dylan Meyer** / **Dr. Dave Matthews**. Use `{{PLACEHOLDERS}}` in
   templates.
4. **Conventional commits.** `feat:`, `docs:`, `fix:`, `refactor:`, `chore:`.
   Body explains why, not just what.
5. **Open-core scope.** Read [`OPEN_CORE.md`](OPEN_CORE.md) before large features.
   Aria commercial platform code stays out of this repo.
6. **Never deploy `evals/` to the VM.** Deploy script syncs `skills/` only.
7. **Backup script names.** Use `agent-backup.sh` / `AGENT_REPO_DIR`, not legacy
   `aria-backup` / `ARIA_REPO_DIR`.

---

## Reference skills (clone these)

| Goal | Skill | Path |
|---|---|---|
| Best eval depth + strict gate (1.0) | prep-my-visit | [`skills/prep-my-visit/`](skills/prep-my-visit/) |
| Showcase evals (HIPAA, FHIR, golden) | request-amendment | [`skills/request-amendment/`](skills/request-amendment/) |
| SKILL.md layout for new skills | med-pdf | [`skills/med-pdf/`](skills/med-pdf/) |
| Profile schema (reference, don't embed) | myhealth-pulse | [`skills/myhealth-pulse/`](skills/myhealth-pulse/) |

Skill authoring detail: [`skills/AGENTS.md`](skills/AGENTS.md).

Eval recreate guide:
[`docs/build-spec-patient-agent-eval-standard-v0.1.md`](docs/build-spec-patient-agent-eval-standard-v0.1.md).

---

## Patient Agent Eval Standard v0.1 (required for new skills)

Every skill suite under `evals/<name>/` must include tasks tagged:

- `routing-positive`, `routing-negative`, `phi-boundary`, `adversarial`, `golden`

Golden tasks go in `tasks/golden/` (live lane only). Copy templates from
[`evals/_templates/`](evals/_templates/).

Two-lane model:

| Lane | File | CI command |
|---|---|---|
| Structural | `eval.mock.yaml` | `waza run eval.mock.yaml --skip-graders` |
| Certification | `eval.yaml` | `waza run eval.yaml -v` (manual; needs Copilot auth) |

Mock executor returns stub output; **always** use `--skip-graders` in CI mock
runs. See [`scripts/run-eval-mock-all.sh`](scripts/run-eval-mock-all.sh).

---

## Verification before opening a PR

```bash
# All skills (spec + links)
bash scripts/waza-gate.sh

# One skill
waza check skills/<name>

# Eval taxonomy + mock lanes (when evals/ changed)
bash scripts/lint-eval-taxonomy.sh
bash scripts/run-eval-mock-all.sh

# ASCII on new/changed files
node scripts/strip-ai-chars.mjs --dry <paths>

# Bash script syntax
bash -n scripts/<name>.sh

# PHI grep (public paths)
grep -rnE "Driscoll|Lawrence General|beverly|realactivity/tula-vm-state" skills/ evals/ docs/
```

Commit:

```bash
git commit -s -m "feat(<scope>): short description

Why this change matters."
```

---

## Good first contributions (engagement)

High impact, bounded scope - pick one:

| Contribution | Where to start |
|---|---|
| Add eval task to existing skill | Copy from [`evals/_templates/`](evals/_templates/); run lint + mock |
| Fix docs after following deploy guide | [`docs/deployment-guide.md`](docs/deployment-guide.md) |
| Propose community skill | [Discussions](https://github.com/realactivity/tula/discussions) + [`docs/community-skills.md`](docs/community-skills.md) |
| Fork eval standard for your agent | [`evals/README.md`](evals/README.md); open Discussion linking your fork |
| Chart-fidelity or adversarial task | Study [`evals/prep-my-visit/`](evals/prep-my-visit/) |

**High-value (larger):** new skill + full eval suite (five dimensions + README +
`eval.mock.yaml`). Use [`med-pdf/`](skills/med-pdf/) for SKILL.md shape and
[`prep-my-visit/`](evals/prep-my-visit/) for eval depth.

**Out of scope for this repo:** multi-tenant Aria runtime, hospital SSO at scale,
production PHI fixtures. See [`OPEN_CORE.md`](OPEN_CORE.md).

If you adapt the Patient Agent Eval Standard for another product, link back and
tell us in a Discussion. We track forks to improve the RFC.

---

## Pointer index (read these next, do not duplicate)

| Topic | Document |
|---|---|
| Human README | [`README.md`](README.md) |
| Contributing + DCO | [`CONTRIBUTING.md`](CONTRIBUTING.md) |
| Skill authoring | [`skills/AGENTS.md`](skills/AGENTS.md) |
| Skills dev workflow | [`docs/skills-development.md`](docs/skills-development.md) |
| Eval standard RFC | [`evals/README.md`](evals/README.md) |
| Agent build spec | [`docs/build-spec-patient-agent-eval-standard-v0.1.md`](docs/build-spec-patient-agent-eval-standard-v0.1.md) |
| Deploy to VM | [`docs/deployment-guide.md`](docs/deployment-guide.md) |
| Eval compliance table | [`docs/evals.md`](docs/evals.md) |
| Runtime workspace agent | [`docs/agent/AGENTS.md`](docs/agent/AGENTS.md) |
| Claude Code notes | [`CLAUDE.md`](CLAUDE.md) |
| Open vs Aria scope | [`OPEN_CORE.md`](OPEN_CORE.md) |
| Enterprise / pilots | [`docs/enterprise-pilots.md`](docs/enterprise-pilots.md) |

---

## Skill shape (quick reference)

```
skills/<name>/
  SKILL.md
  README.md
  references/
  scripts/

evals/<name>/
  eval.yaml
  eval.mock.yaml
  README.md
  tasks/*.yaml
  tasks/golden/*.yaml
  fixtures/
```

- `SKILL.md` description must be quoted in YAML frontmatter.
- Run `waza check skills/<name>` before commit. Link errors fail CI.
- Reference files must be linked from SKILL.md (no orphans).
- Examples in `references/examples/` must be linked from `references/examples.md`.

Full conventions: [`skills/AGENTS.md`](skills/AGENTS.md).

---

## Templates and placeholders

[`templates/`](templates/) uses `{{UPPER_SNAKE}}` placeholders. Vocabulary:
[`templates/README.md`](templates/README.md). Never commit real tenant data.

---

## Questions

- Bug or unclear docs: [GitHub Issues](https://github.com/realactivity/tula/issues)
- Skill ideas: [Discussions](https://github.com/realactivity/tula/discussions)
- Commercial / hospital scale: [`docs/enterprise-pilots.md`](docs/enterprise-pilots.md)
