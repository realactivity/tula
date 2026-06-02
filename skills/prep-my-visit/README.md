# prep-my-visit

`prep-my-visit` prepares a patient for an upcoming visit with a concise, IPS-aligned package:

- provider-facing summary
- patient companion summary
- pre-visit lab opportunities
- portal-ready snippets (patient-reviewed before send)

The goal is simple: start the visit with context and current data, not chart archaeology.

## Why this skill exists

Most pre-visit friction is predictable:

- context is fragmented across portals and timelines
- key labs are often ordered but not completed before the encounter
- patients arrive without a clear goals list

This skill turns those failure modes into a structured prep flow with explicit safety boundaries.

## What it produces

Artifacts are persisted under:

`~/.openclaw/workspace/tula/briefs/{visit_id}/`

Expected outputs:

- `provider.pdf`
- `patient.pdf`
- `ips-bundle.json`
- `lab-opportunities.json`
- `snippets/*.txt`

## Safety model

`prep-my-visit` is constrained by design:

- no diagnosis, prognosis, or treatment recommendations
- no auto-ordering tests
- no auto-send to patient portals
- no insurance, billing, prior-auth, or EOB workflows
- no PHI transfer outside `~/.openclaw/workspace/`

## Skill structure

- Runtime instructions: [`SKILL.md`](SKILL.md)
- Operational workflow: [`references/workflow.md`](references/workflow.md)
- Lab analyzer rules: [`references/lab-analyzer.md`](references/lab-analyzer.md)
- IPS section contract: [`references/ips-contract.md`](references/ips-contract.md)
- Script usage: [`references/scripts.md`](references/scripts.md)
- Prompt examples: [`references/examples.md`](references/examples.md)

## Local quality checks

From repo root:

```powershell
waza check skills/prep-my-visit
```

Deterministic script checks (run inside skill context):

```powershell
node {baseDir}/scripts/validate_ips_sections.mjs <composition.json>
node {baseDir}/scripts/validate_lab_opportunities.mjs <lab-opportunities.json>
node {baseDir}/scripts/enforce_snippet_limits.mjs <snippets.json>
```

## Use with Claude

Use this skill in Claude-backed runtime via OpenClaw deployment.

1. Deploy skills to your OpenClaw VM:

```bash
ssh <your-openclaw-vm>
cd ~/tula
~/tula/scripts/deploy-skills.sh --skill prep-my-visit
```

2. Verify the skill is loaded:

```bash
openclaw skills list
```

3. Invoke naturally from your runtime surface (My Aria, Telegram, or equivalent):

- "Prep me for cardiology next Tuesday."
- "What labs should I discuss before my PCP annual?"
- "Build my visit prep summary and a portal snippet draft."

If your OpenClaw runtime is configured to use Claude models, these invocations run with Claude reasoning while preserving this skill's guardrails.

## Use with Copilot

Copilot is the current live-model path for Waza eval execution in this repo.

1. Install and authenticate Copilot CLI:

```powershell
npm install -g @github/copilot
copilot
# inside TUI: /login
# then: /exit
```

2. Run full live eval suite:

```powershell
waza run evals/prep-my-visit/eval.yaml -v
```

3. Run structural/no-quota fallback suite:

```powershell
waza run evals/prep-my-visit/eval.mock.yaml -v
```

For eval details and the scenario map, see `evals/prep-my-visit/README.md` in the repo root.

## Demo flow (no quota)

When live Copilot quota is unavailable:

1. `waza check skills/prep-my-visit`
2. `waza run evals/prep-my-visit/eval.mock.yaml -v`
3. Demo deterministic script checks with fixture-shaped JSON

Frame this as structural and policy validation, not final live-model certification.

## Release gate

Before production release:

- pass `waza check`
- pass live `waza run evals/prep-my-visit/eval.yaml -v`
- confirm safety-critical tasks pass (PHI boundary, no diagnosis/treatment, no auto-send, no billing drift)
- run OpenClaw runtime smoke prompts on deployed VM
