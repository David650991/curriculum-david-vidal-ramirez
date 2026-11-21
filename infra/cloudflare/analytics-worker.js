
/**
 * Servicio de estadísticas del currículum.
 *
 * Autor: David Vidal Ramírez
 * Plataforma: Cloudflare Workers
 *
 * Fase inicial:
 * - Verificar disponibilidad del servicio.
 * - Preparar rutas para estadísticas.
 * - Configurar CORS.
 * - Bloquear registros hasta implementar validación.
 *
 * No contiene credenciales privadas.
 * No realiza escrituras en Firebase.
 */

'use strict';

const ALLOWED_ORIGINS = new Set([
    'https://david650991.github.io',
    'http://localhost:8000',
    'http://127.0.0.1:8000'
]);

const PUBLIC_STATS_URL =
    'https://cv-david-vidal-estadisticas-default-rtdb.firebaseio.com/public_stats.json';

function jsonResponse(data, status = 200, origin = '') {
    const headers = new Headers({
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'
    });

    if (ALLOWED_ORIGINS.has(origin)) {
        headers.set('Access-Control-Allow-Origin', origin);
        headers.set('Vary', 'Origin');
    }

    return new Response(JSON.stringify(data), {
        status,
        headers
    });
}

function handlePreflight(origin) {
    if (!ALLOWED_ORIGINS.has(origin)) {
        return jsonResponse({
            error: 'origen_no_permitido'
        }, 403);
    }

    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '600',
            'Vary': 'Origin'
        }
    });
}

const ALLOWED_ACTIONS = new Set([
    'cv_download_click',
    'whatsapp_click',
    'email_click',
    'project_link_click',
    'phone_click',
    'navigation_click'
]);

const MAX_EVENT_BODY_BYTES = 1024;
const MAX_SESSION_ACTIVE_MS = 86_400_000;
const MAX_CLICKS_PER_SESSION = 60;

function validSessionId(value) {
    return typeof value === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function buildRateLimitKeys(request, type, sessionId) {
    const colo = (
        typeof request.cf?.colo === 'string' &&
        /^[A-Z0-9]{3}$/i.test(request.cf.colo)
    )
        ? request.cf.colo.toUpperCase()
        : 'UNKNOWN';

    return {
        edge: `events:edge:${colo}`,
        subject: type === 'session_start'
            ? `events:start:${colo}`
            : `events:session:${sessionId}`
    };
}

async function checkRateLimit(env, key) {
    if (
        !env.EVENT_RATE_LIMITER ||
        typeof env.EVENT_RATE_LIMITER.limit !== 'function'
    ) {
        return {
            error: 'limite_no_configurado',
            status: 503
        };
    }

    try {
        const { success } = await env.EVENT_RATE_LIMITER.limit({
            key
        });

        return success
            ? null
            : {
                error: 'demasiadas_solicitudes',
                status: 429
            };
    } catch (error) {
        console.error('Rate limiting failed:', error);

        return {
            error: 'control_de_frecuencia_no_disponible',
            status: 503
        };
    }
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const path = url.pathname;
        const origin = request.headers.get('Origin') || '';
        const recordingEnabled =
            env.ANALYTICAS_ESCRITURA === 'habilitada';

        const knownPaths = [
            '/',
            '/health',
            '/db-health',
            '/stats',
            '/stats-d1',
            '/history-d1',
            '/events'
        ];

        if (request.method === 'OPTIONS') {
            if (!knownPaths.includes(path)) {
                return jsonResponse({
                    error: 'ruta_no_encontrada'
                }, 404, origin);
            }

            return handlePreflight(origin);
        }

        if (request.method === 'GET' && path === '/') {
            return jsonResponse({
                service: 'cv-david-vidal-analytics',
                status: recordingEnabled ? 'activo' : 'preparacion',
                recording: recordingEnabled
            }, 200, origin);
        }

        if (request.method === 'GET' && path === '/health') {
            return jsonResponse({
                ok: true,
                service: 'cv-david-vidal-analytics',
                firebaseConnected: false,
                recording: recordingEnabled
            }, 200, origin);
        }

        if (request.method === 'GET' && path === '/db-health') {
            if (!env.DB) {
                return jsonResponse({
                    ok: false,
                    databaseConnected: false,
                    recording: recordingEnabled
                }, 503, origin);
            }

            try {
                const result = await env.DB
                    .prepare('SELECT COUNT(*) AS total FROM analytics_sessions')
                    .first();

                return jsonResponse({
                    ok: true,
                    databaseConnected: true,
                    sessions: result.total,
                    recording: recordingEnabled
                }, 200, origin);

            } catch {
                return jsonResponse({
                    ok: false,
                    databaseConnected: false,
                    recording: recordingEnabled
                }, 503, origin);
            }
        }

        // Estadísticas históricas diarias.
        // Autor: David Vidal Ramírez.
        // Consulta de solo lectura: no modifica acumulados.
        if (
            request.method === 'GET' &&
            path === '/history-d1'
        ) {
            if (!env.DB) {
                return jsonResponse({
                    error: 'd1_no_vinculada'
                }, 503, origin);
            }

            try {
                const history = await env.DB.prepare(`
                    SELECT
                        day_utc,
                        total_visits,
                        total_clicks,
                        cv_clicks,
                        whatsapp_clicks,
                        email_clicks,
                        project_clicks,
                        phone_clicks,
                        navigation_clicks,
                        active_ms_sum,
                        active_sessions
                    FROM analytics_daily
                    WHERE day_utc >= date('now', '-89 days')
                    ORDER BY day_utc ASC
                `).all();

                return jsonResponse({
                    service: 'cv-david-vidal-analytics',
                    status: 'datos_disponibles',
                    period_days: 90,
                    timezone: 'UTC',
                    history: history.results || []
                }, 200, origin);

            } catch (error) {
                console.error(
                    'D1 history query failed:',
                    error
                );

                return jsonResponse({
                    error: 'consulta_historica_fallida'
                }, 502, origin);
            }
        }

        if (request.method === 'GET' && path === '/stats-d1') {
            if (!env.DB) {
                return jsonResponse({
                    error: 'd1_no_vinculada'
                }, 503, origin);
            }

            try {
                const totals = await env.DB.prepare(`
                    SELECT
                        COUNT(*) AS day_count,
                        COALESCE(SUM(total_visits), 0) AS total_visits,
                        COALESCE(SUM(total_clicks), 0) AS total_clicks,
                        COALESCE(SUM(cv_clicks), 0) AS cv_clicks,
                        COALESCE(SUM(whatsapp_clicks), 0) AS whatsapp_clicks,
                        COALESCE(SUM(email_clicks), 0) AS email_clicks,
                        COALESCE(SUM(project_clicks), 0) AS project_clicks,
                        COALESCE(SUM(phone_clicks), 0) AS phone_clicks,
                        COALESCE(SUM(navigation_clicks), 0) AS navigation_clicks,
                        COALESCE(SUM(active_ms_sum), 0) AS active_ms_sum,
                        COALESCE(SUM(active_sessions), 0) AS active_sessions
                    FROM analytics_daily
                `).first();

                if (!totals || totals.day_count === 0) {
                    return jsonResponse({
                        service: 'cv-david-vidal-analytics',
                        status: 'sin_registros',
                        recording: env.ANALYTICAS_ESCRITURA === 'habilitada',
                        stats: null
                    }, 200, origin);
                }

                const presence = await env.DB.prepare(`
                    SELECT COUNT(*) AS online
                    FROM analytics_sessions
                    WHERE ended_at IS NULL
                        AND last_seen_at >= unixepoch() - 120
                `).first();

                const averageSeconds = totals.active_sessions > 0
                    ? Math.round(
                        totals.active_ms_sum /
                        totals.active_sessions /
                        1000
                    )
                    : null;

                return jsonResponse({
                    service: 'cv-david-vidal-analytics',
                    status: 'datos_disponibles',
                    recording: env.ANALYTICAS_ESCRITURA === 'habilitada',
                    stats: {
                        total_visits: totals.total_visits,
                        total_clicks: totals.total_clicks,
                        cv_clicks: totals.cv_clicks,
                        whatsapp_clicks: totals.whatsapp_clicks,
                        email_clicks: totals.email_clicks,
                        project_clicks: totals.project_clicks,
                        phone_clicks: Number(totals.phone_clicks || 0),
                        navigation_clicks: Number(totals.navigation_clicks || 0),
                        average_active_seconds: averageSeconds,
                        online_estimate: presence?.online ?? 0
                    }
                }, 200, origin);

            } catch (error) {
                console.error('D1 statistics query failed:', error);

                return jsonResponse({
                    error: 'd1_consulta_fallida'
                }, 502, origin);
            }
        }

        if (request.method === 'GET' && path === '/stats') {
            try {
                const firebaseResponse = await fetch(PUBLIC_STATS_URL, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json'
                    }
                });

                if (!firebaseResponse.ok) {
                    return jsonResponse({
                        error: 'firebase_lectura_no_disponible',
                        firebaseStatus: firebaseResponse.status
                    }, 502, origin);
                }

                const stats = await firebaseResponse.json();

                if (stats === null) {
                    return jsonResponse({
                        service: 'cv-david-vidal-analytics',
                        status: 'sin_registros',
                        recording: false,
                        stats: null
                    }, 200, origin);
                }

                if (
                    typeof stats !== 'object' ||
                    Array.isArray(stats)
                ) {
                    return jsonResponse({
                        error: 'estructura_estadistica_invalida'
                    }, 502, origin);
                }

                return jsonResponse({
                    service: 'cv-david-vidal-analytics',
                    status: 'datos_disponibles',
                    recording: false,
                    stats
                }, 200, origin);

            } catch {
                return jsonResponse({
                    error: 'firebase_no_disponible'
                }, 502, origin);
            }
        }

        if (request.method === 'POST' && path === '/events') {
            if (!ALLOWED_ORIGINS.has(origin)) {
                return jsonResponse({
                    error: 'origen_no_permitido'
                }, 403, origin);
            }

            if (!env.DB) {
                return jsonResponse({
                    error: 'd1_no_vinculada'
                }, 503, origin);
            }

            // La escritura seguirá desactivada hasta
            // completar las pruebas de integración.
            if (env.ANALYTICAS_ESCRITURA !== 'habilitada') {
                return jsonResponse({
                    error: 'registro_no_habilitado'
                }, 503, origin);
            }

            // Limitar solicitudes antes de acceder a D1.
            // Autor: David Vidal Ramírez.
            //
            // El primer ámbito agrupa por centro de datos de
            // Cloudflare, no por IP. Reduce el bloqueo mundial
            // causado por una sola clave, pero no autentica ni
            // elimina tráfico automatizado.
            const preliminaryKeys = buildRateLimitKeys(
                request,
                '',
                'unvalidated'
            );
            const edgeLimit = await checkRateLimit(
                env,
                preliminaryKeys.edge
            );

            if (edgeLimit) {
                return jsonResponse({
                    error: edgeLimit.error
                }, edgeLimit.status, origin);
            }

            const contentType =
                request.headers.get('Content-Type') || '';

            const normalizedContentType = contentType.toLowerCase();
            const supportedContentType =
                normalizedContentType.startsWith('application/json') ||
                normalizedContentType.startsWith('text/plain');

            if (!supportedContentType) {
                return jsonResponse({
                    error: 'contenido_no_admitido'
                }, 415, origin);
            }

            let data;

            try {
                const raw = await request.text();

                if (
                    new TextEncoder().encode(raw).length >
                    MAX_EVENT_BODY_BYTES
                ) {
                    return jsonResponse({
                        error: 'contenido_demasiado_grande'
                    }, 413, origin);
                }

                data = JSON.parse(raw);

            } catch {
                return jsonResponse({
                    error: 'json_invalido'
                }, 400, origin);
            }

            if (
                !data ||
                typeof data !== 'object' ||
                Array.isArray(data) ||
                !validSessionId(data.sessionId)
            ) {
                return jsonResponse({
                    error: 'datos_invalidos'
                }, 400, origin);
            }

            const { sessionId, type } = data;

            // El segundo ámbito separa inicios por centro de datos
            // y eventos posteriores por sesión. El UUID procede del
            // cliente y puede rotarse, por lo que este control se
            // combina con sesión previa, idempotencia y límites D1.
            const rateLimitKeys = buildRateLimitKeys(
                request,
                type,
                sessionId
            );
            const subjectLimit = await checkRateLimit(
                env,
                rateLimitKeys.subject
            );

            if (subjectLimit) {
                return jsonResponse({
                    error: subjectLimit.error
                }, subjectLimit.status, origin);
            }

            try {
                // Autor: David Vidal Ramírez.
                // Solo session_start puede crear visitas.
                // Los clics y la actividad requieren una
                // sesión registrada previamente.
                if (
                    type === 'click' ||
                    type === 'session_activity'
                ) {
                    const existingSession = await env.DB.prepare(`
                        SELECT session_id
                        FROM analytics_sessions
                        WHERE session_id = ?
                          AND ended_at IS NULL
                        LIMIT 1
                    `).bind(sessionId).first();

                    if (!existingSession) {
                        return jsonResponse({
                            error: 'sesion_no_iniciada'
                        }, 404, origin);
                    }
                }

                const insertSession = () =>
                    env.DB.prepare(`
                        INSERT INTO analytics_sessions (
                            session_id
                        )
                        VALUES (?)
                        ON CONFLICT(session_id) DO NOTHING
                    `).bind(sessionId);

                if (type === 'session_start') {
                    await insertSession().run();

                    return jsonResponse({
                        ok: true,
                        type,
                        recording: true
                    }, 200, origin);
                }

                if (type === 'session_activity') {
                    const activeMs = data.activeMs;

                    if (
                        !Number.isSafeInteger(activeMs) ||
                        activeMs < 0 ||
                        activeMs > MAX_SESSION_ACTIVE_MS
                    ) {
                        return jsonResponse({
                            error: 'tiempo_activo_invalido'
                        }, 400, origin);
                    }

                    await env.DB.batch([
                        env.DB.prepare(`
                            UPDATE analytics_sessions
                            SET
                                active_ms = MAX(
                                    active_ms,
                                    MIN(
                                        ?,
                                        MAX(
                                            0,
                                            (unixepoch() - started_at)
                                                * 1000 + 60000
                                        )
                                    )
                                ),
                                last_seen_at = MAX(
                                    last_seen_at,
                                    unixepoch()
                                )
                            WHERE session_id = ?
                              AND ended_at IS NULL
                        `).bind(activeMs, sessionId)
                    ]);

                    return jsonResponse({
                        ok: true,
                        type,
                        recording: true
                    }, 200, origin);
                }

                if (type === 'click') {
                    if (
                        !validSessionId(data.eventId) ||
                        !ALLOWED_ACTIONS.has(data.action)
                    ) {
                        return jsonResponse({
                            error: 'evento_invalido'
                        }, 400, origin);
                    }

                    // Autor: David Vidal Ramírez.
                    // Aplicar el límite dentro del INSERT
                    // para evitar comprobaciones separadas
                    // que puedan admitir clics simultáneos.
                    const results = await env.DB.batch([
                        env.DB.prepare(`
                            INSERT INTO analytics_events (
                                event_id,
                                session_id,
                                action
                            )
                            SELECT ?, ?, ?
                            WHERE (
                                SELECT COUNT(*)
                                FROM analytics_events
                                WHERE session_id = ?
                            ) < ?
                            ON CONFLICT(event_id) DO NOTHING
                        `).bind(
                            data.eventId,
                            sessionId,
                            data.action,
                            sessionId,
                            MAX_CLICKS_PER_SESSION
                        ),
                        env.DB.prepare(`
                            SELECT
                                session_id,
                                action
                            FROM analytics_events
                            WHERE event_id = ?
                        `).bind(data.eventId)
                    ]);

                    const storedEvent = results[1]?.results?.[0];

                    if (!storedEvent) {
                        return jsonResponse({
                            error: 'limite_clics_sesion'
                        }, 429, origin);
                    }

                    if (
                        storedEvent.session_id !== sessionId ||
                        storedEvent.action !== data.action
                    ) {
                        return jsonResponse({
                            error: 'id_evento_reutilizado'
                        }, 409, origin);
                    }

                    return jsonResponse({
                        ok: true,
                        type,
                        recording: true
                    }, 200, origin);
                }

                return jsonResponse({
                    error: 'tipo_evento_no_admitido'
                }, 400, origin);

            } catch (error) {
                console.error(
                    'D1 event recording failed:',
                    error
                );

                return jsonResponse({
                    error: 'registro_d1_fallido'
                }, 503, origin);
            }
        }

        if (knownPaths.includes(path)) {
            return jsonResponse({
                error: 'metodo_no_permitido'
            }, 405, origin);
        }

        return jsonResponse({
            error: 'ruta_no_encontrada'
        }, 404, origin);
    }
};
