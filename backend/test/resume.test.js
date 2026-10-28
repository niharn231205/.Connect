const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { validateResumeWithGemini: validate } = require('../services/geminiService');
const validateResumeWithGemini = text => validate(text, { wait: async () => {}, random: () => 0,
    selectAlternate: async () => 'gemini-3.5-flash-lite' });
const { createUploadResume } = require('../controllers/resumeController');
const resumeText = 'Jane Doe\nEducation: University degree\nProjects: Community library\nSkills: Teaching';
const accepted = { isResume: true, confidence: 0.95, documentType: 'resume', reason: 'Personal career history.', provider: 'gemini' };

test('Gemini validation handles provider success and failures without accepting unverified content', async t => {
    const originalKey = process.env.GEMINI_API_KEY;
    t.after(() => { if (originalKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = originalKey; });
    delete process.env.GEMINI_API_KEY;
    await assert.rejects(validateResumeWithGemini(resumeText), { code: 'VERIFICATION_NOT_CONFIGURED' });
    await assert.rejects(validateResumeWithGemini(''), { code: 'UNREADABLE_DOCUMENT' });
    await assert.rejects(validateResumeWithGemini('a'.repeat(50001)), { code: 'DOCUMENT_TOO_LONG' });
    process.env.GEMINI_API_KEY = 'test-key';
    let reply = { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(accepted) }] } }] };
    let status = 200;
    const mock = t.mock.method(global, 'fetch', async (url, options) => {
        assert.equal(options.headers['x-goog-api-key'], 'test-key');
        assert.ok(!url.includes('test-key'));
        const body = JSON.parse(options.body);
        assert.equal(JSON.parse(body.contents[0].parts[0].text).documentText, resumeText);
        const output = body.generationConfig.responseFormat.text;
        assert.equal(output.mimeType, 'APPLICATION_JSON');
        assert.ok(output.schema.properties.documentType.enum.includes('lab_report'));
        assert.match(body.systemInstruction.parts[0].text, /experiment write-ups/);
        assert.ok(options.signal);
        return { ok: status === 200, status, json: async () => reply };
    });
    assert.equal((await validateResumeWithGemini(resumeText)).isResume, true);
    reply.candidates[0].content.parts[0].text = JSON.stringify({ ...accepted, isResume: false, documentType: 'lab_report' });
    assert.equal((await validateResumeWithGemini(resumeText)).isResume, false);
    for (const verdict of [{ ...accepted, isResume: 'true' }, { ...accepted, confidence: 2 }, { ...accepted, reason: '' },
        { ...accepted, documentType: 'lab_report' }, { ...accepted, documentType: 'unknown' }, null]) {
        reply.candidates[0].content.parts[0].text = JSON.stringify(verdict);
        await assert.rejects(validateResumeWithGemini(resumeText), { code: 'VERIFICATION_UNAVAILABLE' });
    }
    reply.candidates[0].content.parts[0].text = '{bad json';
    await assert.rejects(validateResumeWithGemini(resumeText), { code: 'VERIFICATION_UNAVAILABLE' });
    reply = { candidates: [] };
    await assert.rejects(validateResumeWithGemini(resumeText), { code: 'VERIFICATION_UNAVAILABLE' });
    for (const httpStatus of [400, 401, 403, 404, 429, 500, 503]) {
        status = httpStatus;
        await assert.rejects(validateResumeWithGemini(resumeText), {
            code: status === 429 ? 'VERIFICATION_RATE_LIMITED' : status >= 500 ? 'VERIFICATION_TEMPORARILY_UNAVAILABLE' : 'VERIFICATION_UNAVAILABLE'
        });
    }
    mock.mock.mockImplementation(async () => { throw new Error('timeout'); });
    await assert.rejects(validateResumeWithGemini(resumeText), { code: 'VERIFICATION_UNAVAILABLE' });
});

for (const scenario of ['accept', 'reject', 'uncertain', 'inconsistent type', 'malformed verdict', 'provider fails', 'parser fails', 'save fails', 'unknown user']) {
    test(`upload: ${scenario}`, async t => {
        const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'connect-resume-'));
        t.after(() => fs.rm(directory, { recursive: true, force: true }));
        const filePath = path.join(directory, 'resume.txt');
        await fs.writeFile(filePath, resumeText);
        const events = [];
        let profile = { id: 'test-user', resume: { filename: 'previous.txt' }, atsScore: 80 };
        const original = structuredClone(profile);
        const handler = createUploadResume({
            database: {
                findUserById: () => scenario === 'unknown user' ? null : profile,
                updateUser: (id, data) => {
                    events.push('save');
                    if (scenario === 'save fails') throw new Error('disk error');
                    profile = { ...profile, ...data }; return profile;
                }
            },
            parse: async ([mode]) => {
                events.push(mode);
                if (scenario === 'parser fails') throw Object.assign(new Error('Parser failed'), { status: 503 });
                return mode === '--extract' ? { extractedText: resumeText } : { atsScore: 70, skills: ['teaching'], suggestions: {} };
            },
            verify: async text => {
                events.push('verify'); assert.equal(text, resumeText);
                if (scenario === 'provider fails') throw Object.assign(new Error('Unavailable'), { status: 503 });
                if (scenario === 'malformed verdict') return { ...accepted, confidence: NaN };
                return { ...accepted, isResume: scenario !== 'reject', confidence: scenario === 'uncertain' ? 0.5 : 0.95,
                    documentType: ['reject', 'inconsistent type'].includes(scenario) ? 'lab_report' : 'resume' };
            }
        });
        const response = { statusCode: 200, status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; return this; } };
        await handler({ user: { id: 'test-user' }, file: { path: filePath, filename: 'resume.txt' } }, response);
        if (scenario === 'accept') {
            assert.equal(response.statusCode, 200);
            assert.deepEqual(events, ['--extract', 'verify', '--resume', 'save']);
            assert.equal(profile.resume.verifiedByAI, true);
            await fs.access(filePath);
        } else {
            assert.ok(response.statusCode >= 400);
            assert.deepEqual(profile, original);
            await assert.rejects(fs.access(filePath), { code: 'ENOENT' });
            if (['reject', 'uncertain', 'inconsistent type', 'malformed verdict', 'provider fails'].includes(scenario)) assert.deepEqual(events, ['--extract', 'verify']);
            if (['reject', 'inconsistent type'].includes(scenario)) {
                assert.equal(response.statusCode, 422);
                assert.equal(response.body.code, 'NOT_A_RESUME');
                assert.match(response.body.message, /Experiment reports/);
            }
        }
    });
}
