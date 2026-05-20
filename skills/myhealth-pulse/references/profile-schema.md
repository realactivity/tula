# Profile Schema

The pulse profile is a YAML file external to this skill. The skill reads
it; the skill does not contain it. This separation is what makes the skill
generic, deployable in multi-tenant runtimes, and safe to ship in the open
repo.

## Where the profile lives

Resolution order, first hit wins:

1. `skills.entries.myhealth-pulse.profile` in `openclaw.json` - used by
   multi-tenant runtimes to point at a per-tenant profile.
2. `MYHEALTH_PULSE_PROFILE` env var - absolute path; useful for testing.
3. `~/.openclaw/workspace/memory/profile.yaml` - default for single-user
   Tula.

The same skill code works in personal and enterprise deployments. Only the
resolved path differs.

## Schema (v1)

```yaml
version: 1

identity:
  display_name: "Your Full Name"        # required
  short_name: "Your"                     # required, used in voice ("Your daily pulse")
  pronouns: "they/them"                  # optional

social:                                  # optional, used by social-* adapters
  - platform: x                          # one of: x, mastodon, bluesky, linkedin
    handle: "@yourhandle"
  - platform: mastodon
    handle: "@you@instance.social"

topics:
  primary:                               # high weight in scoring (≥2 hits = +30, 1 hit = +15)
    - "Topic A"
    - "Topic B"
  secondary:                             # low weight (+5)
    - "Topic C"
  negative:                              # down-weight, do not hard-filter (-20)
    - "Term to deprioritize"

feeds:
  enabled:                               # which adapters to call this run
    - social-x
    - web-brave
  windows:
    daily: 24h                           # for ad-hoc and scheduled daily runs
    weekly: 7d                           # for "weekly pulse" requests
  thresholds:
    keep_score: 70                       # minimum score to include in digest
    max_items: 8                         # cap on items per digest

authority_sources:                       # +10 in scoring when result matches
  - example-authority.com
  - another-authority.org

notifications:                           # optional, future use by notification adapters
  digest_channel: chat                   # chat | telegram | email | web-push
  urgent_channel: chat
```

## What does NOT belong in the profile

The profile is for query-side personalization only. The following live
elsewhere and **must never appear in the profile**, because they would
end up in outbound query strings:

- Real medical history, conditions, medications, allergies → `health-records` workspace memory
- Lab values, imaging findings → `med-pdf` workspace memory
- Provider names, clinician identifiers, MRN, insurance IDs
- Family member identity or relationships
- Real-world location more precise than country/region

If a future adapter needs any of the above (e.g., a portal-inbox adapter
that needs provider names), it owns its own secrets store outside the
profile.

## Extending the schema

Adding fields for a new adapter is non-breaking when:

- The new key sits under a clearly-named top-level section (e.g.,
  `wearables:`, `portal:`).
- Existing adapters don't need to read it.
- The schema version is bumped only on incompatible changes.

Document the addition in this file before merging the adapter into
`references/feeds.md`.

## Personal Tula vs. multi-tenant

| Aspect | Personal Tula | Multi-tenant runtime |
|---|---|---|
| Profile path | `~/.openclaw/workspace/memory/profile.yaml` | resolved per-tenant via `openclaw.json` |
| Who edits it | the user, by hand | provisioned from the identity service |
| Cache location | `~/.openclaw/workspace/.myhealth-pulse-cache/` | tenant-scoped workspace mount |
| Skill code | identical | identical |

The skill is unaware of which deployment it's running in. That's the
point.
