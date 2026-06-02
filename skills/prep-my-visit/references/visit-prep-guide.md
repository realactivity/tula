# Visit-prep guide

Operational rules for cadence, lab analysis, and the IPS section contract.

## Cadence

Default cadence is visit date minus 14 days:

- `T-14`: start prep thread, capture goals, run lab opportunities
- `T-10`: draft lab-request snippet for patient review if Category B exists
- `T-7`: confirm pending labs and check new trends
- `T-3`: draft IPS summary and request patient edits
- `T-1`: regenerate final summary with freshest data
- `T+1`: post-visit ingest and closed-loop scoring

Allow template-level overrides:

- same-day urgent: compress directly to `T-1` style generation
- imaging-heavy surveillance: optional extended window

## Invocation surfaces

- My Aria UI prep button
- Telegram natural language, slash command, and voice
- forwarded calendar invite or visit confirmation email
- automatic trigger from ingested `Appointment`
- caregiver proxy flow (caregiver receives notifications, patient remains subject)

## Artifact contract

Persist outputs in:

- `~/.openclaw/workspace/tula/briefs/{visit_id}/provider.pdf`
- `~/.openclaw/workspace/tula/briefs/{visit_id}/patient.pdf`
- `~/.openclaw/workspace/tula/briefs/{visit_id}/ips-bundle.json`
- `~/.openclaw/workspace/tula/briefs/{visit_id}/lab-opportunities.json`
- `~/.openclaw/workspace/tula/briefs/{visit_id}/snippets/*.txt`

## Hard guardrails

- Never diagnose, prognose, or recommend treatment.
- Never auto-order labs.
- Never auto-send snippets.
- Never include billing or insurance content.
- Never claim certainty when source data is missing.

## Lab analyzer

### Category A: standing orders pending

Detect active or draft `ServiceRequest` resources that have no linked completed result.

Return:

- ordering provider
- order date
- test name
- nearest available lab context when present
- plain-language action: complete the standing order

This category is highest confidence because the order already exists.

### Category B: discuss-with-doctor candidates

Propose no more than three lab candidates with clear pre-visit value.

Each candidate must include:

- one-sentence clinical rationale
- named guideline source
- source year or version
- discuss-with-doctor wording
- optional portal snippet draft

Required wording posture:

- allowed: "ask your doctor whether..."
- not allowed: "get this test now", "you should order..."

### Category C: direct-to-consumer option

Only consider when:

- patient explicitly opted in
- Category A and B are unavailable or insufficient
- test is broadly available without provider order

Never surface:

- DTC genetics recommendations
- specialty hormone panels outside accepted guidance
- tests requiring provider-only interpretation pathways

### Ranking rule

When more than three Category B candidates are defensible:

1. prioritize relevance to active visit reason
2. prioritize recency and unresolved status
3. keep top three, place remaining candidates in a suppressed list

### Lab validation checklist

Before final output:

- every Category B has citation metadata
- Category B count <= 3
- no imperative auto-order language
- Category C appears only when opt-in is true

## IPS section contract

### Required sections

Always include:

1. Problem List
2. Allergies and Intolerances
3. Medication Summary

### Recommended sections

Include by default unless suppressed by template:

- Immunizations
- Diagnostic Results
- History of Procedures
- Medical Devices

### Optional sections

Include when relevant:

- Vital Signs
- Plan of Care
- Social History
- Alerts
- Functional Status
- History of Past Problems

### Tula extensions

- Patient Story (promoted to always-on in Tula rendering)
- Pre-Visit Lab Opportunities (addendum)
- Delta Since Last Visit With This Provider (addendum)

### Rendering targets

- Provider view: concise, high-signal pre-visit context
- Patient view: plain-language goals, questions, and what-to-bring
- IPS Bundle: `Bundle.type=document` with `Composition` first entry and referenced resources following

### Evidence rule

Every non-trivial claim should be attributable to source data or explicitly marked as patient-stated. If uncertain, mark uncertainty and request missing input.
