# request-amendment

`request-amendment` drafts HIPAA-aligned health-record amendment requests.
It separates patient claims from source-record evidence, tracks response
timelines under 45 CFR 164.526, and optionally prepares draft FHIR Task JSON
(without auto-posting).

The goal: help patients correct the chart with neutral language, regulatory
fidelity, and zero implied legal promises.

## Why this skill exists

Record errors are common; amendment workflows are opaque. Patients either
send angry portal messages or give up. Covered entities have timeline
obligations; patients need structured packages that preserve evidence
boundaries and avoid coercive language.

This skill addresses:

- factual correction vs. clinical dispute vs. omitted context
- denied-amendment follow-up (statement of disagreement)
- FHIR Task draft-only posture behind feature flags
- resistance to PHI exfiltration and "just submit it for me" pressure

## What it produces

A typical amendment package includes:

- issue classification and cited source excerpt
- labeled `patient_says` vs. `record_shows` sections
- proposed provider-facing amendment language
- patient letter draft
- HIPAA timeline checklist (60 days + one 30-day extension)
- optional draft FHIR Task JSON when `request_amendment.fhir_task_draft` is enabled

All artifacts stay inside `~/.openclaw/workspace/`. Never auto-post to an EHR.

## Safety model

`request-amendment` is constrained by design:

- no legal advice, diagnosis, or treatment recommendations
- no threats, accusations, or coercive language
- no promise that the provider must accept the amendment
- PHI never sent to web tools or external APIs
- FHIR POST only when both feature flag and explicit user approval are present
- sensitive domains (behavioral health, SUD, minors) use neutral escalation language

## Skill structure

- Runtime instructions: [`SKILL.md`](SKILL.md)
- HIPAA timeline rules: [`references/hipaa-164-526.md`](references/hipaa-164-526.md)
- FHIR Task draft contract: [`references/fhir-task-amendment.md`](references/fhir-task-amendment.md)
- Script usage: [`references/scripts.md`](references/scripts.md)
- Worked examples: [`references/examples.md`](references/examples.md)

Deterministic helpers:

```powershell
node {baseDir}/scripts/calc_deadline.mjs <receiptDate?>
node {baseDir}/scripts/validate_fhir_task.mjs <task.json>
node {baseDir}/scripts/redact_phi_for_eval.mjs <input.json> <output.json>
```

## Local quality checks

From repo root:

```powershell
waza check skills/request-amendment
bash scripts/waza-gate.sh
```

## Use with OpenClaw

1. Deploy:

```bash
~/tula/scripts/deploy-skills.sh --skill request-amendment
openclaw skills list
```

2. Invoke:

- "My chart says I have diabetes but I was only pre-diabetic - help me request a correction."
- "They denied my amendment - what do I do next?"
- "Draft the amendment package but don't post anything to the portal."

3. Feature flags in `openclaw.json` (optional):

- `request_amendment.fhir_task_draft` - emit Task JSON locally
- `request_amendment.fhir_task_post` - never enable without explicit ops review

## Waza evaluation suite

**Status:** live ([Patient Agent Eval Standard v0.1](../../evals/README.md))

Suite path: `evals/request-amendment/` (12 tasks including golden full package)

Full scenario map: [`evals/request-amendment/README.md`](../../evals/request-amendment/README.md) (repo root).

| Lane | File | Purpose |
|---|---|---|
| Structural | `eval.mock.yaml` | CI gate (`--skip-graders`; excludes golden) |
| Certification | `eval.yaml` | Live model + golden deterministic task |

### Run commands

```powershell
waza check skills/request-amendment
waza run evals/request-amendment/eval.mock.yaml --skip-graders -v
waza run evals/request-amendment/eval.yaml -v
```

Prior live snapshot (pre-v0.1 expansion, 10-task suite): **8/10 passed,
aggregate 0.97** on `claude-sonnet-4.6`. Re-run live certification after
merge; see `docs/roadmap.md`.

### Interpreting results

- Failures in **PHI boundary**, **adversarial**, or **overclaim** tasks are release blockers.
- **Golden deterministic** task is the demo-grade showcase for reviewers.

## Release gate

Before production release:

- pass `waza check skills/request-amendment`
- pass `bash scripts/waza-gate.sh`
- pass `waza run evals/request-amendment/eval.mock.yaml --skip-graders -v`
- pass live `waza run evals/request-amendment/eval.yaml -v` at >= 0.85 aggregate
- confirm safety-critical tasks pass (PHI, adversarial, no auto-submit)
- run `validate_fhir_task.mjs` on any draft Task JSON path when FHIR mode is enabled
- manual smoke on VM with synthetic scenario before real PHI
