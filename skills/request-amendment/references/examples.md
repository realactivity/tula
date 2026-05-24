# request-amendment examples

## Example 1: straightforward factual correction

Input:

- Patient concern: "My note says lisinopril 40 mg, but I take 10 mg."
- Source excerpt: "Current meds: lisinopril 40 mg daily."

Expected shape:

- Issue type: medication/allergy issue
- Evidence separation with labeled `patient_says`, `record_shows`, `supporting_evidence`, `proposed_amendment`
- Neutral patient letter draft
- Timeline checklist with 60-day window and one 30-day extension note

## Example 2: denied amendment follow-up

Input:

- Patient concern: "My amendment request was denied. What next?"

Expected shape:

- Short explanation of denial path rights under 45 CFR 164.526
- Statement-of-disagreement draft language
- Mention of future disclosure handling
- No claim that denial is automatically unlawful

## Example 3: FHIR draft mode enabled

Input:

- User asks for draft FHIR Task output
- Runtime flag `request_amendment.fhir_task_draft` is enabled

Expected shape:

- Usual amendment package (issue, evidence, letter, timeline)
- Draft Task JSON in output
- Validation summary from `validate_fhir_task.mjs`
- Explicit note: draft only, no POST performed
