# Examples

Reference fixtures live alongside this file in the `examples/` subdirectory.
Each scenario ships as two JSON files: the IPS Composition Bundle and the
lab-opportunities payload. They drive the PDF renderer smoke tests and serve
as seed data for the eval suite.

| Scenario | Bundle | Labs |
|---|---|---|
| Cardiology follow-up | [`examples/cardiology-followup.json`](examples/cardiology-followup.json) | [`examples/cardiology-followup.labs.json`](examples/cardiology-followup.labs.json) |
| PCP annual | [`examples/pcp-annual.json`](examples/pcp-annual.json) | [`examples/pcp-annual.labs.json`](examples/pcp-annual.labs.json) |
| Urgent same-day | [`examples/urgent-same-day.json`](examples/urgent-same-day.json) | [`examples/urgent-same-day.labs.json`](examples/urgent-same-day.labs.json) |

All patients in these fixtures are synthetic (Robert Johnson, Maria Chen,
Alex Smith); clinicians and tenant IDs are likewise fictional.

## Example 1: Cardiology follow-up with standing order

User prompt:

`Prep me for my cardiology follow-up next Tuesday.`

Expected behavior:

- identify follow-up template
- capture goals
- detect pending standing lipid panel or metabolic labs when present
- generate provider/patient summary structure
- draft optional goals heads-up snippet for patient review

## Example 2: Specialist first visit

User prompt:

`I have my first endocrinology appointment next week. Help me prepare.`

Expected behavior:

- use first-visit template depth
- include fuller problem/med/allergy/diagnostic context
- highlight top unresolved questions and goals
- avoid speculative diagnosis statements

## Example 3: Urgent same-day visit

User prompt:

`I have urgent care in three hours. Prep me fast.`

Expected behavior:

- skip long cadence, run compressed flow
- produce a concise immediate brief
- include high-signal recent vitals/observations
- no invented history when sparse data

## Example 4: Category B lab suggestion

User prompt:

`Should I ask for any labs before my PCP annual?`

Expected behavior:

- frame as discuss-with-doctor only
- include named, dated citation
- generate portal-ready snippet under size limits
