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
