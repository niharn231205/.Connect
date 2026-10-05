const { exec } = require('child_process');
const path = require('path');
const db = require('../data/database');

const runPythonParser = (args) => {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(__dirname, '../nlp_engine.py');
        // Escape args properly
        const cmd = `python "${scriptPath}" ${args.map(a => `"${a}"`).join(' ')}`;
        
        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                // Try python3 fallback
                const cmdFallback = `python3 "${scriptPath}" ${args.map(a => `"${a}"`).join(' ')}`;
                exec(cmdFallback, (error2, stdout2, stderr2) => {
                    if (error2) {
                        reject(new Error(`Python execution failed: ${stderr2 || stderr || error2.message}`));
                    } else {
                        resolve(stdout2);
                    }
                });
            } else {
                resolve(stdout);
            }
        });
    });
};

const uploadResume = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const userId = req.user.id;
        const user = db.findUserById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const filePath = req.file.path;
        
        try {
            // Run the python parser
            const stdout = await runPythonParser(['--resume', filePath]);
            const results = JSON.parse(stdout);
            
            if (results.error) {
                return res.status(500).json({ message: results.error });
            }

            const updatedUser = db.updateUser(userId, {
                resume: {
                    filename: req.file.filename,
                    path: req.file.path,
                    extractedText: results.extractedText || ""
                },
                atsScore: results.atsScore,
                skills: results.skills || [],
                suggestions: results.suggestions || {
                    missingSkills: [],
                    formatting: "No recommendations available.",
                    keywordsToAdd: []
                },
                keywords: results.keywords || []
            });

            res.json({
                message: 'Resume uploaded and analyzed successfully',
                atsScore: updatedUser.atsScore,
                suggestions: updatedUser.suggestions,
                skills: updatedUser.skills
            });
        } catch (nlpError) {
            console.error("NLP Engine execution failed:", nlpError);
            
            // Graceful fallback simulation if Python environment is completely broken
            // This ensures the site never crashes even if python/pip is not configured on local PC.
            const dummyText = `This is a fallback text for ${req.file.originalname}. Skills: HTML, CSS, Javascript, Node.js, SQL.`;
            const dummySkills = ["html", "css", "javascript", "node.js", "sql"];
            const fallbackUser = db.updateUser(userId, {
                resume: {
                    filename: req.file.filename,
                    path: req.file.path,
                    extractedText: dummyText
                },
                atsScore: 65,
                skills: dummySkills,
                suggestions: {
                    missingSkills: ["React", "Docker", "AWS"],
                    formatting: "Notice: Python parsing failed. Installed standard fallback report instead.",
                    keywordsToAdd: ["Add details of React, Docker, or AWS if applicable."]
                },
                keywords: [
                    { "text": "javascript", "value": 3 },
                    { "text": "html", "value": 2 },
                    { "text": "css", "value": 2 }
                ]
            });

            res.json({
                message: 'Resume uploaded successfully (with fallback parsing)',
                atsScore: fallbackUser.atsScore,
                suggestions: fallbackUser.suggestions,
                skills: fallbackUser.skills
            });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error during upload' });
    }
};

module.exports = { uploadResume };

