
/**
 * Medición local de permanencia del portafolio.
 * Autor: David Vidal Ramírez
 *
 * Distingue tiempo transcurrido y tiempo activo estimado.
 * No almacena información personal ni realiza peticiones de red.
 */

'use strict';

const ACTIVITY_WINDOW_MS = 60_000;
const REPORT_INTERVAL_MS = 30_000;
const ACTIVITY_THROTTLE_MS = 1_000;
const ACTIVITY_EVENT = 'portfolio:session-activity';

export function initVisitorSession() {
    const panel = document.querySelector('[data-visitor-analytics]');

    if (!panel) return;

    const startedAt = performance.now();

    let lastMeasuredAt = startedAt;
    let lastInteractionAt = startedAt;
    let activeMs = 0;
    let pageVisible = document.visibilityState === 'visible';

    function report(now) {
        window.dispatchEvent(new CustomEvent(ACTIVITY_EVENT, {
            detail: {
                elapsedMs: Math.round(now - startedAt),
                activeMs: Math.round(activeMs),
                visible: pageVisible,
                idle: !pageVisible ||
                    now - lastInteractionAt >= ACTIVITY_WINDOW_MS
            }
        }));
    }

    function measure(now = performance.now()) {
        if (pageVisible) {
            const activeUntil = Math.min(
                now,
                lastInteractionAt + ACTIVITY_WINDOW_MS
            );

            const increment = Math.max(
                0,
                activeUntil - lastMeasuredAt
            );

            activeMs += increment;
        }

        lastMeasuredAt = now;
    }

    function registerActivity() {
        if (!pageVisible) return;

        const now = performance.now();

        if (now - lastInteractionAt < ACTIVITY_THROTTLE_MS) {
            return;
        }

        // Contabilizar el intervalo anterior antes de
        // abrir una nueva ventana de actividad.
        measure(now);

        lastInteractionAt = now;
    }

    const activityEvents = [
        'pointermove',
        'pointerdown',
        'keydown',
        'scroll',
        'touchstart'
    ];

    activityEvents.forEach((eventName) => {
        document.addEventListener(
            eventName,
            registerActivity,
            { passive: true }
        );
    });

    document.addEventListener('visibilitychange', () => {
        const now = performance.now();

        // Medir hasta el instante del cambio de visibilidad.
        measure(now);

        pageVisible = document.visibilityState === 'visible';

        if (pageVisible) {
            lastInteractionAt = now;
        }

        report(now);
    });

    window.addEventListener('pagehide', () => {
        const now = performance.now();

        // Registrar el último intervalo medible.
        measure(now);

        pageVisible = false;

        // Notificar la actividad final acumulada.
        report(now);
    });

    // Restauración de una página desde la caché del navegador.
    window.addEventListener('pageshow', (event) => {
        if (!event.persisted) return;

        const now = performance.now();

        lastMeasuredAt = now;
        lastInteractionAt = now;
        pageVisible = document.visibilityState === 'visible';

        report(now);
    });

    window.setInterval(() => {
        const now = performance.now();

        measure(now);
        report(now);
    }, REPORT_INTERVAL_MS);
}
