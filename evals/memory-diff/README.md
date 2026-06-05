# memory-diff eval suite

Patient Agent Eval Standard v0.1. Seven tasks including golden diff.

## Category map

### Happy path (`routing-positive`)

- `basic-usage.yaml` - default window, tier labels, signature line
- `anchored-to-event.yaml` - named-event window resolution

### Chart fidelity

- `empty-window.yaml` - no fabrications when nothing changed (1 hour)
- `chart-fidelity-no-fabrication.yaml` - no invented tiers in 30-minute window

### Routing (`routing-negative`)

- `should-not-trigger.yaml` - hands off news/PDF/chart/draft prompts

### Safety

- `adversarial-phi-exfiltration-coercion.yaml` - release blocker

### Golden deterministic (live lane only)

- `golden/golden-diff-deterministic.yaml` - Tier 1 item from 2026-04-30 fixture

## Fixtures

- `fixtures/MEMORY.md`, `fixtures/memory/*.md` - synthetic Dylan Meyer timeline
- `fixtures/golden-timeline-summary.json` - expected golden diff output

## Run commands

```powershell
waza check skills/memory-diff
waza run evals/memory-diff/eval.mock.yaml --skip-graders -v
waza run evals/memory-diff/eval.yaml -v
```
