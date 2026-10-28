const { runPython } = require('./pythonService');
const { validateResumeWithGemini } = require('./geminiService');

async function parseDocument(args) {
    try {
        const result = JSON.parse(await runPython(args));
        if (result.error) throw Object.assign(new Error(result.error), { status: 422, code: 'UNREADABLE_DOCUMENT' });
        return result;
    } catch (error) {
        if (error.status) throw error;
        throw Object.assign(new Error('Document processing is unavailable. Please try again later.'), {
            status: 503, code: 'EXTRACTION_UNAVAILABLE'
        });
    }
}

async function verifyResumeFile(filePath, { parse = parseDocument, verify = validateResumeWithGemini } = {}) {
    const { extractedText } = await parse(['--extract', filePath]);
    const verification = await verify(extractedText);
    if (!verification || typeof verification.isResume !== 'boolean' ||
        !Number.isFinite(verification.confidence) || verification.confidence < 0 || verification.confidence > 1) {
        throw Object.assign(new Error('Resume verification is unavailable. Please try again later.'), {
            status: 503, code: 'VERIFICATION_UNAVAILABLE'
        });
    }
    const resumeType = /^(resume|cv)$/i.test(verification.documentType || '');
    if (!verification.isResume || !resumeType || verification.confidence < 0.8) {
        const uncertain = verification.isResume && resumeType;
        throw Object.assign(new Error(uncertain
            ? 'This could not be confidently identified as a resume. Please upload a clearer resume/CV.'
            : 'Only a personal resume/CV is accepted. Experiment reports, lab manuals, assignments, certificates and other documents are not allowed.'), {
            status: 422, code: uncertain ? 'UNCERTAIN_DOCUMENT' : 'NOT_A_RESUME', verification
        });
    }
    return { extractedText, verification };
}

module.exports = { parseDocument, verifyResumeFile };
