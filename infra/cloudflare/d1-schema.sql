
-- Estadísticas del currículum profesional
-- Autor: David Vidal Ramírez
-- Base: cv-david-vidal-stats
--
-- No almacena nombres, correos ni direcciones IP.
-- Los identificadores de sesión son seudónimos.
-- Las fechas numéricas utilizan segundos Unix UTC.

-- 1. Sesiones de navegación.
CREATE TABLE IF NOT EXISTS analytics_sessions (
    session_id TEXT PRIMARY KEY NOT NULL
        CHECK (length(session_id) BETWEEN 16 AND 128),

    started_at INTEGER NOT NULL DEFAULT (unixepoch()),

    last_seen_at INTEGER NOT NULL DEFAULT (unixepoch()),

    active_ms INTEGER NOT NULL DEFAULT 0
        CHECK (active_ms >= 0),

    ended_at INTEGER,

    CHECK (last_seen_at >= started_at),
    CHECK (ended_at IS NULL OR ended_at >= started_at)
);

-- Optimización para conexiones activas aproximadas.
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_online
    ON analytics_sessions (last_seen_at)
    WHERE ended_at IS NULL;


-- 2. Eventos relevantes.
CREATE TABLE IF NOT EXISTS analytics_events (
    event_id TEXT PRIMARY KEY NOT NULL
        CHECK (length(event_id) BETWEEN 16 AND 128),

    session_id TEXT NOT NULL,

    action TEXT NOT NULL CHECK (action IN (
        'cv_download_click',
        'whatsapp_click',
        'email_click',
        'project_link_click',
        'phone_click',
        'navigation_click'
    )),

    created_at INTEGER NOT NULL DEFAULT (unixepoch()),

    FOREIGN KEY (session_id)
        REFERENCES analytics_sessions (session_id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_session
    ON analytics_events (session_id);


-- 3. Estadísticas acumuladas por día UTC.
CREATE TABLE IF NOT EXISTS analytics_daily (
    day_utc TEXT PRIMARY KEY NOT NULL,

    total_visits INTEGER NOT NULL DEFAULT 0
        CHECK (total_visits >= 0),

    total_clicks INTEGER NOT NULL DEFAULT 0
        CHECK (total_clicks >= 0),

    cv_clicks INTEGER NOT NULL DEFAULT 0
        CHECK (cv_clicks >= 0),

    whatsapp_clicks INTEGER NOT NULL DEFAULT 0
        CHECK (whatsapp_clicks >= 0),

    email_clicks INTEGER NOT NULL DEFAULT 0
        CHECK (email_clicks >= 0),

    project_clicks INTEGER NOT NULL DEFAULT 0
        CHECK (project_clicks >= 0),

    phone_clicks INTEGER NOT NULL DEFAULT 0
        CHECK (phone_clicks >= 0),

    navigation_clicks INTEGER NOT NULL DEFAULT 0
        CHECK (navigation_clicks >= 0),

    active_ms_sum INTEGER NOT NULL DEFAULT 0
        CHECK (active_ms_sum >= 0),

    active_sessions INTEGER NOT NULL DEFAULT 0
        CHECK (active_sessions >= 0)
);
