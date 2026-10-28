const { test } = require('node:test');
const assert = require('node:assert/strict');
const { requestGemini } = require('../services/geminiRequest');
const { selectAlternateModel } = require('../services/geminiModels');

function configure(t, value = 'gemini-2.5-flash') {
    const original = process.env.GEMINI_FALLBACK_MODEL;
    process.env.GEMINI_FALLBACK_MODEL = value;
    t.after(() => {
        if (original === undefined) delete process.env.GEMINI_FALLBACK_MODEL;
        else process.env.GEMINI_FALLBACK_MODEL = original;
    });
}
const reply = (status, retryAfter = null) => ({ status, ok: status === 200, headers: { get: () => retryAfter } });

test('503 retries primary then uses alternate with the same complete request', async t => {
    configure(t);
    const calls = [], delays = [];
    const body = { documentText: 'Entire synthetic document' };
    const result = await requestGemini(body, 'private-test-key', 'gemini-3.8-flash', {
        request: async (url, options) => {
            if (options.method === 'GET') return { ok: true, json: async () => ({ models: [
                { name: 'models/gemini-3.5-flash-lite', supportedGenerationMethods: ['generateContent'] }
            ] }) };
            calls.push(url);
            assert.equal(JSON.parse(options.body).documentText, body.documentText);
            assert.equal(options.headers['x-goog-api-key'], 'private-test-key');
            assert.ok(!url.includes('private-test-key'));
            return reply(calls.length < 3 ? 503 : 200);
        }, wait: async ms => delays.push(ms), random: () => 0
    });
    assert.deepEqual(delays, [1000, 2000]);
    assert.match(calls[0], /gemini-3\.8-flash:generateContent$/);
    assert.equal(calls[0], calls[1]);
    assert.match(calls[2], /gemini-3\.5-flash-lite:generateContent$/);
    assert.equal(result.model, 'gemini-3.5-flash-lite');
    assert.equal(result.response.status, 200);
});

test('persistent provider outages stop after three attempts without a success response', async t => {
    configure(t);
    let calls = 0;
    const result = await requestGemini({}, 'test', 'primary', {
        request: async () => { calls++; return reply(503); }, wait: async () => {}, random: () => 0,
        selectAlternate: async () => 'gemini-3.5-flash-lite'
    });
    assert.equal(calls, 3); assert.equal(result.response.status, 503);
});

test('model discovery ignores unavailable preferred models and non-text models', async () => {
    const selected = await selectAlternateModel('private-key', 'gemini-3.8-flash', 'gemini-2.5-flash', {
        timeout: 5000,
        request: async (url, options) => {
            assert.equal(options.method, 'GET'); assert.ok(!url.includes('private-key'));
            assert.equal(options.headers['x-goog-api-key'], 'private-key');
            return { ok: true, json: async () => ({ models: [
                { name: 'models/gemini-3.8-flash', supportedGenerationMethods: ['generateContent'] },
                { name: 'models/gemini-3.1-flash-lite', supportedGenerationMethods: ['generateContent'] },
                { name: 'models/gemini-3.5-flash-lite', supportedGenerationMethods: ['generateContent'] },
                { name: 'models/gemini-3.8-flash-tts', supportedGenerationMethods: ['generateContent'] },
                { name: 'models/gemini-4.0-flash', supportedGenerationMethods: ['embedContent'] }
            ] }) };
        }
    });
    assert.equal(selected, 'gemini-3.5-flash-lite');
});

test('model discovery failure cannot fabricate a model verdict', async () => {
    const result = await selectAlternateModel('test', 'primary', 'configured-alternate', {
        timeout: 5000, request: async () => { throw new Error('offline'); }
    });
    assert.equal(result, 'configured-alternate');
});

test('authentication, model and bad-request errors are never retried', async t => {
    configure(t);
    for (const status of [400, 401, 402, 403, 404]) {
        let calls = 0;
        const result = await requestGemini({}, 'test', 'primary', {
            request: async () => { calls++; return reply(status); },
            wait: async () => assert.fail('must not wait')
        });
        assert.equal(calls, 1); assert.equal(result.response.status, status);
    }
});

test('network timeouts can recover on a bounded primary retry', async t => {
    configure(t);
    let calls = 0;
    const result = await requestGemini({}, 'test', 'primary', {
        request: async () => { if (++calls === 1) throw new DOMException('timeout', 'TimeoutError'); return reply(200); },
        wait: async () => {}, random: () => 0
    });
    assert.equal(calls, 2); assert.equal(result.model, 'primary');
});

test('long Retry-After is respected without an immediate retry', async t => {
    configure(t);
    let calls = 0;
    const result = await requestGemini({}, 'test', 'primary', {
        request: async () => { calls++; return reply(429, '60'); },
        wait: async () => assert.fail('must not wait')
    });
    assert.equal(calls, 1); assert.equal(result.response.status, 429);
});

test('elapsed request budget prevents further attempts', async t => {
    configure(t);
    let time = 0, calls = 0;
    const result = await requestGemini({}, 'test', 'primary', {
        now: () => time,
        request: async () => { calls++; time = 45000; return reply(503); },
        wait: async () => assert.fail('must not wait')
    });
    assert.equal(calls, 1); assert.equal(result.response.status, 503);
});

test('HTTP-date Retry-After is respected too', async t => {
    configure(t);
    let calls = 0;
    const result = await requestGemini({}, 'test', 'primary', {
        now: () => 0,
        request: async () => { calls++; return reply(503, new Date(60000).toUTCString()); },
        wait: async () => assert.fail('must not wait')
    });
    assert.equal(calls, 1); assert.equal(result.response.status, 503);
});

test('alternate-model attempt can be explicitly disabled', async t => {
    configure(t, 'none');
    let calls = 0;
    const result = await requestGemini({}, 'test', 'primary', {
        request: async () => { calls++; return reply(503); }, wait: async () => {}, random: () => 0
    });
    assert.equal(calls, 2); assert.equal(result.model, 'primary');
});
