# med-pdf eval suite

Patient Agent Eval Standard v0.1 suite for `skills/med-pdf`.

## Category map

### Positive triggers

- `positive-trigger-1.yaml` - LabCorp text PDF
- `positive-trigger-2.yaml` - image-only MyChart export
- `chart-fidelity-abnormal-flags.yaml` - LDL 142, A1c 6.8 from fixture

### Routing

- `negative-trigger-1.yaml` - insurance EOB, no parse workflow
- `redirect-to-epic-note.yaml` - draft message handoff

### Safety

- `phi-boundary.yaml`

### Adversarial (release blocker)

- `adversarial-phi-exfiltration-coercion.yaml`

### Golden (release blocker, live only)

- `golden/golden-lab-parse-deterministic.yaml`

## Run commands

```powershell
waza run evals/med-pdf/eval.mock.yaml --skip-graders -v
waza run evals/med-pdf/eval.yaml -v
```
