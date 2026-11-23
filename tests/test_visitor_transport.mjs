import assert from 'node:assert/strict';
import test from 'node:test';

const {
    ACCEPTED_EVENT_NAME,
    SITE_CONSENT_KEY,
    TAB_SESSION_KEY,
    createPseudonymousUuid,
    initVisitorTransport,
    privacyOptOutRequested,
    resolvePrivacyState,
    resolveTransportConfig
} = await import('../src/js/modules/visitor-transport.js');

class FakeTarget {
    constructor(location = undefined) {
        this.location = location;
        this.listeners = new Map();
        this.doNotTrack = null;
        this.focusCount = 0;
    }

    addEventListener(type, listener) {
        const listeners = this.listeners.get(type) ?? [];
        listeners.push(listener);
        this.listeners.set(type, listeners);
    }

    dispatch(type, detail = {}) {
        const event = Object.hasOwn(detail, 'key')
            ? {
                ...detail,
                defaultPrevented: false,
                preventDefault() {
                    this.defaultPrevented = true;
                }
            }
            : { detail };
        for (const listener of this.listeners.get(type) ?? []) {
            listener(event);
        }
        return event;
    }

    focus() {
        this.focusCount += 1;
    }

    dispatchEvent(event) {
        for (const listener of this.listeners.get(event.type) ?? []) {
            listener(event);
        }
        return true;
    }
}

class FakeStorage {
    constructor() {
        this.values = new Map();
    }

    getItem(key) {
        return this.values.get(key) ?? null;
    }

    setItem(key, value) {
        this.values.set(key, String(value));
    }

    removeItem(key) {
        this.values.delete(key);
    }
}

function createGrantedStorage() {
    const storage = new FakeStorage();
    storage.setItem(SITE_CONSENT_KEY, 'granted');
    return storage;
}

function createRuntime({
    origin = 'http://127.0.0.1:8000',
    fetchImplementation = async () => ({ ok: true, status: 200 }),
    navigatorObject = {},
    sessionStorageObject = createGrantedStorage(),
    cryptoObject: suppliedCryptoObject,
    panel = {}
} = {}) {
    const url = new URL(origin);
    let reloadCount = 0;
    const windowObject = new FakeTarget({
        hostname: url.hostname,
        origin: url.origin,
        href: url.href,
        reload() {
            reloadCount += 1;
        }
    });
    const documentObject = new FakeTarget();
    documentObject.body = { style: { overflow: '' } };
    documentObject.activeElement = null;
    const requests = [];
    let uuidCount = 0;

    windowObject.CustomEvent = class {
        constructor(type, options = {}) {
            this.type = type;
            this.detail = options.detail;
        }
    };

    documentObject.querySelector = (selector) => {
        if (selector === '[data-visitor-analytics]') return panel;
        return panel.querySelector?.(selector) ?? null;
    };
    windowObject.fetch = async (requestUrl, options) => {
        requests.push({
            url: requestUrl,
            options,
            payload: JSON.parse(options.body)
        });
        return fetchImplementation(requestUrl, options, requests.length);
    };

    const cryptoObject = suppliedCryptoObject ?? {
        randomUUID() {
            uuidCount += 1;
            return uuidCount === 1
                ? '11111111-1111-4111-8111-111111111111'
                : `22222222-2222-4222-8222-${String(uuidCount).padStart(12, '0')}`;
        }
    };

    return {
        windowObject,
        documentObject,
        navigatorObject,
        cryptoObject,
        sessionStorageObject,
        requests,
        reloadCount: () => reloadCount,
        uuidCount: () => uuidCount
    };
}

function createConsentPanel() {
    const container = new FakeTarget();
    container.hidden = true;
    container.dataset = {};
    let scrollCount = 0;
    container.scrollIntoView = () => {
        scrollCount += 1;
    };

    const message = { textContent: '' };
    const choices = { hidden: false };
    const allow = new FakeTarget();
    const deny = new FakeTarget();
    const revoke = new FakeTarget();
    revoke.hidden = true;
    const close = new FakeTarget();
    close.hidden = true;
    const preferences = new FakeTarget();
    preferences.hidden = true;
    const portfolioContent = { inert: false };
    const title = {
        focusCount: 0,
        focus() {
            this.focusCount += 1;
        }
    };

    const elements = new Map([
        ['[data-consent-message]', message],
        ['[data-consent-choices]', choices],
        ['[data-consent-allow]', allow],
        ['[data-consent-deny]', deny],
        ['[data-consent-revoke]', revoke],
        ['[data-consent-close]', close],
        ['#privacy-gate-title', title]
    ]);
    container.querySelector = (selector) =>
        elements.get(selector) ?? null;

    return {
        panel: {
            querySelector(selector) {
                if (selector === '[data-analytics-consent]') {
                    return container;
                }
                if (selector === '[data-analytics-preferences]') {
                    return preferences;
                }
                if (selector === '[data-portfolio-content]') {
                    return portfolioContent;
                }
                return null;
            }
        },
        container,
        message,
        choices,
        allow,
        deny,
        revoke,
        close,
        preferences,
        portfolioContent,
        title,
        scrollCount: () => scrollCount
    };
}

async function flushPromises() {
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
}

test('el transporte público está habilitado por defecto', () => {
    const config = resolveTransportConfig({
        hostname: 'david650991.github.io',
        origin: 'https://david650991.github.io'
    });

    assert.deepEqual(config, {
        enabled: true,
        environment: 'public',
        eventsUrl: 'https://cv-david-vidal-analytics.david650991.workers.dev/events'
    });
});

test('genera UUID v4 con Web Crypto aunque randomUUID no exista', () => {
    const uuid = createPseudonymousUuid({
        getRandomValues(bytes) {
            bytes.set(Array.from({ length: 16 }, (_, index) => index));
            return bytes;
        }
    });

    assert.equal(uuid, '00010203-0405-4607-8809-0a0b0c0d0e0f');
});

test('GitHub Pages inicia una sesión después de autorizar', async () => {
    const runtime = createRuntime({
        origin: 'https://david650991.github.io'
    });

    initVisitorTransport(runtime);
    await flushPromises();

    assert.equal(runtime.uuidCount(), 1);
    assert.equal(runtime.requests.length, 1);
    assert.equal(runtime.requests[0].payload.type, 'session_start');
    assert.equal(
        runtime.requests[0].url,
        'https://cv-david-vidal-analytics.david650991.workers.dev/events'
    );
});

test('una pestaña nueva no crea sesión antes de decidir', async () => {
    const controls = createConsentPanel();
    const runtime = createRuntime({
        sessionStorageObject: new FakeStorage(),
        panel: controls.panel
    });

    initVisitorTransport(runtime);
    await flushPromises();

    assert.equal(controls.container.hidden, false);
    assert.equal(controls.portfolioContent.inert, true);
    assert.equal(controls.title.focusCount, 1);
    assert.deepEqual(runtime.requests, []);
    assert.equal(runtime.uuidCount(), 0);
});

test('localhost conserva el Worker local para pruebas', async () => {
    const runtime = createRuntime();

    initVisitorTransport(runtime);
    await flushPromises();

    assert.equal(runtime.requests.length, 1);
    assert.equal(
        runtime.requests[0].url,
        'http://127.0.0.1:8787/events'
    );
    assert.equal(runtime.requests[0].payload.type, 'session_start');
});

test('DNT y GPC impiden identificadores y solicitudes', async () => {
    for (const navigatorObject of [
        { doNotTrack: '1' },
        { globalPrivacyControl: true }
    ]) {
        const storage = new FakeStorage();
        storage.setItem(TAB_SESSION_KEY, JSON.stringify({
            sessionId: '11111111-1111-4111-8111-111111111111',
            activeMs: 5000
        }));
        const runtime = createRuntime({
            navigatorObject,
            sessionStorageObject: storage
        });

        assert.equal(
            privacyOptOutRequested(
                runtime.navigatorObject,
                runtime.windowObject
            ),
            true
        );

        initVisitorTransport(runtime);
        await flushPromises();

        assert.equal(runtime.uuidCount(), 0);
        assert.deepEqual(runtime.requests, []);
        assert.equal(storage.getItem(TAB_SESSION_KEY), null);
    }
});

test('DNT y GPC se resuelven como señales distintas', () => {
    const storage = new FakeStorage();

    assert.equal(resolvePrivacyState(
        { doNotTrack: '1', globalPrivacyControl: false },
        {},
        storage
    ).reason, 'consent-pending');

    storage.setItem(SITE_CONSENT_KEY, 'granted');

    assert.equal(resolvePrivacyState(
        { doNotTrack: '1', globalPrivacyControl: false },
        {},
        storage
    ).reason, 'consent-granted');
    assert.equal(resolvePrivacyState(
        { doNotTrack: '1', globalPrivacyControl: true },
        {},
        storage
    ).reason, 'gpc');
});

test('DNT autorizado explícitamente permite iniciar la sesión', async () => {
    const storage = new FakeStorage();
    storage.setItem(SITE_CONSENT_KEY, 'granted');
    const runtime = createRuntime({
        navigatorObject: {
            doNotTrack: '1',
            globalPrivacyControl: false
        },
        sessionStorageObject: storage
    });

    initVisitorTransport(runtime);
    await flushPromises();

    assert.equal(runtime.requests.length, 1);
    assert.equal(runtime.requests[0].payload.type, 'session_start');
});

test('DNT rechazado conserva cero solicitudes', async () => {
    const storage = new FakeStorage();
    storage.setItem(SITE_CONSENT_KEY, 'denied');
    const runtime = createRuntime({
        navigatorObject: { doNotTrack: '1' },
        sessionStorageObject: storage
    });

    initVisitorTransport(runtime);
    await flushPromises();

    assert.deepEqual(runtime.requests, []);
    assert.equal(runtime.uuidCount(), 0);
});

test('la autorización voluntaria se guarda antes de iniciar medición', async () => {
    const controls = createConsentPanel();
    const storage = new FakeStorage();
    const navigatorObject = {
        doNotTrack: '1',
        globalPrivacyControl: false
    };
    const first = createRuntime({
        navigatorObject,
        sessionStorageObject: storage,
        panel: controls.panel
    });

    initVisitorTransport(first);
    await flushPromises();
    assert.deepEqual(first.requests, []);
    assert.equal(controls.container.hidden, false);

    controls.allow.dispatch('click');
    assert.equal(storage.getItem(SITE_CONSENT_KEY), 'granted');
    assert.equal(first.reloadCount(), 1);
    assert.deepEqual(first.requests, []);

    const second = createRuntime({
        navigatorObject,
        sessionStorageObject: storage,
        panel: createConsentPanel().panel
    });
    initVisitorTransport(second);
    await flushPromises();

    assert.equal(second.requests[0].payload.type, 'session_start');
});

test('el acceso visible reabre y enfoca las preferencias', async () => {
    const controls = createConsentPanel();
    const runtime = createRuntime({
        navigatorObject: { doNotTrack: '1' },
        panel: controls.panel
    });

    initVisitorTransport(runtime);
    await flushPromises();

    assert.equal(controls.preferences.hidden, false);
    assert.equal(controls.preferences.listeners.has('click'), true);
    controls.preferences.dispatch('click');
    assert.equal(controls.title.focusCount, 1);
    assert.equal(controls.container.hidden, false);
    assert.equal(controls.portfolioContent.inert, true);
    assert.equal(runtime.requests.length, 1);
});

test('cerrar preferencias conserva autorización, sesión y visita', async () => {
    const controls = createConsentPanel();
    const storage = createGrantedStorage();
    const runtime = createRuntime({
        sessionStorageObject: storage,
        panel: controls.panel
    });

    initVisitorTransport(runtime);
    await flushPromises();
    const storedSession = storage.getItem(TAB_SESSION_KEY);

    controls.preferences.dispatch('click');
    assert.equal(controls.close.hidden, false);
    assert.equal(controls.portfolioContent.inert, true);
    assert.equal(runtime.documentObject.body.style.overflow, 'hidden');

    controls.close.dispatch('click');

    assert.equal(storage.getItem(SITE_CONSENT_KEY), 'granted');
    assert.equal(storage.getItem(TAB_SESSION_KEY), storedSession);
    assert.equal(runtime.requests.length, 1);
    assert.equal(runtime.reloadCount(), 0);
    assert.equal(controls.container.hidden, true);
    assert.equal(controls.portfolioContent.inert, false);
    assert.equal(runtime.documentObject.body.style.overflow, '');
    assert.equal(controls.preferences.focusCount, 1);
});

test('Escape cierra solo preferencias reabiertas y devuelve el foco', async () => {
    const controls = createConsentPanel();
    const storage = createGrantedStorage();
    const runtime = createRuntime({
        sessionStorageObject: storage,
        panel: controls.panel
    });

    initVisitorTransport(runtime);
    await flushPromises();
    controls.preferences.dispatch('click');

    const escape = controls.container.dispatch('keydown', {
        key: 'Escape'
    });

    assert.equal(escape.defaultPrevented, true);
    assert.equal(controls.container.hidden, true);
    assert.equal(controls.portfolioContent.inert, false);
    assert.equal(controls.preferences.focusCount, 1);
    assert.equal(storage.getItem(SITE_CONSENT_KEY), 'granted');
    assert.equal(runtime.requests.length, 1);
});

test('Escape no omite la decisión inicial', async () => {
    const controls = createConsentPanel();
    const storage = new FakeStorage();
    const runtime = createRuntime({
        sessionStorageObject: storage,
        panel: controls.panel
    });

    initVisitorTransport(runtime);
    const escape = controls.container.dispatch('keydown', {
        key: 'Escape'
    });
    await flushPromises();

    assert.equal(escape.defaultPrevented, false);
    assert.equal(controls.container.hidden, false);
    assert.equal(controls.close.hidden, true);
    assert.equal(controls.portfolioContent.inert, true);
    assert.equal(storage.getItem(SITE_CONSENT_KEY), null);
    assert.deepEqual(runtime.requests, []);
});

test('el foco queda confinado en las preferencias abiertas', async () => {
    const controls = createConsentPanel();
    const runtime = createRuntime({ panel: controls.panel });

    initVisitorTransport(runtime);
    await flushPromises();
    controls.preferences.dispatch('click');

    runtime.documentObject.activeElement = controls.close;
    const forward = controls.container.dispatch('keydown', {
        key: 'Tab',
        shiftKey: false
    });
    assert.equal(forward.defaultPrevented, true);
    assert.equal(controls.revoke.focusCount, 1);

    runtime.documentObject.activeElement = controls.revoke;
    const backward = controls.container.dispatch('keydown', {
        key: 'Tab',
        shiftKey: true
    });
    assert.equal(backward.defaultPrevented, true);
    assert.equal(controls.close.focusCount, 1);
});

test('rechazar desde el panel no recarga ni genera una visita', async () => {
    const controls = createConsentPanel();
    const storage = new FakeStorage();
    const runtime = createRuntime({
        navigatorObject: { doNotTrack: '1' },
        sessionStorageObject: storage,
        panel: controls.panel
    });

    initVisitorTransport(runtime);
    controls.deny.dispatch('click');
    await flushPromises();

    assert.equal(storage.getItem(SITE_CONSENT_KEY), 'denied');
    assert.equal(runtime.reloadCount(), 0);
    assert.deepEqual(runtime.requests, []);
});

test('DNT permanece bloqueado si sessionStorage no admite la decisión', async () => {
    const controls = createConsentPanel();
    const blockedStorage = {
        getItem() { throw new Error('bloqueado'); },
        setItem() { throw new Error('bloqueado'); },
        removeItem() { throw new Error('bloqueado'); }
    };
    const runtime = createRuntime({
        navigatorObject: { doNotTrack: '1' },
        sessionStorageObject: blockedStorage,
        panel: controls.panel
    });

    initVisitorTransport(runtime);
    controls.allow.dispatch('click');
    await flushPromises();

    assert.deepEqual(runtime.requests, []);
    assert.equal(runtime.reloadCount(), 0);
    assert.match(
        controls.message.textContent,
        /bloqueó el almacenamiento temporal/
    );
});

test('revocar detiene eventos nuevos y limpia la sesión local', async () => {
    const controls = createConsentPanel();
    const storage = new FakeStorage();
    storage.setItem(SITE_CONSENT_KEY, 'granted');
    const runtime = createRuntime({
        navigatorObject: { doNotTrack: '1' },
        sessionStorageObject: storage,
        panel: controls.panel
    });

    initVisitorTransport(runtime);
    await flushPromises();
    assert.equal(runtime.requests.length, 1);

    // Reproduce el reporte final que visitor-session emite desde pagehide.
    runtime.windowObject.addEventListener('pagehide', () => {
        runtime.windowObject.dispatch('portfolio:session-activity', {
            activeMs: 5000
        });
    });

    controls.revoke.dispatch('click');
    assert.equal(storage.getItem(SITE_CONSENT_KEY), 'denied');
    assert.equal(storage.getItem(TAB_SESSION_KEY), null);
    assert.equal(runtime.reloadCount(), 1);

    runtime.windowObject.dispatch('portfolio:analytics', {
        action: 'cv_download_click'
    });
    runtime.windowObject.dispatch('pagehide');
    await flushPromises();

    assert.equal(runtime.requests.length, 1);
    assert.equal(storage.getItem(TAB_SESSION_KEY), null);
});

test('revocar durante una solicitud pendiente impide un Beacon posterior', async () => {
    let rejectClick;
    const pendingClick = new Promise((_resolve, reject) => {
        rejectClick = reject;
    });
    const controls = createConsentPanel();
    const storage = new FakeStorage();
    const beacons = [];
    storage.setItem(SITE_CONSENT_KEY, 'granted');
    const runtime = createRuntime({
        navigatorObject: {
            doNotTrack: '1',
            sendBeacon(_url, body) {
                beacons.push(JSON.parse(body));
                return true;
            }
        },
        sessionStorageObject: storage,
        panel: controls.panel,
        fetchImplementation: async (_url, _options, index) =>
            index === 2
                ? pendingClick
                : { ok: true, status: 200 }
    });

    initVisitorTransport(runtime);
    await flushPromises();
    runtime.windowObject.dispatch('portfolio:analytics', {
        action: 'cv_download_click'
    });
    await flushPromises();

    controls.revoke.dispatch('click');
    rejectClick(new TypeError('navegación interrumpida'));
    await flushPromises();

    assert.equal(storage.getItem(SITE_CONSENT_KEY), 'denied');
    assert.equal(beacons.length, 0);
});

test('una respuesta tardía de actividad no repone la sesión revocada', async () => {
    let confirmActivity;
    const pendingActivity = new Promise((resolve) => {
        confirmActivity = resolve;
    });
    const controls = createConsentPanel();
    const storage = new FakeStorage();
    storage.setItem(SITE_CONSENT_KEY, 'granted');
    const runtime = createRuntime({
        navigatorObject: { doNotTrack: '1' },
        sessionStorageObject: storage,
        panel: controls.panel,
        fetchImplementation: async (_url, _options, index) =>
            index === 2
                ? pendingActivity
                : { ok: true, status: 200 }
    });

    initVisitorTransport(runtime);
    await flushPromises();
    runtime.windowObject.dispatch('portfolio:session-activity', {
        activeMs: 5000
    });
    await flushPromises();
    assert.notEqual(storage.getItem(TAB_SESSION_KEY), null);

    controls.revoke.dispatch('click');
    assert.equal(storage.getItem(TAB_SESSION_KEY), null);
    confirmActivity({ ok: true, status: 200 });
    await flushPromises();

    assert.equal(storage.getItem(TAB_SESSION_KEY), null);
    assert.equal(runtime.requests.length, 2);
});

test('GPC bloquea incluso una autorización DNT previamente guardada', async () => {
    const storage = new FakeStorage();
    storage.setItem(SITE_CONSENT_KEY, 'granted');
    const runtime = createRuntime({
        navigatorObject: {
            doNotTrack: '1',
            globalPrivacyControl: true
        },
        sessionStorageObject: storage,
        panel: createConsentPanel().panel
    });

    initVisitorTransport(runtime);
    await flushPromises();

    assert.deepEqual(runtime.requests, []);
    assert.equal(runtime.uuidCount(), 0);
});

test('GPC permite entrar al CV pero nunca habilita la medición', async () => {
    const controls = createConsentPanel();
    const storage = new FakeStorage();
    const runtime = createRuntime({
        navigatorObject: { globalPrivacyControl: true },
        sessionStorageObject: storage,
        panel: controls.panel
    });

    initVisitorTransport(runtime);
    await flushPromises();

    assert.equal(controls.container.hidden, false);
    assert.equal(controls.allow.hidden, true);
    assert.equal(controls.portfolioContent.inert, true);
    assert.deepEqual(runtime.requests, []);

    controls.deny.dispatch('click');
    await flushPromises();

    assert.equal(storage.getItem(SITE_CONSENT_KEY), 'denied');
    assert.equal(controls.container.hidden, true);
    assert.equal(controls.portfolioContent.inert, false);
    assert.deepEqual(runtime.requests, []);
});

test('una recarga conserva la sesión aceptada de la pestaña', async () => {
    const storage = new FakeStorage();
    storage.setItem(SITE_CONSENT_KEY, 'granted');
    const first = createRuntime({ sessionStorageObject: storage });

    initVisitorTransport(first);
    await flushPromises();

    const second = createRuntime({ sessionStorageObject: storage });
    initVisitorTransport(second);
    await flushPromises();

    assert.equal(first.uuidCount(), 1);
    assert.equal(second.uuidCount(), 0);
    assert.equal(
        first.requests[0].payload.sessionId,
        second.requests[0].payload.sessionId
    );
});

test('una recarga autorizada con DNT reutiliza la misma sesión', async () => {
    const storage = new FakeStorage();
    storage.setItem(SITE_CONSENT_KEY, 'granted');
    const navigatorObject = { doNotTrack: '1' };
    const first = createRuntime({
        navigatorObject,
        sessionStorageObject: storage
    });
    initVisitorTransport(first);
    await flushPromises();

    const second = createRuntime({
        navigatorObject,
        sessionStorageObject: storage
    });
    initVisitorTransport(second);
    await flushPromises();

    assert.equal(second.uuidCount(), 0);
    assert.equal(
        second.requests[0].payload.sessionId,
        first.requests[0].payload.sessionId
    );
});

test('recargar sin autorización DNT nunca crea visitas', async () => {
    const storage = new FakeStorage();
    const navigatorObject = { doNotTrack: '1' };

    for (let load = 0; load < 2; load += 1) {
        const runtime = createRuntime({
            navigatorObject,
            sessionStorageObject: storage
        });
        initVisitorTransport(runtime);
        await flushPromises();
        assert.deepEqual(runtime.requests, []);
    }
});

test('parámetros UTM y procedencia externa no alteran el transporte', async () => {
    const runtime = createRuntime({
        origin: 'https://david650991.github.io/curriculum-david-vidal-ramirez/?utm_source=google&utm_medium=organic'
    });
    runtime.documentObject.referrer = 'https://www.google.com/';

    initVisitorTransport(runtime);
    await flushPromises();

    assert.equal(runtime.requests.length, 1);
    assert.equal(runtime.requests[0].payload.type, 'session_start');
});

test('el tiempo activo continúa de forma acumulada después de recargar', async () => {
    const storage = new FakeStorage();
    storage.setItem(SITE_CONSENT_KEY, 'granted');
    const first = createRuntime({ sessionStorageObject: storage });

    initVisitorTransport(first);
    await flushPromises();
    first.windowObject.dispatch('portfolio:session-activity', {
        activeMs: 5000
    });
    await flushPromises();

    const second = createRuntime({ sessionStorageObject: storage });
    initVisitorTransport(second);
    await flushPromises();
    second.windowObject.dispatch('portfolio:session-activity', {
        activeMs: 3000
    });
    await flushPromises();

    assert.equal(second.requests[1].payload.activeMs, 8000);
});

test('una recarga reconcilia actividad pendiente antes de sumar tiempo nuevo', async () => {
    let confirmOldActivity;
    const oldActivityResponse = new Promise((resolve) => {
        confirmOldActivity = resolve;
    });
    const storage = new FakeStorage();
    storage.setItem(SITE_CONSENT_KEY, 'granted');
    const first = createRuntime({
        sessionStorageObject: storage,
        fetchImplementation: async (_url, _options, index) =>
            index === 2
                ? oldActivityResponse
                : { ok: true, status: 200 }
    });

    initVisitorTransport(first);
    await flushPromises();
    first.windowObject.dispatch('portfolio:session-activity', {
        activeMs: 5000
    });
    await flushPromises();

    assert.deepEqual(
        JSON.parse(storage.getItem(TAB_SESSION_KEY)),
        {
            sessionId: '11111111-1111-4111-8111-111111111111',
            confirmedActiveMs: 0,
            pendingActiveMs: 5000
        }
    );

    const second = createRuntime({ sessionStorageObject: storage });
    initVisitorTransport(second);
    await flushPromises();

    assert.equal(second.requests[1].payload.type, 'session_activity');
    assert.equal(second.requests[1].payload.activeMs, 5000);

    second.windowObject.dispatch('portfolio:session-activity', {
        activeMs: 3000
    });
    await flushPromises();
    assert.equal(second.requests[2].payload.activeMs, 8000);

    confirmOldActivity({ ok: true, status: 200 });
    await flushPromises();

    const reconciled = JSON.parse(
        storage.getItem(TAB_SESSION_KEY)
    );
    assert.equal(reconciled.confirmedActiveMs, 8000);
    assert.equal(reconciled.pendingActiveMs, null);
});

test('un error de red final conserva solo actividad pendiente verificable', async () => {
    const storage = new FakeStorage();
    storage.setItem(SITE_CONSENT_KEY, 'granted');
    const beacons = [];
    const first = createRuntime({
        sessionStorageObject: storage,
        navigatorObject: {
            sendBeacon(_url, body) {
                beacons.push(JSON.parse(body));
                return true;
            }
        },
        fetchImplementation: async (_url, _options, index) => {
            if (index === 2) throw new TypeError('página cerrada');
            return { ok: true, status: 200 };
        }
    });

    initVisitorTransport(first);
    await flushPromises();
    first.windowObject.dispatch('portfolio:session-activity', {
        activeMs: 4000
    });
    await flushPromises();

    const pending = JSON.parse(storage.getItem(TAB_SESSION_KEY));
    assert.equal(pending.confirmedActiveMs, 0);
    assert.equal(pending.pendingActiveMs, 4000);
    assert.equal(beacons[0].activeMs, 4000);

    const second = createRuntime({ sessionStorageObject: storage });
    initVisitorTransport(second);
    await flushPromises();
    second.windowObject.dispatch('portfolio:session-activity', {
        activeMs: 2000
    });
    await flushPromises();

    assert.equal(second.requests[1].payload.activeMs, 4000);
    assert.equal(second.requests[2].payload.activeMs, 6000);
});

test('múltiples recargas conservan un acumulado exacto y creciente', async () => {
    const storage = new FakeStorage();
    storage.setItem(SITE_CONSENT_KEY, 'granted');
    const reportedTotals = [];

    for (let load = 0; load < 3; load += 1) {
        const runtime = createRuntime({
            sessionStorageObject: storage
        });
        initVisitorTransport(runtime);
        await flushPromises();
        runtime.windowObject.dispatch('portfolio:session-activity', {
            activeMs: 1000
        });
        await flushPromises();

        reportedTotals.push(
            runtime.requests.at(-1).payload.activeMs
        );
    }

    assert.deepEqual(reportedTotals, [1000, 2000, 3000]);
    const stored = JSON.parse(storage.getItem(TAB_SESSION_KEY));
    assert.equal(stored.confirmedActiveMs, 3000);
    assert.equal(stored.pendingActiveMs, null);
});

test('sessionStorage bloqueado permite continuar sin medición', async () => {
    const blockedStorage = {
        getItem() { throw new Error('bloqueado'); },
        setItem() { throw new Error('bloqueado'); },
        removeItem() { throw new Error('bloqueado'); }
    };
    const controls = createConsentPanel();
    const runtime = createRuntime({
        sessionStorageObject: blockedStorage,
        panel: controls.panel
    });

    initVisitorTransport(runtime);
    controls.deny.dispatch('click');
    await flushPromises();

    assert.deepEqual(runtime.requests, []);
    assert.equal(runtime.uuidCount(), 0);
    assert.equal(controls.container.hidden, true);
    assert.match(controls.preferences.textContent, /almacenamiento no disponible/);
});

test('un getter de sessionStorage bloqueado no activa medición', async () => {
    const controls = createConsentPanel();
    const runtime = createRuntime({ panel: controls.panel });
    delete runtime.sessionStorageObject;
    Object.defineProperty(runtime.windowObject, 'sessionStorage', {
        get() { throw new Error('bloqueado'); }
    });

    initVisitorTransport(runtime);
    controls.deny.dispatch('click');
    await flushPromises();

    assert.deepEqual(runtime.requests, []);
    assert.equal(controls.container.hidden, true);
});

test('solo un clic aceptado solicita actualizar el tablero', async () => {
    for (const accepted of [true, false]) {
        const runtime = createRuntime({
            fetchImplementation: async (_url, _options, index) => ({
                ok: index === 1 || accepted,
                status: index === 1 || accepted ? 200 : 503
            })
        });
        let refreshEvents = 0;
        runtime.windowObject.addEventListener(
            ACCEPTED_EVENT_NAME,
            () => { refreshEvents += 1; }
        );

        initVisitorTransport(runtime);
        await flushPromises();
        runtime.windowObject.dispatch('portfolio:analytics', {
            action: 'phone_click'
        });
        await flushPromises();

        assert.equal(refreshEvents, accepted ? 1 : 0);
    }
});

test('un error de red usa Beacon una vez sin simular aceptación', async () => {
    const beacons = [];
    const navigatorObject = {
        sendBeacon(url, body) {
            beacons.push({ url, body });
            return true;
        }
    };
    const runtime = createRuntime({
        navigatorObject,
        fetchImplementation: async () => {
            throw new TypeError('red no disponible');
        }
    });
    let acceptedEvents = 0;
    runtime.windowObject.addEventListener(
        ACCEPTED_EVENT_NAME,
        () => { acceptedEvents += 1; }
    );

    initVisitorTransport(runtime);
    await flushPromises();

    assert.equal(beacons.length, 1);
    assert.equal(
        JSON.parse(beacons[0].body).type,
        'session_start'
    );
    assert.equal(acceptedEvents, 0);
});

test('un rechazo HTTP no se reenvía mediante Beacon', async () => {
    let beacons = 0;
    const runtime = createRuntime({
        navigatorObject: {
            sendBeacon() {
                beacons += 1;
                return true;
            }
        },
        fetchImplementation: async () => ({ ok: false, status: 403 })
    });

    initVisitorTransport(runtime);
    await flushPromises();

    assert.equal(beacons, 0);
});

test('la simulación pública habilitada usa el endpoint remoto', async () => {
    const runtime = createRuntime({
        origin: 'https://david650991.github.io'
    });

    initVisitorTransport({
        ...runtime,
        publicRecordingEnabled: true
    });
    await flushPromises();

    runtime.windowObject.dispatch('portfolio:analytics', {
        action: 'cv_download_click'
    });
    await flushPromises();

    assert.deepEqual(
        runtime.requests.map((request) => request.payload.type),
        ['session_start', 'click']
    );
    assert.ok(runtime.requests.every((request) =>
        request.url ===
        'https://cv-david-vidal-analytics.david650991.workers.dev/events'
    ));
    assert.equal(
        runtime.requests[1].payload.sessionId,
        runtime.requests[0].payload.sessionId
    );
});

test('un clic espera la confirmación de session_start', async () => {
    let confirmSession;
    const sessionResponse = new Promise((resolve) => {
        confirmSession = resolve;
    });
    const runtime = createRuntime({
        fetchImplementation: async (_url, _options, index) =>
            index === 1
                ? sessionResponse
                : { ok: true, status: 200 }
    });

    initVisitorTransport(runtime);
    runtime.windowObject.dispatch('portfolio:analytics', {
        action: 'email_click'
    });
    await flushPromises();

    assert.equal(runtime.requests.length, 1);
    assert.equal(runtime.requests[0].payload.type, 'session_start');

    confirmSession({ ok: true, status: 200 });
    await flushPromises();

    assert.equal(runtime.requests.length, 2);
    assert.equal(runtime.requests[1].payload.type, 'click');
});

test('un inicio fallido puede reintentarse sin aceptar el clic anterior', async () => {
    const runtime = createRuntime({
        fetchImplementation: async (_url, _options, index) => ({
            ok: index !== 1,
            status: index === 1 ? 503 : 200
        })
    });

    initVisitorTransport(runtime);
    await flushPromises();
    assert.equal(runtime.requests.length, 1);

    runtime.windowObject.dispatch('portfolio:analytics', {
        action: 'project_link_click'
    });
    await flushPromises();

    assert.deepEqual(
        runtime.requests.map((request) => request.payload.type),
        ['session_start', 'session_start', 'click']
    );
});

test('el mismo evento del navegador se procesa una sola vez', async () => {
    const runtime = createRuntime();

    initVisitorTransport(runtime);
    await flushPromises();

    const event = runtime.windowObject.dispatch(
        'portfolio:analytics',
        { action: 'navigation_click' }
    );
    for (
        const listener of
        runtime.documentObject.listeners.get('portfolio:analytics') ?? []
    ) {
        listener(event);
    }
    await flushPromises();

    assert.deepEqual(
        runtime.requests.map((request) => request.payload.type),
        ['session_start', 'click']
    );
});

test('el tiempo activo solo envía valores acumulados crecientes', async () => {
    const runtime = createRuntime();

    initVisitorTransport(runtime);
    await flushPromises();

    runtime.windowObject.dispatch('portfolio:session-activity', {
        activeMs: 5000
    });
    await flushPromises();
    runtime.windowObject.dispatch('portfolio:session-activity', {
        activeMs: 5000
    });
    runtime.windowObject.dispatch('portfolio:session-activity', {
        activeMs: 4000
    });
    await flushPromises();
    runtime.windowObject.dispatch('portfolio:session-activity', {
        activeMs: 7000
    });
    await flushPromises();

    assert.deepEqual(
        runtime.requests.map((request) => ({
            type: request.payload.type,
            activeMs: request.payload.activeMs ?? null
        })),
        [
            { type: 'session_start', activeMs: null },
            { type: 'session_activity', activeMs: 5000 },
            { type: 'session_activity', activeMs: 7000 }
        ]
    );
});
