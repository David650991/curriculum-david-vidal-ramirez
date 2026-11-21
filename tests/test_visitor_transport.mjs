import assert from 'node:assert/strict';
import test from 'node:test';

const {
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
}

function createRuntime({
    origin = 'http://127.0.0.1:8000',
    fetchImplementation = async () => ({ ok: true, status: 200 }),
    navigatorObject = {}
} = {}) {
    const url = new URL(origin);
    const windowObject = new FakeTarget({
        hostname: url.hostname,
        origin: url.origin
    });
    const documentObject = new FakeTarget();
    const requests = [];
    let uuidCount = 0;

    documentObject.querySelector = () => ({});
    windowObject.fetch = async (requestUrl, options) => {
        requests.push({
            url: requestUrl,
            options,
            payload: JSON.parse(options.body)
        });
        return fetchImplementation(requestUrl, options, requests.length);
    };

    const cryptoObject = {
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
        requests,
        uuidCount: () => uuidCount
    };
}

async function flushPromises() {
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
}

test('el transporte público permanece deshabilitado por defecto', () => {
    const config = resolveTransportConfig({
        hostname: 'david650991.github.io',
        origin: 'https://david650991.github.io'
    });

    assert.deepEqual(config, {
        enabled: false,
        environment: 'public',
        eventsUrl: 'https://cv-david-vidal-analytics.david650991.workers.dev/events'
    });
});

test('GitHub Pages no genera UUID ni POST mientras está deshabilitado', async () => {
    const runtime = createRuntime({
        origin: 'https://david650991.github.io'
    });

    initVisitorTransport(runtime);
    await flushPromises();

    assert.equal(runtime.uuidCount(), 0);
    assert.deepEqual(runtime.requests, []);
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
        const runtime = createRuntime({ navigatorObject });

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
