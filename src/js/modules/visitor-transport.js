
/**
 * Transporte de estadísticas del currículum.
 * Autor: David Vidal Ramírez
 *
 * Conecta los eventos existentes del navegador
 * con Cloudflare Workers y D1.
 *
 * Fase actual: pruebas locales exclusivamente.
 * No almacena identificadores en cookies ni storage.
 */

const LOCAL_EVENTS_URL = 'http://127.0.0.1:8787/events';

const CLICK_EVENT_NAME = 'portfolio:analytics';
const ACTIVITY_EVENT_NAME = 'portfolio:session-activity';

const ALLOWED_ACTIONS = new Set([
    'cv_download_click',
    'whatsapp_click',
    'email_click',
    'project_link_click',
    'phone_click',
    'navigation_click'
]);

const MAX_ACTIVE_MS = 86_400_000;

/**
 * Detecta preferencias de privacidad del navegador.
 * Autor: David Vidal Ramírez
 *
 * Se respetan DNT y Global Privacy Control.
 * No se almacenan estas preferencias.
 */
export function privacyOptOutRequested() {
    const doNotTrack =
        navigator.doNotTrack ??
        window.doNotTrack ??
        navigator.msDoNotTrack ??
        null;

    return (
        navigator.globalPrivacyControl === true ||
        doNotTrack === '1' ||
        doNotTrack === 'yes'
    );
}

function isLocalEnvironment() {
    return (
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1'
    );
}

export function initVisitorTransport() {
    if (!isLocalEnvironment()) {
        return;
    }

    // Respetar la preferencia de no seguimiento.
    // No generar identificadores ni enviar estadísticas.
    if (privacyOptOutRequested()) {
        return;
    }

    if (!document.querySelector('[data-visitor-analytics]')) {
        return;
    }

    if (
        typeof window.fetch !== 'function' ||
        typeof window.crypto?.randomUUID !== 'function'
    ) {
        return;
    }

    const sessionId = window.crypto.randomUUID();
    const handledEvents = new WeakSet();

    let lastReportedActiveMs = -1;
    let highestPendingActiveMs = -1;

    let sessionStarted = false;
    let sessionStartPromise = null;

    async function sendEvent(type, details = {}) {
        const payload = {
            type,
            sessionId,
            ...details
        };

        try {
            const response = await window.fetch(
                LOCAL_EVENTS_URL,
                {
                    method: 'POST',
                    mode: 'cors',
                    credentials: 'omit',
                    cache: 'no-store',
                    keepalive: true,
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                }
            );

            if (!response.ok) {
                console.warn(
                    'Estadísticas: evento no registrado.',
                    type,
                    response.status
                );

                return false;
            }

            return true;
        } catch {
            console.warn(
                'Estadísticas: no se pudo conectar con el Worker.',
                type
            );

            return false;
        }
    }

    function ensureSessionStarted() {
        if (sessionStarted) {
            return Promise.resolve(true);
        }

        if (!sessionStartPromise) {
            sessionStartPromise = sendEvent('session_start')
                .then((accepted) => {
                    if (accepted) {
                        sessionStarted = true;
                    }

                    return accepted;
                })
                .finally(() => {
                    sessionStartPromise = null;
                });
        }

        return sessionStartPromise;
    }

    function handleClick(event) {
        if (handledEvents.has(event)) {
            return;
        }

        handledEvents.add(event);

        const action = event.detail?.action;

        if (!ALLOWED_ACTIONS.has(action)) {
            return;
        }

        const eventId = window.crypto.randomUUID();

        void ensureSessionStarted().then((ready) => {
            if (!ready) {
                return;
            }

            return sendEvent('click', {
                eventId,
                action
            });
        });
    }

    function handleActivity(event) {
        if (handledEvents.has(event)) {
            return;
        }

        handledEvents.add(event);

        const reportedActiveMs = event.detail?.activeMs;

        if (
            typeof reportedActiveMs !== 'number' ||
            !Number.isFinite(reportedActiveMs) ||
            reportedActiveMs < 0
        ) {
            return;
        }

        const activeMs = Math.min(
            Math.floor(reportedActiveMs),
            MAX_ACTIVE_MS
        );

        if (
            activeMs <= lastReportedActiveMs ||
            activeMs <= highestPendingActiveMs
        ) {
            return;
        }

        highestPendingActiveMs = activeMs;

        void ensureSessionStarted()
            .then((ready) => {
                if (!ready) {
                    return false;
                }

                return sendEvent('session_activity', {
                    activeMs
                });
            })
            .then((accepted) => {
                if (accepted) {
                    lastReportedActiveMs = Math.max(
                        lastReportedActiveMs,
                        activeMs
                    );
                }
            }).finally(() => {
                if (highestPendingActiveMs === activeMs) {
                    highestPendingActiveMs = -1;
                }
            });
    }

    // Ambos destinos permiten escuchar los eventos
    // existentes sin cambiar sus emisores.
    // WeakSet evita procesar dos veces el mismo evento.
    document.addEventListener(
        CLICK_EVENT_NAME,
        handleClick
    );

    window.addEventListener(
        CLICK_EVENT_NAME,
        handleClick
    );

    document.addEventListener(
        ACTIVITY_EVENT_NAME,
        handleActivity
    );

    window.addEventListener(
        ACTIVITY_EVENT_NAME,
        handleActivity
    );

    // Una visita corresponde, por ahora,
    // a una carga de página con un UUID nuevo.
    void ensureSessionStarted();
}
