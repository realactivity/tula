# Workflow details

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
