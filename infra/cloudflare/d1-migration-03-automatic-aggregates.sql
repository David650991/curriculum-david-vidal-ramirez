
-- Migración 03: acumuladores automáticos de estadísticas.
-- Autor: David Vidal Ramírez
-- Base: cv-david-vidal-stats
--
-- Los disparadores se ejecutan cuando existen cambios
-- reales en las tablas de sesiones y eventos.
--
-- Los tiempos se agrupan por día de inicio de sesión.
-- Los eventos se agrupan por día del clic (UTC).
--
-- Ejecutar una sola vez después de las migraciones 01 y 02.

-- 1. Contabilizar cada sesión nueva.
CREATE TRIGGER trg_analytics_sessions_insert
AFTER INSERT ON analytics_sessions
BEGIN
    INSERT INTO analytics_daily (
        day_utc,
        total_visits
    )
    VALUES (
        date(NEW.started_at, 'unixepoch'),
        1
    )
    ON CONFLICT(day_utc) DO UPDATE SET
        total_visits = total_visits + 1;
END;

-- 2. Contabilizar cada evento nuevo.
CREATE TRIGGER trg_analytics_events_insert
AFTER INSERT ON analytics_events
BEGIN
    INSERT INTO analytics_daily (
        day_utc,
        total_clicks,
        cv_clicks,
        whatsapp_clicks,
        email_clicks,
        project_clicks,
        phone_clicks,
        navigation_clicks
    )
    VALUES (
        date(NEW.created_at, 'unixepoch'),
        1,
        CASE WHEN NEW.action = 'cv_download_click'
            THEN 1 ELSE 0 END,
        CASE WHEN NEW.action = 'whatsapp_click'
            THEN 1 ELSE 0 END,
        CASE WHEN NEW.action = 'email_click'
            THEN 1 ELSE 0 END,
        CASE WHEN NEW.action = 'project_link_click'
            THEN 1 ELSE 0 END,
        CASE WHEN NEW.action = 'phone_click'
            THEN 1 ELSE 0 END,
        CASE WHEN NEW.action = 'navigation_click'
            THEN 1 ELSE 0 END
    )
    ON CONFLICT(day_utc) DO UPDATE SET
        total_clicks = total_clicks + 1,
        cv_clicks = cv_clicks + excluded.cv_clicks,
        whatsapp_clicks =
            whatsapp_clicks + excluded.whatsapp_clicks,
        email_clicks = email_clicks + excluded.email_clicks,
        project_clicks =
            project_clicks + excluded.project_clicks,
        phone_clicks = phone_clicks + excluded.phone_clicks,
        navigation_clicks =
            navigation_clicks + excluded.navigation_clicks;
END;

-- 3. Acumular solamente los incrementos de tiempo activo.
CREATE TRIGGER trg_analytics_sessions_active_ms
AFTER UPDATE OF active_ms ON analytics_sessions
WHEN NEW.active_ms > OLD.active_ms
BEGIN
    INSERT INTO analytics_daily (
        day_utc,
        active_ms_sum,
        active_sessions
    )
    VALUES (
        date(NEW.started_at, 'unixepoch'),
        NEW.active_ms - OLD.active_ms,
        CASE WHEN OLD.active_ms = 0 THEN 1 ELSE 0 END
    )
    ON CONFLICT(day_utc) DO UPDATE SET
        active_ms_sum =
            active_ms_sum + excluded.active_ms_sum,
        active_sessions =
            active_sessions + excluded.active_sessions;
END;