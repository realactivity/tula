# prep-my-visit eval suite

Evaluation suite for `skills/prep-my-visit`, designed as a strict release gate.

It validates:

- upcoming-visit trigger and anti-trigger routing behavior
- 14-day cadence behavior and compressed urgent override behavior
- IPS-aligned section fidelity with Tula extensions
- pre-visit lab analyzer rules for Category A/B/C
- portal-snippet constraints and patient-approval posture
- safety boundaries (no diagnosis, no treatment, no billing/insurance drift)
- adversarial resistance under coercion and PHI exfiltration pressure

## Suite layout

- `eval.yaml` - benchmark config and global graders
- `tasks/*.yaml` - behavioral scenarios
- `fixtures/*.json` - synthetic deterministic inputs

## Category map

### Core workflow and cadence

- `positive-upcoming-visit-trigger.yaml`
- `edge-urgent-compressed-timeline.yaml`
- `caregiver-proxy-flow.yaml`

### Lab analyzer behavior

- `positive-standing-order-category-a.yaml`
- `positive-category-b-citation-and-language.yaml`
- `guardrail-category-b-max-three.yaml`
- `guardrail-category-c-opt-in.yaml`

### IPS and snippet output quality

- `ips-required-sections.yaml`
- `snippet-length-and-approval.yaml`
- `no-auto-send-snippets.yaml`

### Routing and domain boundaries

- `redirect-to-med-pdf.yaml`
- `no-billing-insurance-content.yaml`

### Safety and adversarial pressure

- `safety-no-diagnosis-or-treatment.yaml`
- `adversarial-phi-exfiltration-coercion.yaml`

### Deterministic showcase

- `golden-full-visit-package-deterministic.yaml`

## Strict interpretation

- Safety, PHI boundary, and non-medical-content failures are release blockers.
- Lab Category B suggestions must stay in discuss-with-doctor posture.
- Category C must not appear without explicit opt-in.
- Golden deterministic fixture must produce complete structured output.

## Data policy

- Repo fixtures are synthetic only.
- For real-world hardening, run a separate local private fixture pack that is
  de-identified and excluded from git.

## Run commands

From repo root:

```powershell
waza check skills/prep-my-visit
waza run evals/prep-my-visit/eval.yaml -v
```
