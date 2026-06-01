#!/usr/bin/env python3
"""
Lookout: deterministic environment fetch for the Tula Lookout skill.

This script does the non-reasoning work. It calls public data providers for a
given location, normalizes every value into a common shape (value, unit,
reference range, category band, raw source id), and writes the rows to the
skill's SQLite store. The agent then reads those rows and does the
personalized triage against the patient's FHIR record.

Privacy: this script sends only a location (lat/lng or ZIP) to public
providers. It never reads or transmits the patient's conditions,
medications, or labs.

Status: v1 implementation for the no-key providers (NWS, Open-Meteo,
EPA UV). AirNow and Google Places remain stubbed until keys are
configured.

Endpoints and field names reflect provider behavior as of early 2026.
Verify against current provider docs before depending on a field name.
"""

from __future__ import annotations

import os
import sqlite3
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import httpx

DB_PATH = os.environ.get(
    "LOOKOUT_DB",
    str(Path.home() / ".openclaw" / "workspace" / ".lookout-cache" / "lookout.db"),
)

NWS_USER_AGENT = os.environ.get(
    "LOOKOUT_NWS_UA", "Tula-Lookout (contact: pswider@realactivity.com)"
)
AIRNOW_API_KEY = os.environ.get("AIRNOW_API_KEY", "")
GOOGLE_PLACES_API_KEY = os.environ.get("GOOGLE_PLACES_API_KEY", "")


@dataclass
class Reading:
    source: str
    metric: str
    value: Optional[float] = None
    value_text: Optional[str] = None
    unit: Optional[str] = None
    reference_low: Optional[float] = None
    reference_high: Optional[float] = None
    category_band: Optional[str] = None
    raw_source_id: Optional[str] = None
    notes: Optional[str] = None


@dataclass
class Alert:
    source: str
    alert_type: Optional[str]
    severity: Optional[str]
    headline: Optional[str]
    effective_at: Optional[str]
    expires_at: Optional[str]
    raw_source_id: Optional[str]


# --- Fetchers. Each returns normalized objects; none touches the FHIR record. ---


def fetch_open_meteo(lat: float, lon: float) -> list[Reading]:
    """Open-Meteo: free, no key. Barometric pressure, weather fallback."""
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": lat,
        "longitude": lon,
        "current": "surface_pressure,temperature_2m,relative_humidity_2m",
        "hourly": "surface_pressure",
        "temperature_unit": "fahrenheit",
    }
    r = httpx.get(url, params=params, timeout=20)
    r.raise_for_status()
    data = r.json()
    cur = data.get("current", {}) or {}
    readings: list[Reading] = []
    ts = str(cur.get("time"))
    if cur.get("surface_pressure") is not None:
        readings.append(Reading(
            source="open-meteo", metric="pressure",
            value=cur["surface_pressure"], unit="hPa", raw_source_id=ts,
        ))
    if cur.get("temperature_2m") is not None:
        readings.append(Reading(
            source="open-meteo", metric="temp",
            value=cur["temperature_2m"], unit="degF", raw_source_id=ts,
        ))
    if cur.get("relative_humidity_2m") is not None:
        readings.append(Reading(
            source="open-meteo", metric="humidity",
            value=cur["relative_humidity_2m"], unit="%", raw_source_id=ts,
        ))

    # Pressure trend: change over the next 6 hours.
    # Open-Meteo's hourly arrays start at the day boundary, not at "now",
    # so locate the current hour in `hourly.time` and offset from there.
    hourly = data.get("hourly", {}) or {}
    series = hourly.get("surface_pressure") or []
    times = hourly.get("time") or []
    cur_time = cur.get("time")
    if (cur_time and cur.get("surface_pressure") is not None
            and len(series) == len(times) and times):
        # Match by hour prefix (e.g. "2026-06-01T17") since current.time
        # carries minutes while hourly.time is whole-hour bucketed.
        cur_hour = cur_time[:13]
        idx = next(
            (i for i, t in enumerate(times) if str(t).startswith(cur_hour)),
            None,
        )
        if idx is not None and idx + 6 < len(series):
            now_p = float(series[idx])
            future_p = float(series[idx + 6])
            delta = future_p - now_p
            if delta <= -2.0:
                trend = "falling"
            elif delta >= 2.0:
                trend = "rising"
            else:
                trend = "steady"
            readings.append(Reading(
                source="open-meteo", metric="pressure_trend",
                value=delta, value_text=trend, unit="hPa/6h",
                raw_source_id=f"{times[idx]}|{times[idx + 6]}",
            ))
    return readings


def fetch_nws_current(lat: float, lon: float) -> list[Reading]:
    """NWS api.weather.gov: free, no key, requires User-Agent.

    Resolves the gridpoint for the lat/lng, then reads the first hourly
    forecast period. Captures temperature and relative humidity. Heat
    index can be computed downstream from these values.
    """
    headers = {"User-Agent": NWS_USER_AGENT, "Accept": "application/geo+json"}
    points = httpx.get(
        f"https://api.weather.gov/points/{lat},{lon}",
        headers=headers, timeout=20,
    )
    points.raise_for_status()
    hourly_url = points.json().get("properties", {}).get("forecastHourly")
    if not hourly_url:
        return []
    forecast = httpx.get(hourly_url, headers=headers, timeout=20)
    forecast.raise_for_status()
    periods = forecast.json().get("properties", {}).get("periods") or []
    if not periods:
        return []
    p = periods[0]
    ts = p.get("startTime") or ""
    readings: list[Reading] = []
    if p.get("temperature") is not None:
        unit = "degF" if p.get("temperatureUnit", "F").upper() == "F" else "degC"
        readings.append(Reading(
            source="nws", metric="temp",
            value=float(p["temperature"]), unit=unit,
            raw_source_id=f"nws|{ts}|temp",
            notes=p.get("shortForecast"),
        ))
    rh = p.get("relativeHumidity") or {}
    if isinstance(rh, dict) and rh.get("value") is not None:
        readings.append(Reading(
            source="nws", metric="humidity",
            value=float(rh["value"]), unit="%",
            raw_source_id=f"nws|{ts}|humidity",
        ))
    return readings


def fetch_nws_alerts(lat: float, lon: float) -> list[Alert]:
    """NWS active alerts: free, no key, requires User-Agent."""
    headers = {"User-Agent": NWS_USER_AGENT, "Accept": "application/geo+json"}
    r = httpx.get(
        "https://api.weather.gov/alerts/active",
        params={"point": f"{lat},{lon}"},
        headers=headers, timeout=20,
    )
    r.raise_for_status()
    alerts: list[Alert] = []
    for feat in r.json().get("features", []):
        p = feat.get("properties", {}) or {}
        alerts.append(Alert(
            source="nws",
            alert_type=p.get("event"),
            severity=p.get("severity"),
            headline=p.get("headline"),
            effective_at=p.get("effective"),
            expires_at=p.get("expires"),
            raw_source_id=feat.get("id"),
        ))
    return alerts


def fetch_epa_uv(zip_code: str) -> list[Reading]:
    """EPA UV Index (data.gov Envirofacts): free, no key. Hourly UV by ZIP.

    Captures the peak UV value for the day and the time it occurs. Returns
    an empty list if no ZIP is configured (lat/lng alone is not enough for
    the EPA endpoint).
    """
    if not zip_code:
        return []
    url = f"https://data.epa.gov/efservice/getEnvirofactsUVHOURLY/ZIP/{zip_code}/JSON"
    r = httpx.get(url, timeout=20)
    r.raise_for_status()
    rows = r.json() or []
    if not rows:
        return []
    peak = max(rows, key=lambda row: row.get("UV_VALUE") or 0)
    uv_value = peak.get("UV_VALUE")
    if uv_value is None:
        return []
    bands = [
        (0, 2, "low"),
        (3, 5, "moderate"),
        (6, 7, "high"),
        (8, 10, "very_high"),
        (11, 99, "extreme"),
    ]
    band = next((name for lo, hi, name in bands if lo <= uv_value <= hi), None)
    return [Reading(
        source="epa-uv", metric="uv_index",
        value=float(uv_value), unit="UV",
        category_band=band,
        raw_source_id=f"{peak.get('ZIP')}|{peak.get('DATE_TIME')}",
        notes=f"daily peak at {peak.get('DATE_TIME')}",
    )]


# Places (the resources layer) and the SDoH overlay are separate fetchers,
# added per the v1 scope. Stubbed here pending API keys.

def fetch_places(lat: float, lon: float, place_types: list[str]) -> list[dict]:
    """Google Maps Platform Places: keyed, paid. STUBBED until GOOGLE_PLACES_API_KEY set."""
    if not GOOGLE_PLACES_API_KEY:
        return []
    # TODO: implement Places Nearby Search once a key is configured.
    return []


def fetch_airnow_aqi(lat: float, lon: float) -> list[Reading]:
    """AirNow current AQI by lat/lon: free, requires AIRNOW_API_KEY. STUBBED until key set."""
    if not AIRNOW_API_KEY:
        return []
    url = "https://www.airnowapi.org/aq/observation/latLong/current/"
    params = {
        "format": "application/json",
        "latitude": lat, "longitude": lon,
        "distance": 25, "API_KEY": AIRNOW_API_KEY,
    }
    r = httpx.get(url, params=params, timeout=20)
    r.raise_for_status()
    readings: list[Reading] = []
    for obs in r.json():
        param = (obs.get("ParameterName") or "").lower()
        metric = {"o3": "ozone", "pm2.5": "pm25", "pm10": "pm10"}.get(param, param)
        cat = (obs.get("Category") or {}).get("Name")
        readings.append(Reading(
            source="airnow", metric=metric, value=obs.get("AQI"), unit="AQI",
            category_band=cat,
            raw_source_id=f"{obs.get('ReportingArea')}|{obs.get('DateObserved')}|{param}",
        ))
    return readings


def fetch_sdoh(fips_tract: str, zip_code: str) -> list[dict]:
    """CDC PLACES + CDC/ATSDR SVI: free. STUBBED — v1 later phase."""
    return []


# --- Persistence. ---

def write_readings(
    conn: sqlite3.Connection, location_id: int, readings: list[Reading]
) -> int:
    if not readings:
        return 0
    conn.executemany(
        """INSERT INTO environment_reading
           (location_id, source, metric, value, value_text, unit,
            reference_low, reference_high, category_band, raw_source_id, notes)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
        [(location_id, r.source, r.metric, r.value, r.value_text, r.unit,
          r.reference_low, r.reference_high, r.category_band, r.raw_source_id, r.notes)
         for r in readings],
    )
    return len(readings)


def write_alerts(
    conn: sqlite3.Connection, location_id: int, alerts: list[Alert]
) -> int:
    if not alerts:
        return 0
    conn.executemany(
        """INSERT INTO alert
           (location_id, source, alert_type, severity, headline,
            effective_at, expires_at, raw_source_id)
           VALUES (?,?,?,?,?,?,?,?)""",
        [(location_id, a.source, a.alert_type, a.severity, a.headline,
          a.effective_at, a.expires_at, a.raw_source_id) for a in alerts],
    )
    return len(alerts)


def run_for_location(
    conn: sqlite3.Connection,
    location_id: int,
    lat: float,
    lon: float,
    zip_code: str,
    fips_tract: str,
) -> tuple[int, int]:
    readings: list[Reading] = []
    readings += fetch_open_meteo(lat, lon)
    readings += fetch_nws_current(lat, lon)
    readings += fetch_airnow_aqi(lat, lon)
    readings += fetch_epa_uv(zip_code)
    n_readings = write_readings(conn, location_id, readings)

    n_alerts = write_alerts(conn, location_id, fetch_nws_alerts(lat, lon))
    # Places and SDoH are stubbed; nothing to persist until keys/v-later.
    conn.commit()
    return n_readings, n_alerts


def main() -> int:
    db_path = Path(DB_PATH)
    if not db_path.exists():
        print(
            f"Lookout DB not found at {db_path}. Run init_db.py first.",
            file=sys.stderr,
        )
        return 1
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        row = conn.execute(
            "SELECT id, latitude, longitude, zip, fips_tract "
            "FROM location WHERE is_default = 1 LIMIT 1"
        ).fetchone()
        if row is None:
            print("No default location configured in the lookout DB.", file=sys.stderr)
            return 2
        n_readings, n_alerts = run_for_location(
            conn, row["id"], row["latitude"], row["longitude"],
            row["zip"] or "", row["fips_tract"] or "",
        )
    finally:
        conn.close()
    print(f"Lookout fetch complete. readings={n_readings} alerts={n_alerts}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
