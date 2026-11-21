import assert from 'node:assert/strict';
import test from 'node:test';

const {
    ACCEPTED_EVENT_NAME,
    TAB_SESSION_KEY,
    initVisitorTransport,
    privacyOptOutRequested,
    resolveTransportConfig
} = await import('../src/js/modules/visitor-transport.js');

class FakeTarget {
    constructor(location = undefined) {
        this.location = location;
        this.listeners = new Map();
        this.doNotTrack = null;
    }

    addEventListener(type, listener) {
        const listeners = this.listeners.get(type) ?? [];
        listeners.push(listener);
        this.listeners.set(type, listeners);
    }

    dispatch(type, detail = {}) {
        const event = { detail };
        for (const listener of this.listeners.get(type) ?? []) {
            listener(event);
        }
        return event;
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

function createRuntime({
    origin = 'http://127.0.0.1:8000',
    fetchImplementation = async () => ({ ok: true, status: 200 }),
    navigatorObject = {},
    sessionStorageObject = new FakeStorage(),
    cryptoObject: suppliedCryptoObject
} = {}) {
    const url = new URL(origin);
    const windowObject = new FakeTarget({
        hostname: url.hostname,
        origin: url.origin
    });
    const documentObject = new FakeTarget();
    const requests = [];
    let uuidCount = 0;

    windowObject.CustomEvent = class {
        constructor(type, options = {}) {
            this.type = type;
            this.detail = options.detail;
        }
    };

    documentObject.querySelector = () => ({});
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
        uuidCount: () => uuidCount
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

test('GitHub Pages inicia una sesión cuando no hay exclusión de privacidad', async () => {
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

test('una recarga conserva la sesión aceptada de la pestaña', async () => {
    const storage = new FakeStorage();
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

test('el tiempo activo continúa de forma acumulada después de recargar', async () => {
    const storage = new FakeStorage();
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

test('sessionStorage bloqueado conserva un transporte funcional en memoria', async () => {
    const blockedStorage = {
        getItem() { throw new Error('bloqueado'); },
        setItem() { throw new Error('bloqueado'); },
        removeItem() { throw new Error('bloqueado'); }
    };
    const runtime = createRuntime({
        sessionStorageObject: blockedStorage
    });

    initVisitorTransport(runtime);
    await flushPromises();

    assert.equal(runtime.requests[0].payload.type, 'session_start');
    assert.equal(runtime.uuidCount(), 1);
});

test('un getter de sessionStorage bloqueado no interrumpe la sesión', async () => {
    const runtime = createRuntime();
    delete runtime.sessionStorageObject;
    Object.defineProperty(runtime.windowObject, 'sessionStorage', {
        get() { throw new Error('bloqueado'); }
    });

    initVisitorTransport(runtime);
    await flushPromises();

    assert.equal(runtime.requests[0].payload.type, 'session_start');
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
