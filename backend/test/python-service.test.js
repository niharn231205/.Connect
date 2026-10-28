const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const { runPython, checkPython } = require('../services/pythonService');

test('missing Python produces actionable diagnostics without exposing document paths', async t => {
    const original = process.env.PYTHON_BIN;
    t.after(() => {
        if (original === undefined) delete process.env.PYTHON_BIN;
        else process.env.PYTHON_BIN = original;
    });
    process.env.PYTHON_BIN = path.join(os.tmpdir(), 'connect-missing-python-interpreter');
    const log = t.mock.method(console, 'error', () => {});
    await assert.rejects(runPython(['--extract', '/private/resume-personal.pdf']), {
        code: 'EXTRACTION_UNAVAILABLE', reason: 'PYTHON_NOT_FOUND', status: 503
    });
    assert.match(log.mock.calls[0].arguments[0], /PYTHON_NOT_FOUND/);
    assert.doesNotMatch(log.mock.calls[0].arguments[0], /personal/);
    await assert.rejects(checkPython(), { reason: 'PYTHON_NOT_FOUND' });
});
