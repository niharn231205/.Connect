const fs = require('fs/promises');
const db = require('../data/database');
const { validateResumeWithGemini } = require('../services/geminiService');
const { parseDocument, verifyResumeFile } = require('../services/resumeVerificationService');

// Dependencies are injectable so failure paths can be tested without sending personal data.
function createUploadResume({ database = db, parse = parseDocument, verify = validateResumeWithGemini } = {}) {
    return async (req, res) => {
        let saved = false;
        try {
            if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
            const user = database.findUserById(req.user.id);
            if (!user) return res.status(404).json({ message: 'User not found' });

            const { extractedText, verification } = await verifyResumeFile(req.file.path, { parse, verify });
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
                message: error.status ? error.message : 'Could not save your resume. Please try again.',
                ...(error.verification ? { verification: error.verification } : {})
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
