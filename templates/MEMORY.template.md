# MEMORY.md - Long-Term Memory

<!--
This is a fresh tenant template. The agent reads this at every main-session start.
The onboarding skill (run once on first contact) will populate the placeholders
below from conversation; everything else accretes over time.

Sections marked OPTIONAL stay as section headers until the agent has something
real to write there. Empty section = "we don't know this yet" — that's a feature,
not a gap to fabricate.

Maintainer note: never invent values to "fill in" this file. If something is
unknown, leave the placeholder or omit the line. Honesty about gaps is the whole
point of a longitudinal record.
-->

## About Me

- Name: {{AGENT_NAME}} {{AGENT_EMOJI}}
- Role: {{AGENT_ROLE}}
- First came online for this user: {{TENANT_BOOTED_AT}}

## About {{USER_SHORT_NAME}}

- **Full name:** {{USER_FULL_NAME}}
- **DOB:** {{USER_DOB}}
- **Pronouns:** {{USER_PRONOUNS}}
- **Location:** {{USER_LOCATION_LABEL}} (~{{USER_LAT}}°N, {{USER_LNG}}°W)
- **Timezone:** {{USER_TZ}}
- **Units:** {{USER_UNITS}}
- **First contact:** {{TENANT_BOOTED_AT}}

<!-- OPTIONAL — populated by health-records skill when records are connected -->
## Care Team

<!-- Populate when health-records pulls identify the user's PCP / specialists -->

## Health Picture

<!--
This section is the curated clinical narrative. The agent writes here when:
  - A new lab/imaging result lands and the trend changes
  - A medication is added/changed/stopped
  - A condition is diagnosed or resolved
  - A care-team change happens

Do not write here without a source. Every clinical statement should be
traceable back to either a FHIR resource (from the health-records pull),
a parsed PDF (from med-pdf), or a direct statement from the user.
-->

### Current active medications

<!-- Populate from FHIR MedicationRequest + user-confirmed changes -->

### Active problems

<!-- Populate from FHIR Condition where clinicalStatus = active -->

### Latest labs

<!-- Most recent values with date, unit, reference range -->

### Encouraging signals

<!-- Wins worth tracking. Lean-mass preserved, AFib screening clean, etc. -->

### Activity baseline

<!-- Steps, sleep, HR — populated from wearable data if connected -->

### Open clinical questions

<!-- Things to ask the user, the PCP, or watch for in upcoming visits -->

## Files Received

<!-- Index of PDFs/exports the user has shared. One line per file. -->

## Known Infra Issues

<!-- Operator-side. Bugs, workarounds, parked issues. -->

## Workspace Skills

<!-- Per-tenant skill notes. What's installed, when, how it's configured. -->

## Preferences

<!-- The user's stated preferences for how the agent should behave. -->
