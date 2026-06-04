# Tula tenant templates

This directory is the **golden-image memory layer** every new Tula tenant
inherits. When a fresh agent comes online for a new user, the onboarding skill
copies these templates into the agent's workspace, fills in the `{{PLACEHOLDER}}`
tokens from the welcome conversation, and lets the rest accrete over time.

Everything here is **plain markdown** (and one YAML). No proprietary formats, no
embedded binary, no opaque index. A human in five years should be able to
navigate a deployed tenant's memory with nothing but `cat`. That portability is
a hard design constraint, not a preference.

## The tier model

Memory is organized in tiers so the always-loaded layer (sent to the model on
every turn) stays small, and detail loads on demand.

| Tier | What | Files | Discipline |
|---|---|---|---|
| **L1** | Always loaded, every turn | `MEMORY.md`, `SOUL.md`, `IDENTITY.md`, `USER.md`, `AGENTS.md`, `TOOLS.md`, `HEARTBEAT.md` | Durable + SMALL. `MEMORY.md` targets **<80 lines**: every-turn facts plus pointers, never detail. |
| **L2** | Load on demand | `memory/*.md`, `memory/infra/*.md`, `memory/profile.yaml` | Where the substance lives. Curated, topical. Pulled in via `memory_search` / `memory_get`. |
| **L3** | Raw daily journal | `memory/YYYY-MM-DD.md` | Same-day, full detail, narrative. Written when something incident- or learning-grade happens. |
| **L4** | Archive | `memory/archive/` | Historically true, no longer actionable. Never deleted, just moved. |

**The flow that keeps it healthy:** raw detail lands in L3 the same day ->
durable signal is promoted into the relevant L2 file -> only the distilled,
every-turn essence reaches L1. If `MEMORY.md` is bloating, the daily-note step
is being skipped. The whole design fails if it's easy to dump detail into L1.

**The index is the front door.** A fresh agent reads `MEMORY.md`, which points
to `memory/_index.md`, which catalogs everything else. Keep that chain intact in
every deployment.

## File tree

```
templates/
  README.md                      <- you are here
  AGENTS.template.md             <- workspace operating manual (teaches the tier discipline)
  MEMORY.template.md             <- L1, slim, always-loaded
  USER.template.md               <- L1, who the human is
  profile.template.yaml          <- L2, stable structured facts (consumed by myhealth-pulse)
  memory/
    _index.md.template           <- the catalog / discovery layer
    health-snapshot.template.md  <- L2: detailed clinical picture
    stewardship.template.md      <- L2: data-stewardship frame (NOT optional)
    skills.template.md           <- L2: catalog of skills authored for this tenant
    YYYY-MM-DD.template.md       <- L3: example daily-note shape
    infra/
      backups.template.md
      coding-agents.template.md
      search-tools.template.md
      voice-tts.template.md
      parked-bugs.template.md
      known-issues.template.md
```

> **Naming note.** Templates use the `.template.md` / `.template.yaml` suffix so
> the onboarding step can strip it to produce the live filename
> (`health-snapshot.template.md` -> `health-snapshot.md`). The index is named
> `_index.md.template` per the original brief; the onboarding step should map it
> to `memory/_index.md`. (If standardizing later, `_index.template.md` would
> match the rest — flagged for a future cleanup.)

## Placeholder vocabulary

Tokens use `{{UPPER_SNAKE}}`. The onboarding skill fills them; anything still
unknown stays as the token (an unfilled placeholder honestly says "we don't
know this yet" — see the honesty principle below).

**Agent identity**
- `{{AGENT_NAME}}`, `{{AGENT_EMOJI}}`, `{{AGENT_ROLE}}`

**User identity**
- `{{USER_FULL_NAME}}`, `{{USER_SHORT_NAME}}`, `{{USER_DOB}}`, `{{USER_PRONOUNS}}`
- `{{USER_LOCATION_LABEL}}`, `{{USER_LAT}}`, `{{USER_LNG}}`, `{{USER_TZ}}`, `{{USER_UNITS}}`

**Tenant / deployment**
- `{{TENANT_BOOTED_AT}}` — ISO datetime the agent first came online for this user
- `{{TENANT_ID}}`
- `{{TENANT_BACKUP_REPO}}` — `owner/repo` of the private backup repo
- `{{TENANT_BACKUP_BRANCH}}`

**Health / care**
- `{{PCP_NAME}}`, `{{HEALTH_SYSTEM}}`, `{{FHIR_BASE_URL}}`, `{{MRN}}`

**Stewardship**
- `{{USER_DATA_FRAME}}` — how the user relates to their own data. One of
  `self-stewardship`, `caregiver-managed`, `covered-entity-operated`, or a
  tenant-specific phrasing. Drives how the agent talks about security and
  compliance. **Declaring this is mandatory** — see `memory/stewardship.template.md`.

Free-form fill-ins that aren't stable identity (example dates, provider
filenames, version numbers) are written as `<angle-bracket hints>` inside HTML
comments rather than minted as new tokens, to keep the vocabulary small.

## How onboarding should consume these

1. Copy the tree into the agent's workspace, stripping the `.template` suffix
   (and mapping `_index.md.template` -> `memory/_index.md`).
2. Replace `{{PLACEHOLDER}}` tokens from the welcome conversation. **Leave any
   token you can't fill** — do not invent a value.
3. **Force a stewardship declaration.** `{{USER_DATA_FRAME}}` must be set, and
   `stewardship.md`'s implications/examples rewritten to match the chosen frame.
   This is the one field the deployment process must not skip.
4. Keep `MEMORY.md` and `memory/_index.md` consistent: every L2 file should have
   a row in the index and a pointer reachable from `MEMORY.md`.
5. Delete the `<!-- ... -->` guidance comments only once a section holds real
   content; until then they document what belongs there.

## Design principles (do not violate)

1. **Lifetime memory + portability.** Plain markdown only. Navigable with `cat`
   in five years. No binary, no proprietary index.
2. **Honesty about gaps.** An empty section or an unfilled placeholder means "we
   don't know this yet." Never fabricate content to fill a template.
3. **Tier discipline is the whole point.** L1 stays small; detail lives in L2;
   L3 is raw and chronological; L4 is stale-but-true. If a template makes it easy
   to bloat L1, the design has failed.
4. **The index is the front door.** `MEMORY.md` -> `memory/_index.md` -> the rest.
   Preserve that chain after templating.
5. **The stewardship frame is mandatory.** Every tenant has *some* frame for how
   they relate to their data. The template forces the deployment to declare it and
   the agent to respect it.
