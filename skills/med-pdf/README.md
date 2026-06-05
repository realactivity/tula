# med-pdf

`med-pdf` reads medical PDFs (labs, radiology, MyChart exports, discharge
summaries, pathology) and turns them into structured JSON Tula can reason
over. It handles both text-extractable documents and image-only portal
exports via OCR.

The goal: every document the user shares becomes structured, cacheable,
longitudinal memory instead of a one-off chat attachment.

## Why this skill exists

Medical PDFs are the most common health artifact patients actually have.
Quest downloads, LabCorp reports, MyChart imaging exports, and phone
screenshots all arrive as opaque files. Without structured extraction,
agents summarize once and forget.

This skill standardizes:

- extract -> branch on `hasText` -> parse labs and/or imaging -> reason -> persist
- healthspan-aware flagging (see [`references/healthspan-priorities.md`](references/healthspan-priorities.md))
- clean handoff to `epic-note` when the user wants a portal message instead

## What it produces

Artifacts persist under:

`~/.openclaw/workspace/.med-pdf-cache/<slug>/`

Expected outputs per run:

- `text.txt`, `pageN.png`, `meta.json` from `scripts/extract.mjs`
- structured lab JSON from `scripts/parse_labs.mjs`
- structured imaging JSON from `scripts/parse_imaging.mjs`
- dated notes in `memory/YYYY-MM-DD.md` and trend updates in `MEMORY.md`

Runtime profile (optional addressing) resolves from
[`references/profile-schema.md`](references/profile-schema.md).

## Safety model

`med-pdf` is constrained by design:

- cache and PHI stay inside `~/.openclaw/workspace/`
- no raw PDFs or PHI sent to web search or external services
- `image` tool OCR stays inside the assistant trust boundary
- refuses insurance/EOB/billing PDFs (non-medical)
- hands off portal message drafting to `epic-note`

## Skill structure

- Runtime instructions: [`SKILL.md`](SKILL.md)
- Profile resolution: [`references/profile-schema.md`](references/profile-schema.md)
- Script contracts: [`references/scripts.md`](references/scripts.md)
- Healthspan flag rubric: [`references/healthspan-priorities.md`](references/healthspan-priorities.md)
- Worked examples: [`references/examples.md`](references/examples.md)

## Local quality checks

From repo root:

```powershell
waza check skills/med-pdf
bash scripts/waza-gate.sh
```

Deterministic script smoke (fixture PDF or sample in workspace):

```powershell
node skills/med-pdf/scripts/extract.mjs <input.pdf> <outDir>
node skills/med-pdf/scripts/parse_labs.mjs <outDir>
node skills/med-pdf/scripts/parse_imaging.mjs <outDir>
```

## Use with OpenClaw

1. Deploy:

```bash
~/tula/scripts/deploy-skills.sh --skill med-pdf
openclaw skills list
```

2. Invoke naturally:

- "Here's my latest lab PDF - what changed?"
- "Parse this MyChart imaging export."
- "Compare this CBC to my last one."

Requires Node on the VM (`metadata.openclaw.requires.bins: ["node"]`).

## Waza evaluation suite

**Status:** live ([Patient Agent Eval Standard v0.1](../../evals/README.md))

Suite path: `evals/med-pdf/` (8 tasks including golden lab parse)

Full scenario map: [`evals/med-pdf/README.md`](../../evals/med-pdf/README.md) (repo root).

```powershell
waza check skills/med-pdf
waza run evals/med-pdf/eval.mock.yaml --skip-graders -v
waza run evals/med-pdf/eval.yaml -v
```

### Interpreting results

- **Negative-trigger** and **redirect** failures indicate routing drift.
- **PHI boundary** and **adversarial** failures are release blockers.
- **Chart fidelity** task asserts abnormal flags match fixture values.

## Release gate

Before production release:

- pass `waza check skills/med-pdf`
- pass `bash scripts/waza-gate.sh`
- pass `waza run evals/med-pdf/eval.mock.yaml --skip-graders -v`
- pass live `waza run evals/med-pdf/eval.yaml -v`
- smoke-test extract + parse on one text PDF and one image-only export
