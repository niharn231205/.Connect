const fs = require('fs/promises');
const db = require('../data/database');
const { validateResumeWithGemini } = require('../services/geminiService');
const { runPython } = require('../services/pythonService');

async function runPythonParser(args) {
    try {
        const stdout = await runPython(args);
        const result = JSON.parse(stdout);
        if (result.error) throw Object.assign(new Error(result.error), { status: 422, code: 'UNREADABLE_DOCUMENT' });
        return result;
    } catch (error) {
        if (error.status) throw error;
        throw Object.assign(new Error('Document processing is unavailable. Please try again later.'), {
            status: 503, code: 'EXTRACTION_UNAVAILABLE'
        });
    }
}

// Dependencies are injectable so failure paths can be tested without sending personal data.
function createUploadResume({ database = db, parse = runPythonParser, verify = validateResumeWithGemini } = {}) {
    return async (req, res) => {
        let saved = false;
        try {
            if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
            const user = database.findUserById(req.user.id);
            if (!user) return res.status(404).json({ message: 'User not found' });

            const { extractedText } = await parse(['--extract', req.file.path]);
            const verification = await verify(extractedText);
            if (!verification.isResume || verification.confidence < 0.8) {
                return res.status(422).json({
                    code: verification.isResume ? 'UNCERTAIN_DOCUMENT' : 'NOT_A_RESUME',
                    message: verification.isResume
                        ? 'Gemini could not confidently identify this as a resume. Please upload a clearer resume/CV.'
                        : `This document was not identified as a resume/CV. ${verification.reason}`,
                    verification
                });
            }
            // Analyze only after Gemini accepts the extracted document.
            const results = await parse(['--resume', req.file.path]);
            const updatedUser = database.updateUser(user.id, {
                resume: {
                    filename: req.file.filename, path: req.file.path, extractedText,
                    verifiedByAI: true, documentType: verification.documentType,
                    verification, verifiedAt: new Date().toISOString()
                },
                atsScore: results.atsScore, skills: results.skills || [],
                suggestions: results.suggestions, keywords: results.keywords || []
            });
            if (!updatedUser) throw new Error('User could not be updated');
            saved = true;
            return res.json({
                message: 'Resume verified and analyzed successfully',
                atsScore: updatedUser.atsScore, suggestions: updatedUser.suggestions,
                skills: updatedUser.skills, verification
            });
        } catch (error) {
            return res.status(error.status || 500).json({
                code: error.code || 'UPLOAD_FAILED',
                message: error.status ? error.message : 'Could not save your resume. Please try again.'
            });
        } finally {
            if (req.file && !saved) {
                await fs.unlink(req.file.path).catch(error => {
                    if (error.code !== 'ENOENT') console.error('Failed to remove rejected upload');
                });
            }
        }
    };
}

module.exports = { uploadResume: createUploadResume(), createUploadResume };
