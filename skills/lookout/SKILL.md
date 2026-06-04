---
name: lookout
description: "Personalized ambient health awareness. Pulls environmental, public-health, and place-based data for the user's location and triages it against their longitudinal record, surfacing only what matters. USE FOR: 'lookout for me' briefings, ambient/air/UV/weather/pressure checks, place-based resource queries, travel-mode 'what's [ZIP] like for me'. DO NOT USE FOR: diagnosing, recommending or changing treatment, billing/payor/coding content, or sending PHI to any environmental provider."
metadata:
  {
    "openclaw":
      {
        "emoji": "🛰️",
        "requires": { "bins": ["python3"] }
      }
  }
---

# Lookout

Ambient health radar. Lookout reads where the user is right now, fuses environmental + place + neighborhood SDoH data with their FHIR record, and surfaces only the items that matter for *them*. A weather app says "AQI 142." Lookout says "ozone is high, you have asthma on file, want an indoor option?"

## When to Use

✅ Use when:

- The user says "lookout for me" or any natural variant ("how's the air today?", "where can I work out right now?", "anything I should know today?", "what's [ZIP] like for me?")
- The configured daily briefing time fires
- The user asks about open-now resources (gym, pharmacy, urgent care, grocery, park) tied to their health
- The user asks about a neighborhood's SDoH overlay for travel or relocation

## When NOT to Use

❌ Don't use when:

- The user wants a clinical interpretation of a PDF → use `med-pdf`
- The user wants to connect/refresh their patient portal → use `health-records`
- The user wants a drafted clinician message → use `epic-note`
- A request would diagnose, recommend treatment, or adjust a medication
- A request would produce billing, payor, prior-auth, EOB, or coding content (CPT/HCPCS/HCC). SDoH Z codes are the only codes used, and only as clinical context.

## Setup

1. **Init the store.** `python3 {baseDir}/scripts/init_db.py`
   - Creates `~/.openclaw/workspace/.lookout-cache/lookout.db` from `schema.sql`.
   - Seeds only tenant-neutral preferences (imperial, 07:30 briefing, 22:00–07:00 quiet hours). Re-running is safe.
2. **Configure location.** Onboarding or the user profile must create one `location` row with `is_default = 1` and latitude/longitude before fetch runs. Location is user data; don't hard-code it in the skill.
3. **Install Python dependency.** Ensure `httpx` is available to Python (`python3 -m pip install httpx` or the distro/package-manager equivalent).
4. **Optional keys.** Lookout runs end-to-end with no keys. For richer data:
   - `AIRNOW_API_KEY` — US AQI by lat/lon (free key from AirNow).
   - `GOOGLE_PLACES_API_KEY` — open-now resources layer (paid).
   - `LOOKOUT_NWS_UA` — descriptive User-Agent for api.weather.gov.

## Workflow

1. **Fetch** — `python3 {baseDir}/scripts/fetch_environment.py`
   - Reads the default location row, calls NWS (alerts + current weather), Open-Meteo (pressure + trend, temp, humidity), and EPA UV (data.gov). No keys required.
   - Inserts rows into `environment_reading` and `alert` with `raw_source_id` for traceability. AirNow + Google Places stay stubbed until keyed.
   - Cache dir: `~/.openclaw/workspace/.lookout-cache/`.

2. **Read the patient's record** from the local FHIR store:
   - Active `Condition` (clinical-status active)
   - Active `MedicationStatement`
   - Recent `Observation` (category laboratory) — most recent values

3. **Triage.** Map record signals to ambient signals (asthma/COPD → ozone, PM2.5, smoke; photosensitizing meds → UV; HF or diuretic → heat index; migraine → pressure drop; recent low vitamin D → moderate UV; depression/SAD → daylight; OA → cold/damp/falling pressure). If nothing matches a signal, **stay silent about it**. Silence about clean air is a feature.

4. **Brief.** Lead with what matters for *this* patient. Plain language first, clinical term in parens where it adds clarity. Every health-relevant item ends in an option or a question, never a directive. Tag as informational, not medical advice. Urgent items (severe-asthma + air quality emergency, HF + extreme heat) go first and prominently, with a pointer to the care team.

5. **Persist.**
   - Durable, health-relevant readings → FHIR `Observation` (environmental-exposure category, UCUM unit, `derivedFrom`/`note` back to source).
   - SDoH context → `Observation` social-history with the relevant ICD-10 Z code where one applies. Feeds Tula's SDoH pipeline.
   - Path: `~/.openclaw/workspace/tula/fhir/Observation/environmental/` and the existing social-history location.
   - Briefing summary → `briefing` table with `source_reading_ids` for traceability.

## Scripts

- `scripts/init_db.py` — apply `schema.sql` and seed tenant-neutral preferences. Idempotent. It does not seed a location.
- `scripts/fetch_environment.py` — deterministic fetch. No PHI ever leaves the VM — only lat/lng or ZIP reach the providers. Run on a schedule or before a briefing.

## Privacy

Lookout sends **only a location** (lat/lng or ZIP) to public data providers. Conditions, medications, labs never leave the VM. The personalized triage runs through Tula's configured model path (HIPAA-eligible hosted tier, or local open-weight model for air-gapped operation).

- Cache stays under `~/.openclaw/workspace/.lookout-cache/`. Don't copy out.
- No environmental provider ever sees PHI.
- Location is sensitive — stored locally only.

## Safety

- Not a medical device. Surfaces data and questions; never names a diagnosis, recommends treatment, or adjusts a medication.
- No hallucinated values. Every value surfaced maps to a row with a `raw_source_id`. If a fetch failed or a value is stale, say so — don't guess.
- Show the full informational-only notice once at onboarding; carry a short standing tag on health-relevant outputs.
- Escalation: urgent items first and prominently, with a pointer to the care team. Open-core counterpart to Aria's configurable escalation policy.

## Notes

- v1 scope: NWS, Open-Meteo, EPA UV, AirNow (keyed), Places (keyed), CDC PLACES + SVI overlay, daily briefing, on-demand queries, FHIR Observation logging.
- Later: pollen species, respiratory-virus surveillance, wildfire smoke, water advisories, radon, polished travel/relocation mode, correlation insight, wearable cross-reference.
- Endpoints and field names reflect provider behavior as of early 2026 — verify against current provider docs before depending on a field name.
