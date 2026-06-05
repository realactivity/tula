# composition eval suite

Cross-skill routing tests for Patient Agent Eval Standard v0.1 dimension #5
(coordination). Binds to `skills/patient-agent-routing/`.

## Tasks

- `cbc-screenshot-to-med-pdf.yaml`
- `connect-and-draft-single-turn.yaml`
- `visit-prep-with-pdf-only.yaml`
- `amendment-vs-portal-message.yaml`
- `records-after-pdf-parse.yaml`
- `adversarial-cross-skill-exfil.yaml`

```powershell
waza run evals/composition/eval.mock.yaml --skip-graders -v
waza run evals/composition/eval.yaml -v
```
