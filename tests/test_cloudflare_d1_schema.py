
"""
Pruebas del esquema inicial de Cloudflare D1.

Autor: David Vidal Ramírez.

Comprueba que una base nueva acumule correctamente
sesiones, clics y tiempo activo.
No utiliza la base de datos de producción.
"""

import sqlite3
from pathlib import Path


def test_fresh_d1_schema_aggregates_events() -> None:
    root = Path(__file__).resolve().parents[1]
    schema_path = root / "infra/cloudflare/d1-schema.sql"
    schema = schema_path.read_text(encoding="utf-8-sig")

    db = sqlite3.connect(":memory:")

    try:
        db.execute("PRAGMA foreign_keys = ON")
        db.executescript(schema)

        expected_triggers = {
            "trg_analytics_sessions_insert",
            "trg_analytics_events_insert",
            "trg_analytics_sessions_active_ms",
        }

        installed_triggers = {
            row[0]
            for row in db.execute(
                "SELECT name FROM sqlite_master WHERE type = 'trigger'"
            )
        }

        assert expected_triggers <= installed_triggers

        session_id = "11111111-1111-4111-8111-111111111111"
        event_id = "22222222-2222-4222-8222-222222222222"

        db.execute(
            "INSERT INTO analytics_sessions (session_id) VALUES (?)",
            (session_id,),
        )

        db.execute(
            """
            INSERT INTO analytics_events (
                event_id, session_id, action
            )
            VALUES (?, ?, ?)
            """,
            (event_id, session_id, "navigation_click"),
        )

        db.execute(
            """
            UPDATE analytics_sessions
            SET active_ms = ?
            WHERE session_id = ?
            """,
            (5000, session_id),
        )

        def read_aggregates():
            return db.execute(
                """
                SELECT
                    total_visits,
                    total_clicks,
                    navigation_clicks,
                    active_ms_sum,
                    active_sessions
                FROM analytics_daily
                """
            ).fetchone()

        assert read_aggregates() == (1, 1, 1, 5000, 1)

        # Repetir el mismo evento no debe duplicar el clic.
        db.execute(
            """
            INSERT INTO analytics_events (
                event_id, session_id, action
            )
            VALUES (?, ?, ?)
            ON CONFLICT(event_id) DO NOTHING
            """,
            (event_id, session_id, "navigation_click"),
        )

        # Repetir el mismo tiempo tampoco debe acumularlo.
        db.execute(
            """
            UPDATE analytics_sessions
            SET active_ms = ?
            WHERE session_id = ?
            """,
            (5000, session_id),
        )

        assert read_aggregates() == (1, 1, 1, 5000, 1)

    finally:
        db.close()
