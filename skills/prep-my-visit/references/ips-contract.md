# IPS contract

## Required sections

Always include:

1. Problem List
2. Allergies and Intolerances
3. Medication Summary

## Recommended sections

Include by default unless suppressed by template:

- Immunizations
- Diagnostic Results
- History of Procedures
- Medical Devices

## Optional sections

Include when relevant:

- Vital Signs
- Plan of Care
- Social History
- Alerts
- Functional Status
- History of Past Problems

## Tula extensions

- Patient Story (promoted to always-on in Tula rendering)
- Pre-Visit Lab Opportunities (addendum)
- Delta Since Last Visit With This Provider (addendum)

## Rendering targets

- Provider view: concise, high-signal pre-visit context
- Patient view: plain-language goals, questions, and what-to-bring
- IPS Bundle: `Bundle.type=document` with `Composition` first entry and referenced resources following

## Evidence rule

Every non-trivial claim should be attributable to source data or explicitly marked as patient-stated. If uncertain, mark uncertainty and request missing input.
