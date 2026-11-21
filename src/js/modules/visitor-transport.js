
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

export function createPseudonymousUuid(cryptoObject) {
    if (typeof cryptoObject?.randomUUID === 'function') {
        return cryptoObject.randomUUID();
    }

    if (typeof cryptoObject?.getRandomValues !== 'function') {
        return null;
    }

    const bytes = new Uint8Array(16);
    cryptoObject.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const value = Array.from(
        bytes,
        (byte) => byte.toString(16).padStart(2, '0')
    ).join('');

    return [
        value.slice(0, 8),
        value.slice(8, 12),
        value.slice(12, 16),
        value.slice(16, 20),
        value.slice(20)
    ].join('-');
}

export function readTabSession(storageObject) {
    if (!storageObject) return null;

    try {
        const stored = JSON.parse(
            storageObject.getItem(TAB_SESSION_KEY)
        );

        const confirmedActiveMs =
            stored?.confirmedActiveMs ?? stored?.activeMs;
        const pendingActiveMs =
            stored?.pendingActiveMs ?? null;

        if (
            !stored ||
            !UUID_PATTERN.test(stored.sessionId) ||
            !Number.isSafeInteger(confirmedActiveMs) ||
            confirmedActiveMs < 0 ||
            confirmedActiveMs > MAX_ACTIVE_MS ||
            (
                pendingActiveMs !== null &&
                (
                    !Number.isSafeInteger(pendingActiveMs) ||
                    pendingActiveMs < confirmedActiveMs ||
                    pendingActiveMs > MAX_ACTIVE_MS
                )
            )
        ) {
            return null;
        }

        return {
            sessionId: stored.sessionId,
            confirmedActiveMs,
            pendingActiveMs
        };
    } catch {
        return null;
    }
}

function writeTabSession(storageObject, sessionState) {
    if (!storageObject) return sessionState;

    try {
        const stored = readTabSession(storageObject);
        const sameSession = stored?.sessionId ===
            sessionState.sessionId;
        const confirmedActiveMs = Math.max(
            sessionState.confirmedActiveMs,
            sameSession ? stored.confirmedActiveMs : 0
        );
        const pendingCandidates = [
            sessionState.pendingActiveMs,
            sameSession ? stored.pendingActiveMs : null
        ].filter((value) => value !== null);
        const highestPending = pendingCandidates.length
            ? Math.max(...pendingCandidates)
            : null;
        const pendingActiveMs =
            highestPending !== null &&
            highestPending > confirmedActiveMs
                ? highestPending
                : null;
        const reconciled = {
            sessionId: sessionState.sessionId,
            confirmedActiveMs,
            pendingActiveMs
        };

        storageObject.setItem(
            TAB_SESSION_KEY,
            JSON.stringify(reconciled)
        );

        return reconciled;
    } catch {
        // El transporte sigue funcionando en memoria si el navegador
        // bloquea sessionStorage.
        return sessionState;
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

    if (typeof windowObject.fetch !== 'function') {
        return;
    }

    const storedSession = readTabSession(storageObject);
    const sessionId = storedSession?.sessionId ??
        createPseudonymousUuid(cryptoObject);

    if (!sessionId) return;

    let confirmedActiveMs =
        storedSession?.confirmedActiveMs ?? 0;
    let pendingActiveMs =
        storedSession?.pendingActiveMs ?? null;
    const previousPendingActiveMs = pendingActiveMs;
    let pageBaseActiveMs = confirmedActiveMs;
    const handledEvents = new WeakSet();

    let highestPendingActiveMs =
        pendingActiveMs ?? confirmedActiveMs;

    let sessionStarted = false;
    let sessionStartPromise = null;
    let activityReconciliationPromise = null;
    let previousActivityReconciled =
        previousPendingActiveMs === null;

    function persistActivityState() {
        const reconciled = writeTabSession(storageObject, {
            sessionId,
            confirmedActiveMs,
            pendingActiveMs
        });

        confirmedActiveMs = Math.max(
            confirmedActiveMs,
            reconciled.confirmedActiveMs
        );
        pendingActiveMs = reconciled.pendingActiveMs;
    }

    function queueBeacon(payloadText) {
        if (typeof navigatorObject.sendBeacon !== 'function') {
            return false;
        }

        try {
            return navigatorObject.sendBeacon(
                transport.eventsUrl,
                payloadText
            );
        } catch {
            return false;
        }
    }

    function dispatchAcceptedClick(action) {
        const detail = { type: 'click', action };
        const EventConstructor =
            windowObject.CustomEvent ?? globalThis.CustomEvent;
        let event = null;

        if (typeof EventConstructor === 'function') {
            event = new EventConstructor(
                ACCEPTED_EVENT_NAME,
                { detail }
            );
        } else if (typeof documentObject.createEvent === 'function') {
            event = documentObject.createEvent('CustomEvent');
            event.initCustomEvent(
                ACCEPTED_EVENT_NAME,
                false,
                false,
                detail
            );
        }

        if (
            event &&
            typeof windowObject.dispatchEvent === 'function'
        ) {
            windowObject.dispatchEvent(event);
        }
    }

    async function sendEvent(type, details = {}) {
        const payload = {
            type,
            sessionId,
            ...details
        };

        const payloadText = JSON.stringify(payload);

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
                    body: payloadText
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
            const queued = queueBeacon(payloadText);

            console.warn(
                queued
                    ? 'Estadísticas: envío alternativo encolado sin confirmación.'
                    : 'Estadísticas: no se pudo conectar con el Worker.',
                type
            );

            // Beacon no ofrece respuesta del servidor: no se presenta
            // el evento como aceptado ni se actualiza el tablero.
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
                        persistActivityState();
                    }

                    return accepted;
                })
                .finally(() => {
                    sessionStartPromise = null;
                });
        }

        return sessionStartPromise;
    }

    function reconcilePreviousActivity() {
        if (previousActivityReconciled) {
            return Promise.resolve(true);
        }

        if (!activityReconciliationPromise) {
            activityReconciliationPromise = ensureSessionStarted()
                .then((ready) => {
                    if (!ready) return false;

                    return sendEvent('session_activity', {
                        activeMs: previousPendingActiveMs
                    });
                })
                .then((accepted) => {
                    if (!accepted) return false;

                    confirmedActiveMs = Math.max(
                        confirmedActiveMs,
                        previousPendingActiveMs
                    );

                    if (
                        pendingActiveMs !== null &&
                        pendingActiveMs <= confirmedActiveMs
                    ) {
                        pendingActiveMs = null;
                    }

                    persistActivityState();
                    pageBaseActiveMs = confirmedActiveMs;
                    previousActivityReconciled = true;
                    return true;
                })
                .finally(() => {
                    activityReconciliationPromise = null;
                });
        }

        return activityReconciliationPromise;
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

        const eventId = createPseudonymousUuid(cryptoObject);
        if (!eventId) return;

        void ensureSessionStarted().then((ready) => {
            if (!ready) {
                return;
            }

            return sendEvent('click', {
                eventId,
                action
            }).then((accepted) => {
                if (accepted) dispatchAcceptedClick(action);

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

        const pageActiveMs = Math.floor(reportedActiveMs);

        void reconcilePreviousActivity()
            .then((reconciled) => {
                if (!reconciled) return false;

                const activeMs = Math.min(
                    pageBaseActiveMs + pageActiveMs,
                    MAX_ACTIVE_MS
                );

                if (
                    activeMs <= confirmedActiveMs ||
                    activeMs <= highestPendingActiveMs
                ) {
                    return false;
                }

                highestPendingActiveMs = activeMs;
                pendingActiveMs = Math.max(
                    pendingActiveMs ?? 0,
                    activeMs
                );
                persistActivityState();

                return ensureSessionStarted().then((ready) => {
                    if (!ready) {
                        return { accepted: false, activeMs };
                    }

                    return sendEvent('session_activity', {
                        activeMs
                    }).then((accepted) => ({
                        accepted,
                        activeMs
                    }));
                });
            })
            .then((result) => {
                if (!result || !result.accepted) return;

                confirmedActiveMs = Math.max(
                    confirmedActiveMs,
                    result.activeMs
                );

                if (
                    pendingActiveMs !== null &&
                    pendingActiveMs <= confirmedActiveMs
                ) {
                    pendingActiveMs = null;
                }

                persistActivityState();
            }).finally(() => {
                highestPendingActiveMs = Math.max(
                    confirmedActiveMs,
                    pendingActiveMs ?? 0
                );
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
    void ensureSessionStarted().then((ready) => {
        if (ready) void reconcilePreviousActivity();
    });
}
