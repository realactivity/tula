# request-amendment eval suite

Evaluation suite for `skills/request-amendment`, designed to prove:

- safe patient-facing drafting behavior
- HIPAA timeline and denial-path fidelity
- FHIR draft-only posture and JSON conformance
- resistance to PHI exfiltration and coercive prompt pressure

## Suite layout

- `eval.yaml` - benchmark config and global graders
- `tasks/*.yaml` - behavioral scenarios
- `fixtures/*.json` - synthetic deterministic test inputs

## Category map

### Core workflow quality

- `positive-factual-correction.yaml`
- `clinically-disputed-note.yaml`
- `missing-context-addendum.yaml`

Checks for intake quality, evidence separation, neutral drafting, and correction/addendum structure.

### Regulatory and legal-safety fidelity

- `denied-path-statement-of-disagreement.yaml`
- `should-not-promise-provider-must-amend.yaml`

Checks that the skill avoids legal overclaims, supports statement-of-disagreement workflow, and keeps language compliant.

### FHIR draft posture and conformance

- `fhir-disabled-no-json-post.yaml`
- `fhir-draft-enabled-json-only.yaml`
- `fhir-draft-json-shape-from-fixture.yaml`

Checks draft-only gating, no implied submission, and concrete Task JSON shape (`resourceType`, `status`, `intent`, `for`, `requester`, `owner`, `focus`, `input`, `authoredOn`).

### Safety and abuse resistance

- `phi-boundary-no-external-tools.yaml`
- `sensitive-domain-escalation.yaml`
- `adversarial-phi-exfiltration-coercion.yaml`

Checks PHI boundary enforcement, neutral tone under pressure, and refusal of coercive/unsafe instructions.

### Showcase deterministic package quality

- `golden-full-package-deterministic.yaml`

Fixture-backed golden test that requires a full amendment package with explicit section headers and preserved source facts.

## Why this suite is reviewer-friendly

- Covers both **normal usage** and **adversarial pressure**
- Uses **synthetic fixtures** for reproducibility
- Includes one **deterministic golden case** for consistent demos
- Validates both **language behavior** and **FHIR JSON structure**

## Run commands

From repo root:

```powershell
waza check skills/request-amendment
waza run evals/request-amendment/eval.yaml -v
```

## Interpreting results

- `Success Rate` indicates scenario coverage reliability.
- `Aggregate Score` indicates overall graded quality.
- Per-task failures identify exact behavior gaps:
  - safety regression
  - overclaim/legal language drift
  - FHIR draft posture drift
  - JSON conformance drift

Treat regressions in safety, PHI boundary, or overclaim tasks as release blockers.

## Notes

- This suite intentionally favors behavior-semantic graders over brittle exact-phrase checks.
- Fixture files are synthetic and contain no real patient identifiers.
