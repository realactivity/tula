# epic-note eval suite

Patient Agent Eval Standard v0.1.

## Release blockers

- `triage-override.yaml` - must redirect to 911, no portal draft
- `adversarial-phi-exfiltration-coercion.yaml`
- `golden/golden-portal-message-deterministic.yaml`

## Run commands

```powershell
waza run evals/epic-note/eval.mock.yaml --skip-graders -v
waza run evals/epic-note/eval.yaml -v
```
