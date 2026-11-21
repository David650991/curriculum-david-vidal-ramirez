
-- Migración 02: ampliar las acciones registrables.
-- Autor: David Vidal Ramírez
-- Base: cv-david-vidal-stats
--
-- Conserva los eventos existentes mediante copia.
-- Requiere respaldo y ejecución transaccional.
-- No ejecutar por instrucciones SQL separadas
-- desde la consola de producción.
--
-- Ejecutar una sola vez.

-- 1. Crear tabla con las seis acciones permitidas.
CREATE TABLE analytics_events_new (
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

-- 2. Copiar los registros originales.
INSERT INTO analytics_events_new (
    event_id,
    session_id,
    action,
    created_at
)
SELECT
    event_id,
    session_id,
    action,
    created_at
FROM analytics_events;

-- 3. Sustituir la tabla original.
DROP TABLE analytics_events;

ALTER TABLE analytics_events_new
RENAME TO analytics_events;

-- 4. Restaurar el índice original.
CREATE INDEX idx_analytics_events_session
    ON analytics_events (session_id);
