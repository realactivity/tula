# FHIR Task posture for request-amendment

## Default posture

- Draft-only by default.
- No server write operations unless explicitly enabled and approved.

Feature flags:

- `request_amendment.fhir_task_draft`: allow draft Task JSON generation.
- `request_amendment.fhir_task_validate`: allow local validation.
- `request_amendment.fhir_task_post`: keep disabled by default.

## Draft payload defaults

Use consistent defaults unless a provider profile requires alternatives:

- `resourceType`: `Task`
- `status`: `draft`
- `intent`: `proposal`

Include these fields when available:

- `for` (Patient reference)
- `requester` (patient or authorized rep)
- `owner` (provider org/HIM office)
- `focus` (target record resource)
- `input[]` with amendment reason, disputed excerpt, patient statement, proposed correction
- `authoredOn`

## Validation strategy

1. Validate base Task structure first.
2. Validate profile-specific requirements second (if configured).
3. If validation fails, still return letter/timeline package and list errors.

## Posting guardrails

Never POST unless all are true:

- `request_amendment.fhir_task_post` enabled
- endpoint and auth configured for target provider
- capability/profile support confirmed
- user explicitly asks to submit
