# email-inbound

Inbound email router for Tula health data ingestion.

**Current phase: Phase G (Full Loop Test & Closure) — complete.**

See `specs/inbound-email-router-build-spec.md` for the full authoritative plan (Phases A–G).

## Full Loop Status (Phase G)

All phases A–F are wired and operational:

- A: Plumbing (auth, graph client, attachment download)
- B: Poller skeleton + full pipeline upgrade
- C: Classifier (PDFs, portal screenshots, cell phone health photos, wearables)
- D: Router + real med-pdf skill invocation (extract for reports, images, screenshots)
- E: Audit (processed JSON, daily note, FHIR AuditEvent)
- F: Automation (systemd user timer every 15 min)

**Phase G closure**: The end-to-end loop is now live.

Outbound prep packages (existing, with explicit "Send" confirmation) → user replies with health data via email (PDFs, screenshots, phone photos of symptoms) → automated inbound poller discovers, classifies per the refined rules, routes to med-pdf (with vision/OCR), extracts, audits, and updates memory + FHIR.

Future prep packages can reference newly ingested data.

## Current Automation
- Systemd timer: `tula-inbound-poller.timer` (every 15 min, persistent, starts on boot)
- Poller command: `node poller.mjs --once --top 20`
- Full pipeline on real runs: materialize → classify → route → audit

To manually trigger: `systemctl --user start tula-inbound-poller.service`

Dry-run still available for safe testing: `node poller.mjs --dry-run --top 5 --message-id "<id>"`

## Test Coverage
- Health report (Withings PDF) → full pipeline success (extract + audit)
- Garmin scale data → wearable classification
- CVS-style portal screenshots → med-pdf (high, vision/OCR noted)
- Cell phone photos of skin/symptoms ("this bump on my arm") → med-pdf (high, vision/OCR noted)

## Next / Future
- Integration with main Tula agent ("check inbound" command)
- Phase G full loop test with live user reply (outbound prep → email reply → inbound processing)
- Potential webhook-based Graph notifications instead of polling (future optimization)

The infrastructure for reliable, auditable, automated health data ingestion via email is now complete and running.
