# Redaction Plan (Non-Destructive, Profile-Based)

## Goal
Add a reusable redaction system that lets users define persistent redaction profiles and choose when to apply them during sharing/export, without modifying source records in IndexedDB.

## Principles
- Non-destructive: never mutate cached source data.
- User-controlled: profile definition is global; application is contextual per action.
- Transparent: UI must clearly indicate when redaction is active and what it affects.
- Safe defaults: when redaction is enabled, prevent binary attachment bypass.

## Scope (MVP)
1. Global redaction profile persistence (browser local storage).
2. Redaction Studio page to manage terms and rule toggles.
3. Apply profile selector on Records page:
   - `No redaction`
   - one named profile (applies to Send + Download JSON + Download Skill)
4. Runtime redaction applied to cloned payloads only.
5. Attachments safety behavior:
   - redact `attachments[].bestEffortPlaintext`
   - redact each rendition text under `attachments[].originals[].contentPlaintext`
   - strip binary payloads under `attachments[].originals[].contentBase64` when redaction is enabled.

## Out of Scope (MVP)
- Multi-profile sharing/import/export.
- Server-side redaction.
- PDF OCR or binary in-place rewriting.
- Advanced reviewer workflow (approve/deny every match occurrence).

## UX
- New page: `/records/redaction` (Privacy Redaction Studio).
- Records page includes compact redaction card with:
  - apply profile selector (`No redaction` + named profiles)
  - summary of active terms
  - link to Studio
- Redaction is optional via `No redaction`.

## Data Model
- `RedactionProfile`
  - `id`, `name`
  - `terms[]` (value, enabled, source)
  - built-in pattern toggles (ssn/phone/email/identifier-like)
  - attachment handling option (`stripAttachmentBase64`)
  - timestamps
- `RedactionSettings`
  - `activeProfileId` (Studio editing context)
  - `appliedProfileId` (`null` means no redaction)

## Engine
- Compile manual/suggested terms into tolerant regexes that can match through punctuation/spacing.
- Apply built-in regex rules (SSN/phone/email/identifier-like).
- Recursively redact string values in payload copies.
- Replace matches with `[REDACTED]`.
- Strip `attachments[].originals[].contentBase64` when configured.

## Integration Points
- Send flow: `src/client/store/records.ts` (`sendToAI` payload construction).
- JSON export: `src/client/store/records.ts` (`downloadJson`).
- Skill zip export: `src/client/lib/skill-builder.ts`.

## Validation
- Unit-ish functional checks via local manual tests:
  1. Add term, toggle apply for send, confirm encrypted upload uses redacted payload.
  2. Toggle apply for downloads, confirm files contain redactions.
  3. Confirm source cached records remain unchanged after each operation.
  4. Confirm attachment `originals[].contentBase64` stripped when redaction applies.

## Risks
- Over-redaction due permissive matching.
- False negatives for unusual identifiers.
- Performance cost on very large payloads.

## Mitigations
- Keep matcher conservative enough (boundary-aware where possible).
- Show active term count and allow easy disabling of terms/rules.
- Apply redaction only for chosen actions; leave default off.

## Follow-Ups
- Match preview panel with sampled snippets.
- Per-term token labels (`[REDACTED:PHONE]`).
- Profile import/export.
- Optional “dry-run report” before send.
