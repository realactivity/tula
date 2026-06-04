# Lookout

Personalized ambient health awareness for Tula.

Your health radar. Lookout reads where you are right now and tells you what about your surroundings matters to your health, given your actual conditions, medications, and recent labs. A weather app tells everyone the same AQI. Lookout tells you the part that matters for you, and stays quiet about the rest.

Trigger: "lookout for me".

## What it does

- A daily morning briefing on Telegram: a short, personalized health forecast for where you are.
- On-demand answers: "how's the air today?", "where can I work out right now?", "anything I should know?", "what's [ZIP] like for me?"
- Quietly builds an environmental exposure history in your longitudinal record, and captures the neighborhood layer your EHR never sees.

## Why it is more than a weather app

The environmental data is a commodity. The value is the fusion. Lookout reads your local FHIR record (conditions, medications, recent labs) and triages the ambient data against it, surfacing only the relevant signal with an option or a question. Examples:

- You have asthma and ozone is high: it says so, and offers an indoor option or a rescue-inhaler refill check.
- One of your medications increases sun sensitivity and UV is high: it flags it.
- You take a diuretic and the heat index is climbing: it raises hydration and points to cooling options.
- You have a migraine history and pressure is dropping sharply tonight: it gives you a heads-up.

It never diagnoses, never recommends treatment, and never adjusts a medication. It surfaces data and a question.

## The data Lookout pulls

Endpoints, field names, and key requirements below reflect provider behavior as of early 2026. Verify against current provider documentation at build time.

Air and atmosphere
- Air quality / AQI: AirNow (US, free, free API key). Optional hyperlocal and global: PurpleAir, OpenAQ. Optional granular: Google Air Quality (keyed, paid).
- UV index: EPA UV Index, data.gov (US, free).
- Pollen (later): Google Pollen or Ambee (keyed, species-level).
- Wildfire smoke (later): NOAA HMS smoke product.

Weather stress and alerts
- Weather and active alerts: National Weather Service, api.weather.gov (US, free, no key, requires User-Agent).
- Barometric pressure and trend, global fallback: Open-Meteo (free, no key).

Public-health surveillance (later)
- Respiratory virus activity (flu, COVID, RSV), including wastewater: CDC (free).

Resources around you
- Gyms, grocery, pharmacy, urgent care, parks: Google Maps Platform Places (keyed, paid). Farmers markets: USDA Local Food Directories (free). Walkability: Walk Score.

Place-as-health: the SDoH overlay
- CDC PLACES (local chronic-disease and risk estimates), CDC/ATSDR Social Vulnerability Index, Area Deprivation Index, USDA Food Access Atlas, EPA EJScreen and Walkability Index, EPA radon zones. All free and public.
- Captured as SDoH context and fed into Tula's SDoH pipeline. Coded with ICD-10 Z codes where one applies, as clinical context only.

Free, government-first sourcing keeps Lookout aligned with Tula's open core (Apache 2.0) and avoids per-call cost and vendor lock-in. The paid pieces (Places, optional Google pollen and AQI) are opt-in.

## Privacy

Lookout sends only a location (latitude/longitude or ZIP) to the public data providers. Your conditions, medications, and labs never leave your VM to reach those providers. The personalized triage runs through Tula's already-configured model path: a HIPAA-eligible hosted tier, or a local open-weight model for fully air-gapped operation. No environmental provider ever sees PHI.

## Setup

1. Initialize the local SQLite store: `python3 scripts/init_db.py`.
2. Configure at least one location (label plus latitude/longitude or ZIP) through onboarding or the user profile. The default location drives the daily briefing. Location is user data and is not stored in the repo.
3. Ensure the Python dependency is installed: `python3 -m pip install httpx` or the package-manager equivalent.
4. Set units (imperial by default for US), the briefing time, and quiet hours.
5. Provide API access:
   - AirNow free API key (set `AIRNOW_API_KEY`).
   - A descriptive User-Agent for NWS (set `LOOKOUT_NWS_UA`).
   - A Google Maps Platform key for the resources layer (optional).
   - A free CDC Socrata app token for higher SDoH rate limits (optional).
6. Run the fetch (`scripts/fetch_environment.py`) on a schedule, then let the agent triage and brief.

## Storage

- Working store: SQLite (`schema.sql`). Every value carries its source, timestamp, unit, reference range or category band, and a raw source id, so everything Lookout surfaces is traceable.
- Longitudinal record: durable readings are written as FHIR R4 `Observation` resources (environmental exposure, and SDoH as social-history with a Z code where applicable). Patient-generated health data per the ONC definition.

## Roadmap

v1: AirNow AQI, NWS weather and alerts, EPA UV, Open-Meteo pressure, Places resources, CDC PLACES and SVI overlay, daily briefing, on-demand queries, FHIR Observation logging.

Later: pollen species, respiratory-virus surveillance, wildfire smoke, water advisories, radon, polished travel and relocation mode, correlation insight (for example flare days against PM2.5), wearable cross-reference.

## Safety and scope

Lookout is not a medical device. It surfaces data and questions. It is health-data only: it never produces billing, payor, prior-auth, EOB, or medical-coding content. SDoH Z codes are the only codes used, and only as clinical context. For potentially urgent conditions, Lookout surfaces the item prominently and points to the care team or appropriate action, the open-core counterpart to Aria's configurable escalation policy.

Part of Tula. https://github.com/realactivity/tula | https://realactivity.ai
