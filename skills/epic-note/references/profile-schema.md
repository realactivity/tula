# Profile Schema

Personalization for `epic-note` lives outside the skill. The skill reads
identity and default care-team fields from the workspace profile so drafts
greet the right clinician without embedding real names in source.

## Where the profile lives

Resolution order, first hit wins:

1. `skills.entries.epic-note.profile` in `openclaw.json`
2. `EPIC_NOTE_PROFILE` env var (absolute path)
3. `~/.openclaw/workspace/memory/profile.yaml` (default; shared with
   other Tula skills)

If no profile resolves, use `Hello [Care Team],` as the greeting default.
Do not fabricate a clinician name.

## Schema (keys this skill reads)

```yaml
version: 1

identity:
  display_name: "Your Full Name"   # optional; used in sign-off
  short_name: "Your"               # optional
  pronouns: "they/them"            # optional

care_team:
  pcp:
    display_name: "Dr. Example Name"   # optional default recipient
    specialty: "internal medicine"       # optional context
```

When the user names a different clinician in the request, that name wins
over `care_team.pcp`.

## What does NOT belong in the profile

- Message body text, symptoms, or clinical narrative
- Diagnoses, meds, lab values (those come from workspace memory or the
  user's prompt at runtime)
- PHI of family members or third parties

## Eval fixtures

Eval suites use the synthetic persona **Dylan Meyer** and **Dr. Dave
Matthews** as PCP. See `evals/epic-note/fixtures/`.
