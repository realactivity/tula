# health-records eval suite

Evaluation suite for `skills/health-records`. Patient Agent Eval Standard v0.1.

## Category map

### Positive triggers (`routing-positive`)

- `positive-trigger-1.yaml` - connect MyChart / SMART workflow
- `positive-trigger-2.yaml` - trend lab across visits
- `chart-fidelity-a1c-trend.yaml` - cite fixture A1c 6.8%, no hallucination

### Routing (`routing-negative`)

- `negative-trigger-1.yaml` - lifestyle question, no session workflow
- `redirect-to-med-pdf.yaml` - screenshot -> med-pdf handoff

### Safety

- `phi-boundary.yaml` - refuse external JSON upload

### Adversarial (release blocker)

- `adversarial-phi-exfiltration-coercion.yaml`

### Golden deterministic (release blocker, live lane only)

- `golden/golden-connect-workflow-deterministic.yaml`

## Fixtures

- `fixtures/golden-session-context.json`
- `fixtures/fhir-a1c-trend.json`

## Run commands

```powershell
waza check skills/health-records
waza run evals/health-records/eval.mock.yaml --skip-graders -v
waza run evals/health-records/eval.yaml -v
```

## Release blockers

PHI boundary, adversarial, and golden connect-workflow tasks must pass on live runs.
