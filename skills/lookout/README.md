# Lookout

Personalized ambient health awareness for Tula.

Lookout reads where the user is right now and surfaces what about their
surroundings matters to their health, given their actual conditions,
medications, and recent labs. A weather app tells everyone the same AQI.
Lookout tells the user the part that matters for them, and stays quiet about
the rest.

Trigger: **"lookout for me"** (or natural variants).

## Why this skill exists

Environmental data is a commodity. The value is **fusion**: triage public
air, weather, UV, and place-based signals against the user's local FHIR
record without sending PHI to environmental providers.

Common failure modes this skill addresses:

- generic AQI alerts that ignore asthma or COPD on file
- medication-sun-sensitivity warnings missed on high-UV days
- treating Lookout as a diagnosis or treatment recommendation engine

## What it produces

**On-demand or scheduled briefings** in chat, for example:

- "Ozone is high and you have asthma on file - want an indoor option?"
- "UV index is extreme and your medication increases sun sensitivity."
- "Heat index is climbing and you take a diuretic - hydration reminder."

**Persistent artifacts:**

- SQLite working store: `~/.openclaw/workspace/.lookout-cache/lookout.db`
- optional FHIR R4 `Observation` resources for environmental exposure history
- SDoH overlay context (Z codes as clinical context only, never billing)

Deterministic fetch output is written by `scripts/fetch_environment.py`; the
agent performs personalized triage on top.

## Safety model

Lookout is constrained by design:

- **never diagnoses**, never recommends treatment, never adjusts medications
- surfaces data and a question or option, not clinical orders
- no billing, payor, prior-auth, EOB, or CPT/HCPCS content
- only location (lat/lng or ZIP) sent to public providers - never conditions/meds/labs
- urgent conditions surfaced prominently with care-team / appropriate-action pointer

Lookout is **not a medical device**. For hospital-scale escalation policy,
see Aria's commercial platform docs.

## Skill structure

- Runtime instructions: [`SKILL.md`](SKILL.md)
- SQLite schema: [`schema.sql`](schema.sql)
- Init store: [`scripts/init_db.py`](scripts/init_db.py)
- Deterministic fetch: [`scripts/fetch_environment.py`](scripts/fetch_environment.py)

## The data Lookout pulls

Endpoints reflect provider behavior as of early 2026. Verify at build time.

**Air and atmosphere (v1)**

- Air quality / AQI: AirNow (US, free key via `AIRNOW_API_KEY`)
- UV index: EPA UV Index via data.gov (free)
- Weather + alerts: NWS `api.weather.gov` (free, requires `LOOKOUT_NWS_UA`)
- Pressure + trend: Open-Meteo (free, no key)

**Stubbed until keyed**

- Google Places (open-now resources: gym, pharmacy, urgent care)
- AirNow granular layers when key present

**Later roadmap**

- pollen, wildfire smoke, CDC respiratory surveillance, radon, travel mode

**Place-as-health (SDoH overlay, later v1+)**

- CDC PLACES, SVI, Area Deprivation Index, USDA Food Access, EPA EJScreen

Free, government-first sourcing aligns with Tula's open-core posture.

## Setup

1. Initialize the store: `python3 scripts/init_db.py`
2. Configure a default location (label + lat/lng) via onboarding or user profile
3. Install Python dependency: `python3 -m pip install httpx`
4. Optional keys: `AIRNOW_API_KEY`, `GOOGLE_PLACES_API_KEY`, `LOOKOUT_NWS_UA`
5. Run fetch on a schedule, then let the agent triage and brief

## Local quality checks

From repo root:

```powershell
waza check skills/lookout
bash scripts/waza-gate.sh
```

Python smoke:

```powershell
python3 skills/lookout/scripts/init_db.py
python3 skills/lookout/scripts/fetch_environment.py
```

## Use with OpenClaw

1. Deploy:

```bash
~/tula/scripts/deploy-skills.sh --skill lookout
openclaw skills list
```

2. Invoke:

- "Lookout for me"
- "How's the air today?"
- "What's 02139 like for me?" (travel / ZIP mode)
- "Where can I work out right now?"

Requires `python3` and `httpx`. Reads local FHIR from workspace caches
populated by `health-records`.

## Waza evaluation suite

**Status: live** (Patient Agent Eval Standard v0.1)

Suite path: `evals/lookout/` (9 tasks including golden fusion briefing)

```powershell
waza check skills/lookout
waza run evals/lookout/eval.mock.yaml --skip-graders -v
waza run evals/lookout/eval.yaml -v
```

See `evals/lookout/README.md` for the full category map.

## Release gate

Before production release:

- pass `waza check skills/lookout`
- pass `bash scripts/waza-gate.sh`
- pass `waza run evals/lookout/eval.mock.yaml --skip-graders -v`
- `init_db.py` + `fetch_environment.py` smoke on VM with default location
- pass live `waza run evals/lookout/eval.yaml -v` on release candidates

Part of [Tula](https://github.com/realactivity/tula) | [RealActivity](https://realactivity.ai)
