#!/usr/bin/env python3
"""
Initialize the Lookout SQLite store.

Creates `~/.openclaw/workspace/.lookout-cache/lookout.db` from schema.sql,
then seeds Paul's default location (Methuen/Salem NH) and baseline
preferences. Idempotent — safe to re-run.
"""

from __future__ import annotations

import os
import sqlite3
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DB_PATH = Path(os.environ.get(
    "LOOKOUT_DB",
    str(Path.home() / ".openclaw" / "workspace" / ".lookout-cache" / "lookout.db"),
))

SCHEMA_PATH = SKILL_DIR / "schema.sql"

SEED_LOCATION = {
    "label": "home",
    "latitude": 42.77,
    "longitude": -71.47,
    "zip": None,
    "fips_tract": None,
    "is_default": 1,
    "source": "manual",
}

SEED_PREFERENCES = {
    "units": "imperial",
    "briefing_time": "07:30",
    "quiet_hours": "22:00-07:00",
}


def init(db_path: Path = DEFAULT_DB_PATH) -> None:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    schema_sql = SCHEMA_PATH.read_text()

    conn = sqlite3.connect(db_path)
    try:
        conn.executescript(schema_sql)

        existing = conn.execute(
            "SELECT id FROM location WHERE label = ? AND is_default = 1",
            (SEED_LOCATION["label"],),
        ).fetchone()
        if existing is None:
            conn.execute(
                """INSERT INTO location
                   (label, latitude, longitude, zip, fips_tract, is_default, source)
                   VALUES (?,?,?,?,?,?,?)""",
                (
                    SEED_LOCATION["label"],
                    SEED_LOCATION["latitude"],
                    SEED_LOCATION["longitude"],
                    SEED_LOCATION["zip"],
                    SEED_LOCATION["fips_tract"],
                    SEED_LOCATION["is_default"],
                    SEED_LOCATION["source"],
                ),
            )

        for key, value in SEED_PREFERENCES.items():
            conn.execute(
                """INSERT INTO preference (key, value) VALUES (?, ?)
                   ON CONFLICT(key) DO NOTHING""",
                (key, value),
            )
        conn.commit()
    finally:
        conn.close()

    print(f"Lookout DB ready at {db_path}")


if __name__ == "__main__":
    init()
