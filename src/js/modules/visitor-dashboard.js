
/**
 * Actualización pública de estadísticas del portafolio.
 * Autor: David Vidal Ramírez
 *
 * Consulta estadísticas agregadas mediante Cloudflare.
 * No escribe información ni recopila datos personales.
 */

import {
    ACCEPTED_EVENT_NAME,
    PRIVACY_STATE_EVENT_NAME,
    resolvePrivacyState
} from './visitor-transport.js';

'use strict';

const STATS_URL = (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
)
    ? 'http://127.0.0.1:8787/stats-d1'
    : 'https://cv-david-vidal-analytics.david650991.workers.dev/stats-d1';

const REFRESH_MS = 120_000;
const ACCEPTED_REFRESH_DELAY_MS = 250;

export function measurementStatusText(
    privacyState,
    recording,
    empty = false
) {
    if (privacyState.reason === 'gpc') {
        return 'Contadores públicos · medición local bloqueada por GPC';
    }

    if (privacyState.reason === 'dnt-pending') {
        return 'Contadores públicos · autorización pendiente';
    }

    if (privacyState.reason === 'dnt-denied') {
        return 'Contadores públicos · medición desactivada en esta pestaña';
    }

    if (privacyState.reason === 'dnt-granted') {
        return recording
            ? 'Medición autorizada en esta pestaña'
            : 'Autorización guardada · registro pausado';
    }

    if (empty) {
        return recording
            ? 'Sin registros todavía · medición activa'
            : 'Sin registros todavía · registro pausado';
    }

    return recording
        ? 'Medición activa'
        : 'Datos publicados · registro pausado';
}

export function createSingleFlight(task) {
    let pending = null;
    let refreshAfterPending = false;

    async function execute() {
        let result;

        do {
            refreshAfterPending = false;
            result = await task();
        } while (refreshAfterPending);

        return result;
    }

    return function run(options = {}) {
        if (pending) {
            if (options.ensureFresh === true) {
                refreshAfterPending = true;
            }

            return pending;
        }

        pending = Promise.resolve()
            .then(execute)
            .finally(() => {
                pending = null;
            });

        return pending;
    };
}

export function createAcceptedRefreshHandler(
    refreshCallbacks,
    schedule = window.setTimeout.bind(window),
    cancel = window.clearTimeout.bind(window)
) {
    let timerId = null;

    return function handleAcceptedEvent(event) {
        if (event.detail?.type !== 'click') return;

        if (timerId !== null) cancel(timerId);

        timerId = schedule(() => {
            timerId = null;
            refreshCallbacks.forEach((refresh) => void refresh());
        }, ACCEPTED_REFRESH_DELAY_MS);
    };
}

const EMPTY_STATS = Object.freeze({
    total_visits: 0,
    total_clicks: 0,
    average_active_seconds: 0,
    online_estimate: 0,
    cv_clicks: 0,
    whatsapp_clicks: 0,
    email_clicks: 0,
    phone_clicks: 0,
    navigation_clicks: 0,
    project_clicks: 0
});

const COUNT_FIELDS = Object.freeze([
    'total_visits',
    'total_clicks',
    'online_estimate',
    'cv_clicks',
    'whatsapp_clicks',
    'email_clicks',
    'phone_clicks',
    'navigation_clicks',
    'project_clicks'
]);

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

export function normalizeStatsResponse(result) {
    if (
        !result ||
        typeof result !== 'object' ||
        Array.isArray(result) ||
        typeof result.recording !== 'boolean'
    ) {
        throw new Error('Respuesta estadística no válida');
    }

    if (
        result.status === 'sin_registros' &&
        result.stats === null
    ) {
        return {
            state: 'empty',
            recording: result.recording,
            stats: { ...EMPTY_STATS }
        };
    }

    if (
        result.status !== 'datos_disponibles' ||
        !result.stats ||
        typeof result.stats !== 'object' ||
        Array.isArray(result.stats)
    ) {
        throw new Error('Respuesta estadística no válida');
    }

    const stats = result.stats;

    for (const field of COUNT_FIELDS) {
        if (validCount(stats[field]) === null) {
            throw new Error(`Contador no válido: ${field}`);
        }
    }

    if (
        stats.average_active_seconds !== null &&
        validCount(stats.average_active_seconds) === null
    ) {
        throw new Error('Duración media no válida');
    }

    return {
        state: 'data',
        recording: result.recording,
        stats: { ...stats }
    };
}

export function normalizeHistory(rows) {
    if (!Array.isArray(rows)) {
        throw new Error('Historial D1 no válido');
    }

    const normalized = rows.map((row) => {
        if (!row || typeof row !== 'object') {
            throw new Error('Fila histórica no válida');
        }

        const date = row.day_utc;

        if (
            typeof date !== 'string' ||
            !/^\d{4}-\d{2}-\d{2}$/.test(date)
        ) {
            throw new Error('Fecha histórica no válida');
        }

        const parsedDate = new Date(`${date}T00:00:00Z`);

        if (
            Number.isNaN(parsedDate.getTime()) ||
            parsedDate.toISOString().slice(0, 10) !== date
        ) {
            throw new Error('Fecha histórica no válida');
        }

        const visits = validCount(row.total_visits);
        const clicks = validCount(row.total_clicks);
        const activeMs = validCount(row.active_ms_sum);
        const activeSessions = validCount(row.active_sessions);

        if (
            visits === null ||
            clicks === null ||
            activeMs === null ||
            activeSessions === null
        ) {
            throw new Error('Contadores históricos no válidos');
        }

        const averageSeconds = activeSessions > 0
            ? Math.round(activeMs / activeSessions / 1000)
            : null;

        return {
            date,
            visits,
            clicks,
            averageSeconds
        };
    });

    return normalized.sort((a, b) =>
        a.date.localeCompare(b.date)
    );
}

export function initVisitorDashboard() {
    const panel = document.querySelector('[data-visitor-analytics]');
    if (!panel) return;

    const status = panel.querySelector('[data-analytics-status]');
    let latestRecording = false;
    let latestEmptyState = false;

    function updateMeasurementStatus(
        privacyState = resolvePrivacyState()
    ) {
        status.textContent = measurementStatusText(
            privacyState,
            latestRecording,
            latestEmptyState
        );
    }

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

    async function performHistoryRefresh() {
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

    async function performRefresh() {
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

            const normalized = normalizeStatsResponse(result);
            latestRecording = normalized.recording;
            latestEmptyState = normalized.state === 'empty';

            renderStats(normalized.stats);
            updateMeasurementStatus();

        } catch (error) {
            status.textContent = 'Estadísticas no disponibles';
            console.warn('No fue posible actualizar estadísticas:', error.message);
        }
    }

    const refresh = createSingleFlight(performRefresh);
    const refreshHistory = createSingleFlight(
        performHistoryRefresh
    );

    const refreshAfterAcceptedClick =
        createAcceptedRefreshHandler([
            () => refresh({ ensureFresh: true }),
            () => refreshHistory({ ensureFresh: true })
        ]);

    window.addEventListener(
        ACCEPTED_EVENT_NAME,
        refreshAfterAcceptedClick
    );

    window.addEventListener(
        PRIVACY_STATE_EVENT_NAME,
        (event) => updateMeasurementStatus(event.detail)
    );

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
