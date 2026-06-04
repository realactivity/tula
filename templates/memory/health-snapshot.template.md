# Health snapshot — {{USER_FULL_NAME}}

_Detailed clinical picture. MEMORY.md keeps a short summary; this file holds the longitudinal substance._
<!-- _Last meaningful refresh: <YYYY-MM-DD> (<source, e.g. FHIR pull from {{HEALTH_SYSTEM}}>)._ -->

<!--
L2 / load-on-demand. This is the curated clinical narrative for {{USER_SHORT_NAME}}.

RULES:
- Do not write here without a source. Every clinical statement should trace
  back to a FHIR resource (health-records pull), a parsed PDF (med-pdf), or a
  direct statement from {{USER_SHORT_NAME}}.
- This is a SUMMARY, not the chart. The source-of-truth export (see bottom)
  always wins. Re-read the export before making clinical statements.
- Empty section = "we don't know this yet." Leave the placeholder; never
  fabricate values to fill a row.
- No diagnosis. This file describes; it does not decide.
-->

## Frame
<!-- One or two sentences: how should the agent hold this person's health
     picture as a whole? (e.g. a clustered syndrome to treat together vs.
     isolated findings; actively-treated vs. untreated.) Set once the picture
     is clear enough to have a shape. -->

## Current active medications
<!-- Populate from FHIR MedicationRequest + user-confirmed changes. -->

| Med | Dose / route | Started | For |
|---|---|---|---|
| <!-- med --> | <!-- dose --> | <!-- date --> | <!-- indication --> |

## Still flagged
<!-- Open or partially-controlled problems. Number them; one short paragraph
     each. Populate from FHIR Condition (clinicalStatus = active) + findings
     that need follow-up. Leave empty until there is something real to flag. -->

## Latest labs
<!-- Most recent values with date. Note the draw date in the heading. -->

| Marker | Value |
|---|---|
| <!-- marker --> | <!-- value --> |

## Encouraging signals
<!-- Wins worth tracking — preserved lean mass, clean screenings, in-range
     markers, demonstrated capability. Balances the "flagged" section. -->

## Activity baseline
<!-- Steps, sleep, HR, etc. — populated from wearable data if a device is
     connected. Note the data source and date range. -->

## Clinical hypothesis
<!-- OPTIONAL. If the findings suggest a connecting thread worth watching,
     state it as a hypothesis (not a diagnosis), with the reasoning. -->

## Still unanswered
<!-- Questions to ask {{USER_SHORT_NAME}}, the care team, or watch for at the
     next visit. Honest gaps go here. -->

## Care team
- **PCP:** {{PCP_NAME}}
- **Health system:** {{HEALTH_SYSTEM}}
- **FHIR base:** {{FHIR_BASE_URL}}
- **MRN:** {{MRN}}
<!-- Add specialists as they appear in the record. -->

## Source-of-truth records
<!--
Point to the actual exports — never let this summary be the only source.
  - Full FHIR R4 export (<date>): <path to health-records-cache file>
  - Resource counts: <Observation N, Condition N, ...> (useful for backup
    integrity checks — see memory/infra/backups.md)
  - Wearable export (<date>): <path>, stored locally only.
-->

**Always read from the source export before making clinical statements — don't rely on this summary file alone.**
