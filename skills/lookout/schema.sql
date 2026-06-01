-- Lookout skill: SQLite working store
-- Tula health-skill conventions: store units and reference ranges with every value;
-- keep a raw source identifier on every reading for traceability (no hallucinated values).
-- All data is local to the patient's VM.

PRAGMA foreign_keys = ON;

-- Configured location(s). Location is sensitive; stored locally only.
CREATE TABLE IF NOT EXISTS location (
    id              INTEGER PRIMARY KEY,
    label           TEXT NOT NULL,                  -- e.g. 'home', 'office'
    latitude        REAL,
    longitude       REAL,
    zip             TEXT,
    fips_tract      TEXT,                           -- census tract for SDoH joins
    is_default      INTEGER NOT NULL DEFAULT 0,     -- 1 = used for the daily briefing
    source          TEXT NOT NULL DEFAULT 'manual', -- 'manual' | 'device'
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Patient preferences for the skill.
CREATE TABLE IF NOT EXISTS preference (
    id              INTEGER PRIMARY KEY,
    key             TEXT NOT NULL UNIQUE,           -- 'units' | 'briefing_time' | 'quiet_hours' | 'prioritize_signals' | 'suppress_signals'
    value           TEXT NOT NULL,
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One row per fetched ambient value.
CREATE TABLE IF NOT EXISTS environment_reading (
    id              INTEGER PRIMARY KEY,
    location_id     INTEGER NOT NULL REFERENCES location(id),
    captured_at     TEXT NOT NULL DEFAULT (datetime('now')),
    source          TEXT NOT NULL,                  -- 'airnow' | 'nws' | 'open-meteo' | 'epa-uv' | ...
    metric          TEXT NOT NULL,                  -- 'aqi' | 'pm25' | 'ozone' | 'uv_index' | 'temp' | 'heat_index' | 'humidity' | 'pressure' | 'pressure_trend' | ...
    value           REAL,
    value_text      TEXT,                           -- for non-numeric values (e.g. 'falling')
    unit            TEXT,                           -- UCUM where applicable
    reference_low   REAL,
    reference_high  REAL,
    category_band   TEXT,                           -- 'good' | 'moderate' | 'unhealthy_sensitive' | 'unhealthy' | ...
    raw_source_id   TEXT,                           -- provider response id / record key for traceability
    notes           TEXT
);
CREATE INDEX IF NOT EXISTS idx_reading_loc_time ON environment_reading(location_id, captured_at);
CREATE INDEX IF NOT EXISTS idx_reading_metric ON environment_reading(metric);

-- Active public alerts (weather, air-quality action days, etc.).
CREATE TABLE IF NOT EXISTS alert (
    id              INTEGER PRIMARY KEY,
    location_id     INTEGER NOT NULL REFERENCES location(id),
    captured_at     TEXT NOT NULL DEFAULT (datetime('now')),
    source          TEXT NOT NULL,                  -- 'nws' | ...
    alert_type      TEXT,                           -- e.g. 'heat_advisory', 'air_quality'
    severity        TEXT,
    headline        TEXT,
    effective_at    TEXT,
    expires_at      TEXT,
    raw_source_id   TEXT
);
CREATE INDEX IF NOT EXISTS idx_alert_loc ON alert(location_id, expires_at);

-- Nearby resources (the resources layer; from Places).
CREATE TABLE IF NOT EXISTS place (
    id              INTEGER PRIMARY KEY,
    location_id     INTEGER NOT NULL REFERENCES location(id),
    captured_at     TEXT NOT NULL DEFAULT (datetime('now')),
    place_type      TEXT NOT NULL,                  -- 'gym' | 'grocery' | 'pharmacy' | 'urgent_care' | 'park' | 'farmers_market'
    name            TEXT NOT NULL,
    address         TEXT,
    latitude        REAL,
    longitude       REAL,
    open_now        INTEGER,                        -- 1 | 0 | NULL unknown
    hours_json      TEXT,
    rating          REAL,
    distance_m      INTEGER,
    source          TEXT NOT NULL DEFAULT 'google_places',
    place_ref       TEXT                            -- provider place id
);
CREATE INDEX IF NOT EXISTS idx_place_loc_type ON place(location_id, place_type);

-- Neighborhood SDoH overlay. Feeds Tula's SDoH pipeline. Z codes permitted as context.
CREATE TABLE IF NOT EXISTS sdoh_context (
    id              INTEGER PRIMARY KEY,
    location_id     INTEGER NOT NULL REFERENCES location(id),
    captured_at     TEXT NOT NULL DEFAULT (datetime('now')),
    indicator       TEXT NOT NULL,                  -- 'svi_overall' | 'food_access_low' | 'adi_national' | 'walkability' | 'places_*'
    value           REAL,
    value_text      TEXT,
    unit            TEXT,
    geography_level TEXT,                           -- 'tract' | 'zip' | 'county'
    geography_id    TEXT,
    z_code          TEXT,                           -- ICD-10 Z code where one applies (context only)
    source          TEXT NOT NULL                   -- 'cdc_places' | 'cdc_svi' | 'usda_fara' | ...
);
CREATE INDEX IF NOT EXISTS idx_sdoh_loc ON sdoh_context(location_id, indicator);

-- Generated daily briefings, with traceability back to the readings used.
CREATE TABLE IF NOT EXISTS briefing (
    id                  INTEGER PRIMARY KEY,
    location_id         INTEGER NOT NULL REFERENCES location(id),
    generated_at        TEXT NOT NULL DEFAULT (datetime('now')),
    summary_text        TEXT,
    items_json          TEXT,                       -- the personalized items surfaced
    model_used          TEXT,
    source_reading_ids  TEXT                        -- comma-separated environment_reading.id values used
);
CREATE INDEX IF NOT EXISTS idx_briefing_loc ON briefing(location_id, generated_at);
