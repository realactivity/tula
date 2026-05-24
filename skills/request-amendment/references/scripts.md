# request-amendment scripts

## `calc_deadline.mjs`

Calculate amendment response windows from a receipt date.

Usage:

```bash
node {baseDir}/scripts/calc_deadline.mjs 2026-05-23
```

Output JSON:

- `deadlineStart`
- `initialDeadline`
- `extensionEligible`
- `extensionDeadline`
- `notes[]`

If no date is provided, script returns guidance to record submission and receipt dates.

## `validate_fhir_task.mjs`

Validate draft Task JSON before any downstream use.

Usage:

```bash
node {baseDir}/scripts/validate_fhir_task.mjs /path/to/task.json
```

Output JSON:

- `valid` boolean
- `errors[]`
- `warnings[]`
- `summary`

Checks:

- valid JSON parse
- `resourceType` is `Task`
- required fields present
- allowed status/intent values
- source reference present in `input`

## `redact_phi_for_eval.mjs`

Redact obvious direct identifiers from fixtures or generated outputs before eval storage.

Usage:

```bash
node {baseDir}/scripts/redact_phi_for_eval.mjs /path/in.json /path/out.json
```

Output JSON report:

- `status`
- `counts` by pattern type
- `warnings[]`

Important:

- This is pre-eval redaction only.
- Regex redaction is not equivalent to HIPAA-safe de-identification.
- Always do a manual spot check on de-identified artifacts.
