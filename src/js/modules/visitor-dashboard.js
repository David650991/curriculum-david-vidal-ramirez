
/**
 * Actualización pública de estadísticas del portafolio.
 * Autor: David Vidal Ramírez
 *
 * Consulta estadísticas agregadas mediante Cloudflare.
 * No escribe información ni recopila datos personales.
 */

import {
    privacyOptOutRequested
} from './visitor-transport.js';

'use strict';

const STATS_URL = (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
)
    ? 'http://127.0.0.1:8787/stats-d1'
    : 'https://cv-david-vidal-analytics.david650991.workers.dev/stats-d1';

const REFRESH_MS = 120_000;

const HISTORY_URL = (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
)
    ? 'http://127.0.0.1:8787/history-d1'
    : 'https://cv-david-vidal-analytics.david650991.workers.dev/history-d1';

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

        const phone = validCount(stats.phone_clicks);
        const navigation = validCount(stats.navigation_clicks);
        const projects = validCount(stats.project_clicks);

        setText('[data-stat-visits]', formatCount(visits));
        setText('[data-stat-clicks]', formatCount(clicks));
        setText('[data-stat-duration]', formatDuration(duration));
        setText('[data-stat-online]', formatCount(online));

        setText('[data-stat-downloads]', formatCount(downloads));
        setText('[data-stat-whatsapp]', formatCount(whatsapp));
        setText('[data-stat-email]', formatCount(email));

        setText('[data-stat-phone]', formatCount(phone));
        setText('[data-stat-navigation]', formatCount(navigation));
        setText('[data-stat-projects]', formatCount(projects));

        const maximum = Math.max(
            downloads ?? 0,
            whatsapp ?? 0,
            email ?? 0,
            phone ?? 0,
            navigation ?? 0,
            projects ?? 0
        );

        updateBar('[data-bar-download]', downloads, maximum);
        updateBar('[data-bar-whatsapp]', whatsapp, maximum);
        updateBar('[data-bar-email]', email, maximum);

        updateBar('[data-bar-phone]', phone, maximum);
        updateBar('[data-bar-navigation]', navigation, maximum);
        updateBar('[data-bar-projects]', projects, maximum);
    }

    // Representación histórica de los datos de D1.
    // Autor: David Vidal Ramírez.

    const historyPanel = panel.querySelector(
        '[data-analytics-history]'
    );

    const historyStatus = panel.querySelector(
        '[data-history-status]'
    );

    const visitsHistory = panel.querySelector(
        '[data-history-visits]'
    );

    const durationHistory = panel.querySelector(
        '[data-history-duration]'
    );

    function normalizeHistory(rows) {
        if (!Array.isArray(rows)) {
            throw new Error('Historial D1 no válido');
        }

        return rows.map((row) => {
            if (!row || typeof row !== 'object') {
                return null;
            }

            const date = row.day_utc;

            if (
                typeof date !== 'string' ||
                !/^\d{4}-\d{2}-\d{2}$/.test(date)
            ) {
                return null;
            }

            const parsedDate = new Date(
                `${date}T00:00:00Z`
            );

            if (
                Number.isNaN(parsedDate.getTime()) ||
                parsedDate.toISOString().slice(0, 10) !== date
            ) {
                return null;
            }

            const visits = validCount(row.total_visits);
            const clicks = validCount(row.total_clicks);
            const activeMs = validCount(row.active_ms_sum);
            const activeSessions = validCount(
                row.active_sessions
            );

            if (
                visits === null ||
                clicks === null ||
                activeMs === null ||
                activeSessions === null
            ) {
                return null;
            }

            const averageSeconds = activeSessions > 0
                ? Math.round(
                    activeMs / activeSessions / 1000
                )
                : null;

            return {
                date,
                visits,
                clicks,
                averageSeconds
            };
        })
            .filter((row) => row !== null)
            .sort((a, b) => a.date.localeCompare(b.date));
    }

    function createHistoryBar(value, maximum, category) {
        const bar = document.createElement('span');

        bar.className =
            'visitor-analytics__history-bar ' +
            `visitor-analytics__history-bar--${category}`;

        const percentage = maximum > 0
            ? (value / maximum) * 100
            : 0;

        bar.style.height = value > 0
            ? `${Math.max(3, percentage)}%`
            : '0%';

        return bar;
    }

    function createHistoryDay(row, maximum, mode) {
        const day = document.createElement('div');
        day.className = 'visitor-analytics__history-day';
        day.setAttribute('role', 'listitem');

        const bars = document.createElement('div');
        bars.className = 'visitor-analytics__history-bars';
        bars.setAttribute('aria-hidden', 'true');

        const value = document.createElement('span');
        value.className = 'visitor-analytics__history-value';

        const date = document.createElement('span');
        date.className = 'visitor-analytics__history-date';
        date.textContent = `${row.date.slice(8, 10)}/` +
            row.date.slice(5, 7);

        if (mode === 'visits') {
            bars.append(
                createHistoryBar(
                    row.visits,
                    maximum,
                    'visits'
                ),
                createHistoryBar(
                    row.clicks,
                    maximum,
                    'clicks'
                )
            );

            value.textContent =
                `${formatCount(row.visits)} / ` +
                formatCount(row.clicks);

            day.setAttribute(
                'aria-label',
                `${row.date}: ${row.visits} visitas, ` +
                `${row.clicks} clics`
            );
        } else {
            const seconds = row.averageSeconds;

            bars.append(
                createHistoryBar(
                    seconds ?? 0,
                    maximum,
                    'duration'
                )
            );

            value.textContent = formatDuration(seconds);

            day.setAttribute(
                'aria-label',
                `${row.date}: tiempo activo medio ` +
                formatDuration(seconds)
            );
        }

        day.append(bars, value, date);
        return day;
    }

    function renderHistory(rows) {
        if (!visitsHistory || !durationHistory) {
            return;
        }

        const maximumCount = Math.max(
            1,
            ...rows.map(
                (row) => Math.max(row.visits, row.clicks)
            )
        );

        const maximumDuration = Math.max(
            1,
            ...rows.map(
                (row) => row.averageSeconds ?? 0
            )
        );

        visitsHistory.replaceChildren(
            ...rows.map(
                (row) => createHistoryDay(
                    row,
                    maximumCount,
                    'visits'
                )
            )
        );

        durationHistory.replaceChildren(
            ...rows.map(
                (row) => createHistoryDay(
                    row,
                    maximumDuration,
                    'duration'
                )
            )
        );
    }

    async function refreshHistory() {
        if (
            !HISTORY_URL ||
            !historyPanel ||
            !historyStatus ||
            document.visibilityState !== 'visible'
        ) {
            return;
        }

        try {
            const response = await fetch(HISTORY_URL, {
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
                result.status !== 'datos_disponibles' ||
                !Array.isArray(result.history)
            ) {
                throw new Error(
                    'Respuesta histórica no válida'
                );
            }

            const rows = normalizeHistory(result.history);

            renderHistory(rows);

            historyStatus.textContent = rows.length
                ? `${rows.length} día(s) con registros ` +
                'en los últimos 90 días (UTC)'
                : 'Sin registros históricos disponibles';

        } catch (error) {
            historyStatus.textContent =
                'Historial temporalmente no disponible';

            console.warn(
                'No fue posible consultar el historial:',
                error.message
            );
        }
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

            status.textContent = privacyOptOutRequested()
                ? 'Tu preferencia de privacidad está protegida'
                : result.recording
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

    if (
        HISTORY_URL &&
        historyPanel &&
        historyStatus &&
        visitsHistory &&
        durationHistory
    ) {
        historyPanel.hidden = false;

        void refreshHistory();

        window.setInterval(
            () => void refreshHistory(),
            REFRESH_MS
        );

        document.addEventListener(
            'visibilitychange',
            () => {
                if (document.visibilityState === 'visible') {
                    void refreshHistory();
                }
            }
        );
    }
}
