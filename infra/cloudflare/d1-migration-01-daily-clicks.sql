
-- Ampliación de estadísticas diarias.
-- Autor: David Vidal Ramírez
--
-- Añade contadores sin borrar los registros existentes.
-- Ejecutar una sola vez sobre el esquema original.

ALTER TABLE analytics_daily
ADD COLUMN phone_clicks INTEGER NOT NULL DEFAULT 0
CHECK (phone_clicks >= 0);

ALTER TABLE analytics_daily
ADD COLUMN navigation_clicks INTEGER NOT NULL DEFAULT 0
CHECK (navigation_clicks >= 0);
