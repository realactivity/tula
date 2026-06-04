#!/usr/bin/env python3
"""
Initialize the Lookout SQLite store.

Creates `~/.openclaw/workspace/.lookout-cache/lookout.db` from schema.sql,
then seeds baseline tenant-neutral preferences. Location is configured by
onboarding or the user profile. Idempotent — safe to re-run.
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
