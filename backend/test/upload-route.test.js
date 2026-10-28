const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const fs = require('node:fs/promises');
const path = require('node:path');
const db = require('../data/database');
const router = require('../routes/resumeRoutes');
const jobRouter = require('../routes/jobRoutes');

test('multipart route returns JSON errors and enforces authentication, format and size', async t => {
    const directory = path.join(__dirname, '../uploads');
    await fs.mkdir(directory, { recursive: true });
    const before = (await fs.readdir(directory)).sort();
    const app = express();
    app.use('/api/resume', router);
    app.use('/api/jobs', jobRouter);
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    t.mock.method(db, 'findUserById', () => null);
    const token = jwt.sign({ id: 'upload-test' }, process.env.JWT_SECRET || 'fallback_secret');
    const endpoint = `http://127.0.0.1:${server.address().port}/api/resume/upload`;
    async function upload(name, text, authorized = true) {
        const form = new FormData();
        if (name) form.append('resume', new Blob([text]), name);
        const res = await fetch(endpoint, { method: 'POST', body: form,
            headers: authorized ? { Authorization: `Bearer ${token}` } : {} });
        assert.match(res.headers.get('content-type'), /application\/json/);
        return res.status;
    }
    assert.equal(await upload('resume.txt', 'example', false), 401);
    assert.equal(await upload('resume.doc', 'example'), 400);
    assert.equal(await upload('resume.txt', 'a'.repeat(5 * 1024 * 1024 + 1)), 413);
    assert.equal(await upload(null, ''), 400);
    assert.equal(await upload('resume.txt', 'example'), 404);
    async function rank(name, text, authorized = true) {
        const form = new FormData();
        if (name) form.append('resumes', new Blob([text]), name);
        const res = await fetch(`http://127.0.0.1:${server.address().port}/api/jobs/rank-resumes`, {
            method: 'POST', body: form, headers: authorized ? { Authorization: `Bearer ${token}` } : {}
        });
        assert.match(res.headers.get('content-type'), /application\/json/);
        return res.status;
    }
    assert.equal(await rank('resume.txt', 'example', false), 401);
    assert.equal(await rank('resume.doc', 'example'), 400);
    assert.equal(await rank('resume.txt', 'a'.repeat(5 * 1024 * 1024 + 1)), 413);
    // Missing job descriptions must clean uploaded files too.
    assert.equal(await rank('resume.txt', 'example'), 400);
    // Controller cleanup occurs in finally after the response is sent.
    for (let i = 0; i < 20; i++) {
        if (JSON.stringify((await fs.readdir(directory)).sort()) === JSON.stringify(before)) break;
        await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.deepEqual((await fs.readdir(directory)).sort(), before);
});
