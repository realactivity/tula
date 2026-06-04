# MEMORY.md - Long-term, always-loaded

<!--
L1 / ALWAYS-LOADED layer. This file is sent to the agent on EVERY main-session
turn, so it must stay SMALL - target <80 lines. Detail does NOT live here; it
lives in `memory/` topical files (L2). This file holds only the durable facts
needed every single turn, plus pointers to where everything else lives.

The onboarding skill (run once on first contact) fills the {{PLACEHOLDERS}}
below from the welcome conversation. Everything else accretes over time.

Maintainer note: never invent values to "fill in" this file. If something is
unknown, leave the placeholder or omit the line. An empty section means
"we don't know this yet" - that honesty is the whole point of a longitudinal
record. If this file creeps past ~80 lines, you are hoarding detail that
belongs in an L2 file - see `memory/_index.md` and demote it.
-->

_This file is sent to me every turn. Keep it small. Detail lives in `memory/` files - see `memory/_index.md` for the catalog._

## About me
- **Name:** {{AGENT_NAME}} {{AGENT_EMOJI}}
- **Role:** {{AGENT_ROLE}}
- **First came online:** {{TENANT_BOOTED_AT}}

## About {{USER_SHORT_NAME}}
- **Full name:** {{USER_FULL_NAME}}
- **DOB:** {{USER_DOB}}
- **Pronouns:** {{USER_PRONOUNS}}
- **Location:** {{USER_LOCATION_LABEL}} (~{{USER_LAT}}, {{USER_LNG}})
- **Timezone:** {{USER_TZ}}
- **Units:** {{USER_UNITS}}
<!-- Keep this to durable, every-turn-relevant identity facts only. Care-team
     details, device IDs, MRN, FHIR base URL -> memory/health-snapshot.md. -->

## Clinically active right now
<!--
Three lines max - the distilled signal, not the chart. Populate from health
work once records are connected; until then leave this comment in place.
  - **Meds:** <active meds, one line>
  - **Watching:** <open / partially-controlled problems, one line>
  - **Encouraging:** <wins worth tracking, one line>
Full picture lives in memory/health-snapshot.md. Read that first for any
health-deep question, then the FHIR source-of-truth export it points to.
-->

## Operating rules
- **Stewardship frame:** {{USER_DATA_FRAME}}. Read `memory/stewardship.md` before talking security or compliance.
- **Stay in frame:** <!-- one line naming what this agent is FOR, so tangents return to the mission -->
- **Daily notes are not optional.** When something incident- or learning-grade happens, write it to `memory/YYYY-MM-DD.md` the same day. MEMORY.md only gets the distilled signal.

## Backups
<!-- Populate once a backup pipeline is running: repo + cadence + "don't
     re-propose setup, it's running". See memory/infra/backups.md. -->

## Where to look for details
| Looking for | Read |
|---|---|
| Full clinical picture | `memory/health-snapshot.md` |
| Stewardship / data-handling frame | `memory/stewardship.md` |
| Workspace skills | `memory/skills.md` |
| Backup architecture & runbook | `memory/infra/backups.md` |
| Coding-agent wiring | `memory/infra/coding-agents.md` |
| Web / social search config | `memory/infra/search-tools.md` |
| Voice (TTS) config | `memory/infra/voice-tts.md` |
| Known bugs to fix later | `memory/infra/parked-bugs.md` |
| Recurring infra problems & fixes | `memory/infra/known-issues.md` |
| What happened on a specific day | `memory/YYYY-MM-DD.md` |
| Catalog of everything above | `memory/_index.md` |

When in doubt, use `memory_search` - it indexes the whole tree.
