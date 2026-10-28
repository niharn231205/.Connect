const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createRankResumes } = require('../controllers/jobController');

const accepted = { isResume: true, confidence: 0.95, documentType: 'resume' };
for (const scenario of ['accept', 'experiment', 'uncertain', 'provider fails', 'parser fails', 'missing job description']) {
    test(`bulk ranking: ${scenario}`, async t => {
        const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'connect-ranker-'));
        t.after(() => fs.rm(directory, { recursive: true, force: true }));
        const files = await Promise.all([1, 2, 3].map(async index => {
            const filePath = path.join(directory, `candidate-${index}.txt`);
            await fs.writeFile(filePath, 'Synthetic document');
            return { path: filePath, originalname: `candidate-${index}.txt` };
        }));
        const events = [];
        let verifications = 0;
        const handler = createRankResumes({
            parse: async ([mode, file]) => {
                events.push(mode);
                if (mode === '--extract') return { extractedText: file };
                if (scenario === 'parser fails') throw Object.assign(new Error('Parser unavailable'), { status: 503 });
                return { matchPercentage: 75, matchedSkills: ['teaching'], missingSkills: [], resumeSkills: ['teaching'] };
            },
            verify: async () => {
                events.push('verify');
                verifications++;
                if (verifications === 2) {
                    if (scenario === 'experiment') return { ...accepted, isResume: false, documentType: 'lab_report' };
                    if (scenario === 'uncertain') return { ...accepted, confidence: 0.6 };
                    if (scenario === 'provider fails') throw Object.assign(new Error('Unavailable'), { status: 503 });
                }
                return accepted;
            }
        });
        const response = { statusCode: 200, status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; return this; } };
        await handler({ files, body: { jobDescription: scenario === 'missing job description' ? '' : 'Teaching position' } }, response);
        if (scenario === 'accept') {
            assert.equal(response.statusCode, 200);
            assert.equal(response.body.rankings.length, 3);
            assert.deepEqual(events, ['--extract', 'verify', '--extract', 'verify', '--extract', 'verify', '--match', '--match', '--match']);
        } else {
            assert.ok(response.statusCode >= 400);
            assert.equal(response.body.rankings, undefined);
            if (scenario !== 'parser fails') assert.ok(!events.includes('--match'));
            if (scenario === 'experiment') {
                assert.equal(response.statusCode, 422);
                assert.equal(response.body.code, 'NOT_A_RESUME');
                assert.match(response.body.message, /^File 2:/);
            }
        }
        for (const file of files) await assert.rejects(fs.access(file.path), { code: 'ENOENT' });
    });
}
