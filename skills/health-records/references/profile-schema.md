# Profile Schema

Personalization for `health-records` lives outside the skill. The skill
reads identity fields from the workspace profile for addressing; it never
embeds a real user's name, portal, or provider list in source.

## Where the profile lives

Resolution order, first hit wins:

1. `skills.entries.health-records.profile` in `openclaw.json`
2. `HEALTH_RECORDS_PROFILE` env var (absolute path)
3. `~/.openclaw/workspace/memory/profile.yaml` (default; shared with
   `myhealth-pulse` and other Tula skills)

If no profile resolves, use neutral second-person ("you") in responses.
Do not fabricate a name.

## Schema (keys this skill reads)

```yaml
version: 1

identity:
  display_name: "Your Full Name"   # optional; used in status messages
  short_name: "Your"               # optional; used in brief prompts
  pronouns: "they/them"            # optional
```

## What does NOT belong in the profile

- Portal credentials, OAuth tokens, or session keys
- FHIR resource content, diagnoses, meds, lab values
- Real provider names, MRNs, or health-system identifiers
- Family member identity

Those live in workspace memory (`MEMORY.md`, `.health-records-cache/`)
after a successful pull, never in the profile file under version control.

## Eval fixtures

Eval suites use the synthetic persona **Dylan Meyer** (he/him, age 51)
and **Dr. Dave Matthews** as PCP. See `evals/health-records/tasks/`.
