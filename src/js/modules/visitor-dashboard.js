
/**
 * Actualización pública de estadísticas del portafolio.
 * Autor: David Vidal Ramírez
 *
 * Consulta estadísticas agregadas mediante Cloudflare.
 * No escribe información ni recopila datos personales.
 */

'use strict';

const STATS_URL =
    'https://cv-david-vidal-analytics.david650991.workers.dev/stats';

const REFRESH_MS = 120_000;

function validCount(value) {
    return Number.isSafeInteger(value) && value >= 0
        ? value
        : null;
}

function formatCount(value) {
    return value === null
        ? '—'
        : value.toLocaleString('es-MX');
}

function formatDuration(seconds) {
    if (seconds === null) return '—';

    const minutes = Math.floor(seconds / 60);
    const remaining = seconds % 60;

    if (minutes === 0) return `${remaining} s`;

    return `${minutes} min ${remaining} s`;
}

export function initVisitorDashboard() {
    const panel = document.querySelector('[data-visitor-analytics]');
    if (!panel) return;

    const status = panel.querySelector('[data-analytics-status]');

    function setText(selector, value) {
        const element = panel.querySelector(selector);
        if (element) element.textContent = value;
    }

    function updateBar(selector, count, maximum) {
        const bar = panel.querySelector(selector);
        if (!bar) return;

        const percentage =
            count === null || maximum <= 0
                ? 0
                : Math.min(100, (count / maximum) * 100);

        bar.style.width = `${percentage}%`;
    }

    function renderStats(stats) {
        const visits = validCount(stats.total_visits);
        const clicks = validCount(stats.total_clicks);
        const duration = validCount(stats.average_active_seconds);
        const online = validCount(stats.online_estimate);

        const downloads = validCount(stats.cv_clicks);
        const whatsapp = validCount(stats.whatsapp_clicks);
        const email = validCount(stats.email_clicks);

        setText('[data-stat-visits]', formatCount(visits));
        setText('[data-stat-clicks]', formatCount(clicks));
        setText('[data-stat-duration]', formatDuration(duration));
        setText('[data-stat-online]', formatCount(online));

        setText('[data-stat-downloads]', formatCount(downloads));
        setText('[data-stat-whatsapp]', formatCount(whatsapp));
        setText('[data-stat-email]', formatCount(email));

        const maximum = Math.max(
            downloads ?? 0,
            whatsapp ?? 0,
            email ?? 0
        );

        updateBar('[data-bar-download]', downloads, maximum);
        updateBar('[data-bar-whatsapp]', whatsapp, maximum);
        updateBar('[data-bar-email]', email, maximum);
    }

    async function refresh() {
        if (document.visibilityState !== 'visible') return;

        try {
            const response = await fetch(STATS_URL, {
                method: 'GET',
                cache: 'no-store',
                headers: {
                    Accept: 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const result = await response.json();

            if (
                result.status === 'sin_registros' &&
                result.stats === null
            ) {
                status.textContent = 'Sin registros todavía';
                return;
            }

            if (
                result.status !== 'datos_disponibles' ||
                !result.stats ||
                typeof result.stats !== 'object' ||
                Array.isArray(result.stats)
            ) {
                throw new Error('Respuesta estadística no válida');
            }

            renderStats(result.stats);

            status.textContent = result.recording
                ? 'Medición activa'
                : 'Datos publicados · registro pausado';

        } catch (error) {
            status.textContent = 'Estadísticas no disponibles';
            console.warn('No fue posible actualizar estadísticas:', error.message);
        }
    }

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            void refresh();
        }
    });

    void refresh();
    window.setInterval(() => void refresh(), REFRESH_MS);
}
