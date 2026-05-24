---
name: request-amendment
description: "Draft HIPAA-aligned health-record amendment requests, separate patient claims from source-record evidence, track response timelines, and optionally prepare draft FHIR Task JSON. USE FOR: requests to correct, clarify, append, or dispute clinical note content, medications/allergies, diagnoses, encounter metadata, or other chart entries. DO NOT USE FOR: legal advice, diagnosis, threatening language, or any workflow that sends PHI outside the workspace."
metadata:
  {
    "openclaw":
      {
        "requires": { "bins": ["node"] }
      }
  }
---

# request-amendment

## When to Use

✅ Use when:

- The patient says a record contains inaccurate or incomplete information
- The patient wants neutral language to request a correction or addendum
- The patient needs help tracking amendment response timelines
- The patient asks how to proceed after a denial
- FHIR Task draft output is requested and explicitly enabled

## When NOT to Use

❌ Don't use when:

- The user asks for legal advice, diagnosis, or treatment decisions
- The task is general health education with no record-integrity request
- The user asks for threats, accusations, or coercive language
- The workflow would send PHI to web tools or unapproved external services
- The user asks for automatic FHIR submission without explicit enablement and approval

## Workflow

1. **Intake.** Capture target encounter/date, target excerpt or field, patient concern, and requested correction outcome.
   - If source excerpt is missing, ask for it before drafting.

2. **Separate evidence.** Keep separate `patient_says`, `record_shows`, `supporting_evidence`, and `proposed_amendment`.
   - Never collapse them into one asserted fact.

3. **Classify the issue.** Use one category: factual error, outdated info, omitted context, attribution error, medication/allergy issue, encounter metadata issue, diagnosis/problem-list issue, or unclear-needs-review.

4. **Run safety/risk screen.** Use careful neutral language for sensitive domains (minors, behavioral health, SUD, abuse/neglect, controlled substances, identity mismatch, emergency-care implications).

5. **Draft amendment package.** Produce:
   - issue type
   - cited source excerpt
   - patient-stated correction request (labeled)
   - proposed provider-facing amendment language
   - confidence and rationale
   - patient letter draft
   - HIPAA timeline checklist (60 days + one 30-day extension rule)

6. **Apply HIPAA timeline rules.**
   - Use [`references/hipaa-164-526.md`](references/hipaa-164-526.md) for 60-day and one-time 30-day extension behavior.
   - Do not promise provider acceptance; only timeline response obligations.

7. **Handle FHIR path using feature flags.**
   - If `request_amendment.fhir_task_draft` is disabled: do not output Task JSON.
   - If enabled: generate draft Task JSON and validate locally.
   - Follow defaults and guardrails in [`references/fhir-task-amendment.md`](references/fhir-task-amendment.md).
   - Never post resources unless `request_amendment.fhir_task_post` is enabled and the user explicitly asks to post.

8. **Close with unresolved questions.** List missing dates, unknown routing office, missing source excerpts, and assumptions.

## Scripts

Use:

- `node {baseDir}/scripts/calc_deadline.mjs <receiptDate?>`
- `node {baseDir}/scripts/validate_fhir_task.mjs <task.json>`
- `node {baseDir}/scripts/redact_phi_for_eval.mjs <input.json> <output.json>`

See [`references/scripts.md`](references/scripts.md) for script arguments, outputs, and failure handling.

## Examples

See [`references/examples.md`](references/examples.md) for:

- straightforward factual correction
- denied amendment follow-up language
- FHIR-draft-enabled output (no POST)

## Privacy

This workflow handles PHI.

- Keep PHI inside `~/.openclaw/workspace/`.
- Never send PHI to web search, external APIs, CI logs, or telemetry.
- Evals must use synthetic or reviewed de-identified fixtures only.
- If output might leave workspace, redact before export.

## Troubleshooting

- Missing receipt date: return "deadline starts on provider receipt" and ask the user to record receipt date.
- Draft sounds accusatory: regenerate with neutral factual wording and remove intent attribution.
- FHIR validation fails: keep letter/timeline output and include validation errors in unresolved questions.
- User asks whether provider "must amend": clarify provider must respond on timeline, but may deny if record is accurate and complete.
