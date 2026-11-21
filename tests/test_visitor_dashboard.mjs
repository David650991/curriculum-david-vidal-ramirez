import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.window = {
    location: {
        hostname: 'localhost'
    }
};

const {
    normalizeHistory,
    normalizeStatsResponse
} = await import('../src/js/modules/visitor-dashboard.js');

const realStats = {
    total_visits: 18,
    total_clicks: 3,
    average_active_seconds: 47,
    online_estimate: 2,
    cv_clicks: 1,
    whatsapp_clicks: 1,
    email_clicks: 0,
    phone_clicks: 0,
    navigation_clicks: 1,
    project_clicks: 0
};

test('una respuesta vacía confirmada produce diez ceros', () => {
    const result = normalizeStatsResponse({
        status: 'sin_registros',
        recording: false,
        stats: null
    });

    assert.equal(result.state, 'empty');
    assert.equal(result.recording, false);
    assert.deepEqual(Object.values(result.stats), Array(10).fill(0));
});

test('las estadísticas reales se conservan sin alteraciones', () => {
    const result = normalizeStatsResponse({
        status: 'datos_disponibles',
        recording: true,
        stats: realStats
    });

    assert.equal(result.state, 'data');
    assert.equal(result.recording, true);
    assert.deepEqual(result.stats, realStats);
    assert.notStrictEqual(result.stats, realStats);
});

test('una falla o estructura inválida no se interpreta como cero', () => {
    assert.throws(
        () => normalizeStatsResponse(undefined),
        /no válida/
    );
    assert.throws(
        () => normalizeStatsResponse({
            status: 'sin_registros',
            recording: false,
            stats: {}
        }),
        /no válida/
    );
    assert.throws(
        () => normalizeStatsResponse({
            status: 'datos_disponibles',
            recording: false,
            stats: {
                ...realStats,
                total_visits: -1
            }
        }),
        /Contador no válido/
    );
});

test('el historial vacío es válido y no genera datos simulados', () => {
    assert.deepEqual(normalizeHistory([]), []);
});

test('el historial real se valida, calcula y ordena', () => {
    const rows = normalizeHistory([
        {
            day_utc: '2026-11-20',
            total_visits: 2,
            total_clicks: 1,
            active_ms_sum: 9000,
            active_sessions: 2
        },
        {
            day_utc: '2026-11-19',
            total_visits: 1,
            total_clicks: 0,
            active_ms_sum: 0,
            active_sessions: 0
        }
    ]);

    assert.deepEqual(rows, [
        {
            date: '2026-11-19',
            visits: 1,
            clicks: 0,
            averageSeconds: null
        },
        {
            date: '2026-11-20',
            visits: 2,
            clicks: 1,
            averageSeconds: 5
        }
    ]);
});

test('una fila histórica inválida produce error', () => {
    assert.throws(
        () => normalizeHistory([{ day_utc: '2026-02-30' }]),
        /Fecha histórica no válida/
    );
});
