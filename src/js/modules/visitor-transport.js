
/**
 * Transporte de estadísticas del currículum.
 * Autor: David Vidal Ramírez
 *
 * Conecta los eventos existentes del navegador
 * con Cloudflare Workers y D1.
 *
 * La sesión aceptada se conserva únicamente en sessionStorage
 * para que una recarga de la misma pestaña no cree otra visita.
 * No utiliza cookies ni localStorage.
 */

const LOCAL_EVENTS_URL = 'http://127.0.0.1:8787/events';
const PUBLIC_EVENTS_URL =
    'https://cv-david-vidal-analytics.david650991.workers.dev/events';

// Barrera explícita del frontend. Debe mantenerse coordinada con
// el Worker y siempre respetar DNT y Global Privacy Control.
const PUBLIC_RECORDING_ENABLED = true;
const PUBLIC_ORIGIN = 'https://david650991.github.io';

const CLICK_EVENT_NAME = 'portfolio:analytics';
const ACTIVITY_EVENT_NAME = 'portfolio:session-activity';
export const ACCEPTED_EVENT_NAME = 'portfolio:analytics-accepted';
export const TAB_SESSION_KEY = 'portfolio:analytics:tab-session:v1';

const ALLOWED_ACTIONS = new Set([
    'cv_download_click',
    'whatsapp_click',
    'email_click',
    'project_link_click',
    'phone_click',
    'navigation_click'
]);

const MAX_ACTIVE_MS = 86_400_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function readTabSession(storageObject) {
    if (!storageObject) return null;

    try {
        const stored = JSON.parse(
            storageObject.getItem(TAB_SESSION_KEY)
        );

        if (
            !stored ||
            !UUID_PATTERN.test(stored.sessionId) ||
            !Number.isSafeInteger(stored.activeMs) ||
            stored.activeMs < 0 ||
            stored.activeMs > MAX_ACTIVE_MS
        ) {
            return null;
        }

        return stored;
    } catch {
        return null;
    }
}

function writeTabSession(storageObject, sessionId, activeMs) {
    if (!storageObject) return;

    try {
        storageObject.setItem(TAB_SESSION_KEY, JSON.stringify({
            sessionId,
            activeMs
        }));
    } catch {
        // El transporte sigue funcionando en memoria si el navegador
        // bloquea sessionStorage.
    }
}

function clearTabSession(storageObject) {
    if (!storageObject) return;

    try {
        storageObject.removeItem(TAB_SESSION_KEY);
    } catch {
        // No se fuerza ningún acceso si el almacenamiento está bloqueado.
    }
}

function resolveSessionStorage(windowObject, suppliedStorage) {
    if (suppliedStorage !== undefined) return suppliedStorage;

    try {
        return windowObject.sessionStorage ?? null;
    } catch {
        return null;
    }
}

/**
 * Detecta preferencias de privacidad del navegador.
 * Autor: David Vidal Ramírez
 *
 * Se respetan DNT y Global Privacy Control.
 * No se almacenan estas preferencias.
 */
export function privacyOptOutRequested(
    navigatorObject = navigator,
    windowObject = window
) {
    const doNotTrack =
        navigatorObject.doNotTrack ??
        windowObject.doNotTrack ??
        navigatorObject.msDoNotTrack ??
        null;

    return (
        navigatorObject.globalPrivacyControl === true ||
        doNotTrack === '1' ||
        doNotTrack === 'yes'
    );
}

export function resolveTransportConfig(
    locationObject,
    publicRecordingEnabled = PUBLIC_RECORDING_ENABLED
) {
    const hostname = locationObject?.hostname || '';

    if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1'
    ) {
        return {
            enabled: true,
            environment: 'local',
            eventsUrl: LOCAL_EVENTS_URL
        };
    }

    if (locationObject?.origin === PUBLIC_ORIGIN) {
        return {
            enabled: publicRecordingEnabled === true,
            environment: 'public',
            eventsUrl: PUBLIC_EVENTS_URL
        };
    }

    return {
        enabled: false,
        environment: 'unsupported',
        eventsUrl: null
    };
}

export function initVisitorTransport(options = {}) {
    const windowObject = options.windowObject ?? window;
    const documentObject = options.documentObject ?? document;
    const navigatorObject = options.navigatorObject ?? navigator;
    const cryptoObject = options.cryptoObject ?? windowObject.crypto;
    const storageObject = resolveSessionStorage(
        windowObject,
        options.sessionStorageObject
    );
    const transport = resolveTransportConfig(
        windowObject.location,
        options.publicRecordingEnabled ?? PUBLIC_RECORDING_ENABLED
    );

    if (!transport.enabled || !transport.eventsUrl) {
        return;
    }

    // Respetar la preferencia de no seguimiento.
    // No generar identificadores ni enviar estadísticas.
    if (privacyOptOutRequested(navigatorObject, windowObject)) {
        clearTabSession(storageObject);
        return;
    }

    if (!documentObject.querySelector('[data-visitor-analytics]')) {
        return;
    }

    if (
        typeof windowObject.fetch !== 'function' ||
        typeof cryptoObject?.randomUUID !== 'function'
    ) {
        return;
    }

    const storedSession = readTabSession(storageObject);
    const sessionId = storedSession?.sessionId ??
        cryptoObject.randomUUID();
    const sessionActiveBaseMs = storedSession?.activeMs ?? 0;
    const handledEvents = new WeakSet();

    let lastReportedActiveMs = sessionActiveBaseMs;
    let highestPendingActiveMs = sessionActiveBaseMs;

    let sessionStarted = false;
    let sessionStartPromise = null;

    async function sendEvent(type, details = {}) {
        const payload = {
            type,
            sessionId,
            ...details
        };

        try {
            const response = await windowObject.fetch(
                transport.eventsUrl,
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
                        writeTabSession(
                            storageObject,
                            sessionId,
                            lastReportedActiveMs
                        );
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

        const eventId = cryptoObject.randomUUID();

        void ensureSessionStarted().then((ready) => {
            if (!ready) {
                return;
            }

            return sendEvent('click', {
                eventId,
                action
            }).then((accepted) => {
                const EventConstructor =
                    windowObject.CustomEvent ??
                    globalThis.CustomEvent;

                if (
                    accepted &&
                    typeof windowObject.dispatchEvent === 'function' &&
                    typeof EventConstructor === 'function'
                ) {
                    windowObject.dispatchEvent(
                        new EventConstructor(ACCEPTED_EVENT_NAME, {
                            detail: {
                                type: 'click',
                                action
                            }
                        })
                    );
                }

                return accepted;
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
            sessionActiveBaseMs + Math.floor(reportedActiveMs),
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
                    writeTabSession(
                        storageObject,
                        sessionId,
                        lastReportedActiveMs
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
    documentObject.addEventListener(
        CLICK_EVENT_NAME,
        handleClick
    );

    windowObject.addEventListener(
        CLICK_EVENT_NAME,
        handleClick
    );

    documentObject.addEventListener(
        ACTIVITY_EVENT_NAME,
        handleActivity
    );

    windowObject.addEventListener(
        ACTIVITY_EVENT_NAME,
        handleActivity
    );

    // El Worker confirma la sesión antes de conservarla en la pestaña.
    // Una recarga reenvía el mismo UUID de forma idempotente.
    void ensureSessionStarted();
}
