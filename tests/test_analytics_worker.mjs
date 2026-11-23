import assert from 'node:assert/strict';
import test from 'node:test';

const {
    buildRateLimitKeys,
    default: worker
} = await import('../infra/cloudflare/analytics-worker.js');

const ALLOWED_ORIGIN = 'https://david650991.github.io';
const SESSION_ID = '11111111-1111-4111-8111-111111111111';

function createRequest(body, options = {}) {
    const request = new Request(
        'https://worker.example/events',
        {
            method: 'POST',
            headers: {
                Origin: options.origin ?? ALLOWED_ORIGIN,
                'Content-Type': options.contentType ?? 'application/json'
            },
            body: typeof body === 'string'
                ? body
                : JSON.stringify(body)
        }
    );

    Object.defineProperty(request, 'cf', {
        value: { colo: options.colo ?? 'MEX' }
    });

    return request;
}

function createEnvironment({
    recording = 'habilitada',
    rateLimitResults = [],
    database = undefined
} = {}) {
    const limiterKeys = [];
    const databaseCalls = [];

    const defaultDatabase = {
        prepare(sql) {
            databaseCalls.push(sql);
            return {
                bind() {
                    return {
                        async run() {
                            return { success: true };
                        }
                    };
                }
            };
        }
    };

    return {
        env: {
            ANALYTICAS_ESCRITURA: recording,
            DB: database ?? defaultDatabase,
            EVENT_RATE_LIMITER: {
                async limit({ key }) {
                    limiterKeys.push(key);
                    return rateLimitResults.shift() ?? { success: true };
                }
            }
        },
        limiterKeys,
        databaseCalls
    };
}

async function responseJson(response) {
    return {
        status: response.status,
        body: await response.json()
    };
}

function createGetRequest(path) {
    return new Request(`https://worker.example${path}`, {
        headers: {
            Origin: ALLOWED_ORIGIN
        }
    });
}

function createHealthDatabase(total = 0) {
    return {
        prepare() {
            return {
                async first() {
                    return { total };
                }
            };
        }
    };
}

test('los GET reflejan la escritura habilitada y D1 disponible', async () => {
    const runtime = createEnvironment({
        recording: 'habilitada',
        database: createHealthDatabase(7)
    });
    const root = await responseJson(await worker.fetch(
        createGetRequest('/'),
        runtime.env
    ));
    const health = await responseJson(await worker.fetch(
        createGetRequest('/health'),
        runtime.env
    ));
    const database = await responseJson(await worker.fetch(
        createGetRequest('/db-health'),
        runtime.env
    ));

    assert.deepEqual(root, {
        status: 200,
        body: {
            service: 'cv-david-vidal-analytics',
            status: 'activo',
            recording: true
        }
    });
    assert.equal(health.status, 200);
    assert.equal(health.body.recording, true);
    assert.deepEqual(database, {
        status: 200,
        body: {
            ok: true,
            databaseConnected: true,
            sessions: 7,
            recording: true
        }
    });
});

test('CORS autoriza el POST JSON usado por fetch', async () => {
    const response = await worker.fetch(
        new Request('https://worker.example/events', {
            method: 'OPTIONS',
            headers: {
                Origin: ALLOWED_ORIGIN,
                'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'content-type'
            }
        }),
        createEnvironment().env
    );

    assert.equal(response.status, 204);
    assert.equal(
        response.headers.get('Access-Control-Allow-Origin'),
        ALLOWED_ORIGIN
    );
    assert.match(
        response.headers.get('Access-Control-Allow-Methods'),
        /POST/
    );
    assert.match(
        response.headers.get('Access-Control-Allow-Headers'),
        /Content-Type/i
    );
});

test('Beacon admite JSON como texto simple sin relajar su validación', async () => {
    const runtime = createEnvironment();
    const result = await responseJson(await worker.fetch(
        createRequest({
            type: 'session_start',
            sessionId: SESSION_ID
        }, {
            contentType: 'text/plain;charset=UTF-8'
        }),
        runtime.env
    ));

    assert.equal(result.status, 200);
    assert.equal(result.body.type, 'session_start');
    assert.equal(runtime.databaseCalls.length, 1);
});

test('el Worker sigue rechazando tipos de contenido ajenos', async () => {
    const runtime = createEnvironment();
    const result = await responseJson(await worker.fetch(
        createRequest('type=session_start', {
            contentType: 'application/x-www-form-urlencoded'
        }),
        runtime.env
    ));

    assert.equal(result.status, 415);
    assert.equal(result.body.error, 'contenido_no_admitido');
    assert.deepEqual(runtime.databaseCalls, []);
});

test('los GET reflejan la escritura deshabilitada sin ocultar D1', async () => {
    const runtime = createEnvironment({
        recording: 'deshabilitada',
        database: createHealthDatabase(3)
    });
    const root = await responseJson(await worker.fetch(
        createGetRequest('/'),
        runtime.env
    ));
    const health = await responseJson(await worker.fetch(
        createGetRequest('/health'),
        runtime.env
    ));
    const database = await responseJson(await worker.fetch(
        createGetRequest('/db-health'),
        runtime.env
    ));

    assert.equal(root.status, 200);
    assert.equal(root.body.status, 'preparacion');
    assert.equal(root.body.recording, false);
    assert.equal(health.status, 200);
    assert.equal(health.body.recording, false);
    assert.equal(database.status, 200);
    assert.equal(database.body.databaseConnected, true);
    assert.equal(database.body.sessions, 3);
    assert.equal(database.body.recording, false);
});

test('db-health separa escritura habilitada de D1 no disponible', async () => {
    const runtime = createEnvironment({
        recording: 'habilitada'
    });
    runtime.env.DB = undefined;

    const database = await responseJson(await worker.fetch(
        createGetRequest('/db-health'),
        runtime.env
    ));

    assert.deepEqual(database, {
        status: 503,
        body: {
            ok: false,
            databaseConnected: false,
            recording: true
        }
    });
});

test('las claves separan centro de datos, inicios y sesiones', () => {
    const request = createRequest({});

    assert.deepEqual(
        buildRateLimitKeys(request, 'session_start', SESSION_ID),
        {
            edge: 'events:edge:MEX',
            subject: 'events:start:MEX'
        }
    );
    assert.deepEqual(
        buildRateLimitKeys(request, 'click', SESSION_ID),
        {
            edge: 'events:edge:MEX',
            subject: `events:session:${SESSION_ID}`
        }
    );
});

test('la escritura deshabilitada bloquea antes del limitador y D1', async () => {
    const runtime = createEnvironment({
        recording: 'deshabilitada'
    });
    const result = await responseJson(await worker.fetch(
        createRequest({
            type: 'session_start',
            sessionId: SESSION_ID
        }),
        runtime.env
    ));

    assert.equal(result.status, 503);
    assert.equal(result.body.error, 'registro_no_habilitado');
    assert.deepEqual(runtime.limiterKeys, []);
    assert.deepEqual(runtime.databaseCalls, []);
});

test('un origen no autorizado no alcanza limitador ni D1', async () => {
    const runtime = createEnvironment();
    const result = await responseJson(await worker.fetch(
        createRequest(
            { type: 'session_start', sessionId: SESSION_ID },
            { origin: 'https://example.invalid' }
        ),
        runtime.env
    ));

    assert.equal(result.status, 403);
    assert.equal(result.body.error, 'origen_no_permitido');
    assert.deepEqual(runtime.limiterKeys, []);
    assert.deepEqual(runtime.databaseCalls, []);
});

test('el límite preliminar rechaza sin escribir en D1', async () => {
    const runtime = createEnvironment({
        rateLimitResults: [{ success: false }]
    });
    const result = await responseJson(await worker.fetch(
        createRequest({
            type: 'session_start',
            sessionId: SESSION_ID
        }),
        runtime.env
    ));

    assert.equal(result.status, 429);
    assert.equal(result.body.error, 'demasiadas_solicitudes');
    assert.deepEqual(runtime.limiterKeys, ['events:edge:MEX']);
    assert.deepEqual(runtime.databaseCalls, []);
});

test('el límite de inicio se aplica después de validar el cuerpo', async () => {
    const runtime = createEnvironment({
        rateLimitResults: [
            { success: true },
            { success: false }
        ]
    });
    const result = await responseJson(await worker.fetch(
        createRequest({
            type: 'session_start',
            sessionId: SESSION_ID
        }),
        runtime.env
    ));

    assert.equal(result.status, 429);
    assert.deepEqual(runtime.limiterKeys, [
        'events:edge:MEX',
        'events:start:MEX'
    ]);
    assert.deepEqual(runtime.databaseCalls, []);
});

test('JSON malformado se rechaza sin acceder a D1', async () => {
    const runtime = createEnvironment();
    const result = await responseJson(await worker.fetch(
        createRequest('{', { contentType: 'application/json' }),
        runtime.env
    ));

    assert.equal(result.status, 400);
    assert.equal(result.body.error, 'json_invalido');
    assert.deepEqual(runtime.databaseCalls, []);
});

test('un inicio válido usa ambos límites y crea una sola sesión', async () => {
    const runtime = createEnvironment();
    const result = await responseJson(await worker.fetch(
        createRequest({
            type: 'session_start',
            sessionId: SESSION_ID
        }),
        runtime.env
    ));

    assert.equal(result.status, 200);
    assert.equal(result.body.type, 'session_start');
    assert.deepEqual(runtime.limiterKeys, [
        'events:edge:MEX',
        'events:start:MEX'
    ]);
    assert.equal(runtime.databaseCalls.length, 1);
    assert.match(
        runtime.databaseCalls[0],
        /ON CONFLICT\(session_id\) DO NOTHING/
    );
});
