# Scripts

## `validate_ips_sections.mjs`

Usage:

`node {baseDir}/scripts/validate_ips_sections.mjs <composition.json>`

Checks:

- required IPS sections present
- Tula extension labels present
- returns JSON `{ ok, errors, warnings }`

## `validate_lab_opportunities.mjs`

Usage:

`node {baseDir}/scripts/validate_lab_opportunities.mjs <lab-opportunities.json>`

Checks:

- Category B count <= 3
- every Category B item has citation metadata
- no imperative order-now language in Category B
- Category C appears only if `dtcOptIn=true`

## `enforce_snippet_limits.mjs`

Usage:

`node {baseDir}/scripts/enforce_snippet_limits.mjs <snippets.json>`

Checks:

- each snippet is <= 500 chars
- each snippet includes patient-approval required posture
- no billing/insurance keywords

Exit code:

- `0` when all checks pass
- `1` when any blocking rule fails
