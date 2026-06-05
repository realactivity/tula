# memory-diff

`memory-diff` surfaces what changed in the user's health since a reference
point (date, named event, or "since last X"). It reads workspace memory from
`health-records`, `med-pdf`, `myhealth-pulse`, and dated notes, then tiers
changes by clinical significance.

The goal: longitudinal awareness without re-fetching the chart or re-parsing
PDFs every time the user asks "what's new?"

## Why this skill exists

After records pulls and PDF parses, the workspace holds rich state - but
users ask temporal questions: "since my last visit," "since I started
metformin," "what changed this week?"

This skill:

- scans documented memory paths in precedence order
- classifies deltas into Tier 1 / Tier 2 / Tier 3 (see
  [`references/clinical-significance.md`](references/clinical-significance.md))
- emits a digest ending with `Powered by memory-diff - window: ..., sources: ...`
- handles empty windows without fabricating changes

## What it produces

Primary output is a **tiered change digest** in chat.

Optional cache:

`~/.openclaw/workspace/.memory-diff-cache/<YYYY-MM-DD>.md`

Reads from (precedence in [`references/memory-paths.md`](references/memory-paths.md)):

- `.health-records-cache/`, `.med-pdf-cache/`, `.myhealth-pulse-cache/`
- `MEMORY.md`, `memory/YYYY-MM-DD.md`

Eval fixtures use synthetic persona **Dylan Meyer** / PCP **Dr. Dave Matthews**.

## Safety model

`memory-diff` is constrained by design:

- reads local workspace only; no external API calls
- no medical advice - surfaces changes, not treatment recommendations
- empty window -> honest "nothing found" response
- routes news/social to `myhealth-pulse`, PDFs to `med-pdf`, chart to
  `health-records`, drafts to `epic-note`

## Skill structure

- Runtime instructions: [`SKILL.md`](SKILL.md)
- Memory sources and precedence: [`references/memory-paths.md`](references/memory-paths.md)
- Tier rubric: [`references/clinical-significance.md`](references/clinical-significance.md)
- Output examples: [`references/examples.md`](references/examples.md)

## Local quality checks

From repo root:

```powershell
waza check skills/memory-diff
bash scripts/waza-gate.sh
```

Fixture workspace for evals:

`evals/memory-diff/fixtures/` (MEMORY.md + dated memory files).

## Use with OpenClaw

1. Deploy:

```bash
~/tula/scripts/deploy-skills.sh --skill memory-diff
openclaw skills list
```

2. Invoke after other skills have populated memory:

- "What's changed in my health since last week?"
- "What's new since my PCP visit on April 30?"
- "Summarize changes since I started lisinopril."

Best results when `health-records` and/or `med-pdf` have run recently.

## Waza evaluation suite

**Status:** live ([Patient Agent Eval Standard v0.1](../../evals/README.md))

Suite path: `evals/memory-diff/` (7 tasks including golden diff)

Full scenario map: [`evals/memory-diff/README.md`](../../evals/memory-diff/README.md) (repo root).

```powershell
waza check skills/memory-diff
waza run evals/memory-diff/eval.mock.yaml --skip-graders -v
waza run evals/memory-diff/eval.yaml -v
```

### Interpreting results

- **`empty-window`** and **chart-fidelity** failures indicate invented deltas.
- **Golden** task validates Tier 1 item from 2026-04-30 fixture visit.

## Release gate

Before production release:

- pass `waza check skills/memory-diff`
- pass `bash scripts/waza-gate.sh`
- pass `waza run evals/memory-diff/eval.mock.yaml --skip-graders -v`
- pass live `waza run evals/memory-diff/eval.yaml -v`
- smoke-test on VM after a real records pull + PDF parse cycle
