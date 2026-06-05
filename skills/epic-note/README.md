# epic-note

`epic-note` drafts concise patient-portal messages the user can copy-paste
into Epic MyChart, Oracle Health HealtheLife, or similar systems. One clear
ask, plain language, copy-paste ready output.

The goal: help patients communicate with their care team without the agent
ever auto-sending or playing doctor.

## Why this skill exists

Portal messaging is high-friction for patients and high-risk for agents.
Users dump symptoms, meds, and anxiety into one paragraph; agents either
over-diagnose or produce walls of text clinicians ignore.

This skill enforces:

- triage-first (911 redirect beats drafting on red flags)
- single-ask discipline with a 150-word aim / 220-word cap
- canonical portal format from [`references/portal-message-format.md`](references/portal-message-format.md)
- default clinician greeting from profile `care_team.pcp` when unspecified

## What it produces

Primary output is **copy-paste ready portal text** in chat:

- `Subject:` line with urgency tier
- greeting, one-sentence ask, brief context, optional bullets, sign-off
- no meta-commentary wrapped around the message

Runtime profile resolves from
[`references/profile-schema.md`](references/profile-schema.md). Eval fixtures
use synthetic persona **Dylan Meyer** and PCP **Dr. Dave Matthews**.

## Safety model

`epic-note` is constrained by design:

- **never auto-send** - drafts only
- emergency symptoms -> 911/ED redirect, not a portal message
- no clinical notes (SOAP, discharge, dictation)
- no insurance/billing letters
- medical-advice questions answered directly, not via a draft to a clinician
- PHI stays in the workspace; no web verification of clinician identifiers

## Skill structure

- Runtime instructions: [`SKILL.md`](SKILL.md)
- Profile resolution: [`references/profile-schema.md`](references/profile-schema.md)
- Portal message format: [`references/portal-message-format.md`](references/portal-message-format.md)
- Red-flag triage rules: [`references/triage-rules.md`](references/triage-rules.md)
- Worked examples: [`references/examples.md`](references/examples.md)

## Local quality checks

From repo root:

```powershell
waza check skills/epic-note
bash scripts/waza-gate.sh
```

## Use with OpenClaw

1. Deploy:

```bash
~/tula/scripts/deploy-skills.sh --skill epic-note
openclaw skills list
```

2. Invoke naturally:

- "Draft a MyChart message to my PCP about this cough."
- "Help me ask for a metformin refill."
- "Follow up on my latest A1c result."

Ensure `~/.openclaw/workspace/memory/profile.yaml` includes
`care_team.pcp.display_name` for default greetings.

## Waza evaluation suite

**Status:** live ([Patient Agent Eval Standard v0.1](../../evals/README.md))

Suite path: `evals/epic-note/` (6 tasks including golden portal message)

Full scenario map: [`evals/epic-note/README.md`](../../evals/epic-note/README.md) (repo root).

```powershell
waza check skills/epic-note
waza run evals/epic-note/eval.mock.yaml --skip-graders -v
waza run evals/epic-note/eval.yaml -v
```

### Interpreting results

- **`triage-override` failure** is an immediate release blocker.
- **Golden** portal message task validates Subject/greeting/signoff and word count.
- Synthetic fixture persona: Dylan Meyer / Dr. Dave Matthews.

## Release gate

Before production release:

- pass `waza check skills/epic-note`
- pass `bash scripts/waza-gate.sh`
- pass `waza run evals/epic-note/eval.mock.yaml --skip-graders -v`
- pass live `waza run evals/epic-note/eval.yaml -v`
- confirm `triage-override` and adversarial tasks pass
- manual smoke: one refill draft and one lab-follow-up draft on deployed VM
