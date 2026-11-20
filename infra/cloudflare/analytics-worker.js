
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

export default {
    async fetch(request) {
        const url = new URL(request.url);
        const path = url.pathname;
        const origin = request.headers.get('Origin') || '';

        const knownPaths = [
            '/',
            '/health',
            '/stats',
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
                status: 'preparacion',
                recording: false
            }, 200, origin);
        }

        if (request.method === 'GET' && path === '/health') {
            return jsonResponse({
                ok: true,
                service: 'cv-david-vidal-analytics',
                firebaseConnected: false,
                recording: false
            }, 200, origin);
        }

        if (request.method === 'GET' && path === '/stats') {
            return jsonResponse({
                error: 'estadisticas_no_configuradas'
            }, 503, origin);
        }

        if (request.method === 'POST' && path === '/events') {
            if (!ALLOWED_ORIGINS.has(origin)) {
                return jsonResponse({
                    error: 'origen_no_permitido'
                }, 403, origin);
            }

            return jsonResponse({
                error: 'registro_no_habilitado'
            }, 503, origin);
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
