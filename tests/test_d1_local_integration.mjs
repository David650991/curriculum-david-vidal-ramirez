import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

const { default: worker } = await import(
    '../infra/cloudflare/analytics-worker.js'
);

const ORIGIN = 'https://david650991.github.io';
const SESSION_ID = '11111111-1111-4111-8111-111111111111';

class LocalD1Statement {
    constructor(database, sql) {
        this.statement = database.prepare(sql);
        this.values = [];
    }

    bind(...values) {
        this.values = values;
        return this;
    }

    async first() {
        return this.statement.get(...this.values) ?? null;
    }

    async all() {
        return { results: this.statement.all(...this.values) };
    }

    async run() {
        const result = this.statement.run(...this.values);
        return {
            success: true,
            meta: { changes: Number(result.changes) },
            results: []
        };
    }
}

class LocalD1Database {
    constructor() {
        this.sqlite = new DatabaseSync(':memory:');
        this.sqlite.exec('PRAGMA foreign_keys = ON');
        this.sqlite.exec(readFileSync(
            new URL('../infra/cloudflare/d1-schema.sql', import.meta.url),
            'utf8'
        ));
    }

    prepare(sql) {
        return new LocalD1Statement(this.sqlite, sql);
    }

    async batch(statements) {
        const results = [];

        for (const statement of statements) {
            if (/^\s*SELECT/i.test(statement.statement.sourceSQL)) {
                results.push(await statement.all());
            } else {
                results.push(await statement.run());
            }
        }

        return results;
    }

    close() {
        this.sqlite.close();
    }
}

function eventRequest(body) {
    const request = new Request('https://worker.example/events', {
        method: 'POST',
        headers: {
            Origin: ORIGIN,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    Object.defineProperty(request, 'cf', {
        value: { colo: 'LOCAL' }
    });

    return request;
}

function environment(database) {
    return {
        ANALYTICAS_ESCRITURA: 'habilitada',
        DB: database,
        EVENT_RATE_LIMITER: {
            async limit() { return { success: true }; }
        }
    };
}

async function record(env, payload) {
    return worker.fetch(eventRequest(payload), env);
}

test('D1 local conserva sesión, idempotencia y seis categorías', async () => {
    const database = new LocalD1Database();
    const env = environment(database);

    try {
        for (let attempt = 0; attempt < 2; attempt += 1) {
            const response = await record(env, {
                type: 'session_start',
                sessionId: SESSION_ID
            });
            assert.equal(response.status, 200);
        }

        const actions = [
            'cv_download_click',
            'whatsapp_click',
            'email_click',
            'phone_click',
            'navigation_click',
            'project_link_click'
        ];

        for (const [index, action] of actions.entries()) {
            const eventId = `22222222-2222-4222-8222-${String(index + 1).padStart(12, '0')}`;
            const response = await record(env, {
                type: 'click',
                sessionId: SESSION_ID,
                eventId,
                action
            });
            assert.equal(response.status, 200);
        }

        const duplicate = await record(env, {
            type: 'click',
            sessionId: SESSION_ID,
            eventId: '22222222-2222-4222-8222-000000000001',
            action: 'cv_download_click'
        });
        assert.equal(duplicate.status, 200);

        for (const activeMs of [5000, 3000]) {
            const response = await record(env, {
                type: 'session_activity',
                sessionId: SESSION_ID,
                activeMs
            });
            assert.equal(response.status, 200);
        }

        const sessions = database.sqlite.prepare(
            'SELECT COUNT(*) AS total, MAX(active_ms) AS active_ms FROM analytics_sessions'
        ).get();
        const daily = database.sqlite.prepare(
            'SELECT * FROM analytics_daily'
        ).get();

        assert.equal(sessions.total, 1);
        assert.equal(sessions.active_ms, 5000);
        assert.equal(daily.total_visits, 1);
        assert.equal(daily.total_clicks, 6);
        assert.equal(daily.cv_clicks, 1);
        assert.equal(daily.whatsapp_clicks, 1);
        assert.equal(daily.email_clicks, 1);
        assert.equal(daily.phone_clicks, 1);
        assert.equal(daily.navigation_clicks, 1);
        assert.equal(daily.project_clicks, 1);
        assert.equal(daily.active_ms_sum, 5000);
        assert.equal(daily.active_sessions, 1);
    } finally {
        database.close();
    }
});
