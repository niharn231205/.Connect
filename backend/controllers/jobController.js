const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const db = require('../data/database');

const jobsFile = path.join(__dirname, '../data/jobs.json');

const getJobsData = () => {
    try {
        const data = fs.readFileSync(jobsFile, 'utf8');
        return JSON.parse(data);
    } catch {
        return [];
    }
};

const saveJobsData = (jobs) => {
    fs.writeFileSync(jobsFile, JSON.stringify(jobs, null, 2));
};

// Seed jobs if empty
const seedJobs = () => {
    let jobs = getJobsData();
    if(jobs.length === 0) {
        jobs = [
            {
                id: "j1",
                title: "Frontend React Developer",
                company: "TechNova",
                description: "Looking for an experienced React developer to build interactive UIs. Must know JavaScript, HTML, CSS, React, and Redux.",
                keywords: ["react", "javascript", "html", "css", "redux"],
                type: "Full-Time"
            },
            {
                id: "j2",
                title: "Backend Node.js Engineer",
                company: "DataSync",
                description: "Node.js expert needed to scale our APIs. Skills: Node.js, Express, MongoDB, REST API.",
                keywords: ["node.js", "express", "mongodb", "rest api"],
                type: "Full-Time"
            },
            {
                id: "j3",
                title: "Data Scientist / ML Engineer",
                company: "CreativeFlow",
                description: "We are seeking a Machine Learning Engineer to design and deploy models. Required: Python, SQL, Machine Learning, TensorFlow, Pandas.",
                keywords: ["python", "sql", "machine learning", "tensorflow", "pandas"],
                type: "Contract"
            }
        ];
        saveJobsData(jobs);
    }
}
seedJobs();

const runPythonParser = (args) => {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(__dirname, '../nlp_engine.py');
        const cmd = `python "${scriptPath}" ${args.map(a => `"${a}"`).join(' ')}`;
        
        exec(cmd, (error, stdout, stderr) => {
            if (error) {
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

const createJob = (req, res) => {
    try {
        const { title, company, description, keywords, type } = req.body;
        const jobs = getJobsData();
        const newJob = {
            id: Date.now().toString() + Math.random().toString(36).substring(2),
            title,
            company,
            description,
            keywords: keywords || [],
            type: type || 'Full-Time',
            postedBy: req.user.id
        };
        jobs.push(newJob);
        saveJobsData(jobs);
        res.status(201).json(newJob);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error creating job' });
    }
};

const getJobs = (req, res) => {
    try {
        const userId = req.user.id;
        const user = db.findUserById(userId);
        
        const userSkills = user.skills || [];
        const jobs = getJobsData();

        // Calculate match score for each job dynamically based on skills array
        const jobsWithMatch = jobs.map(job => {
            let matchScore = 0;
            let matchedSkills = [];
            let missingSkills = [];
            
            if (job.keywords && job.keywords.length > 0) {
                const jobKeywords = job.keywords.map(k => k.toLowerCase());
                const userSkillsLower = userSkills.map(s => s.toLowerCase());
                
                matchedSkills = jobKeywords.filter(k => userSkillsLower.some(us => us.includes(k) || k.includes(us)));
                missingSkills = jobKeywords.filter(k => !userSkillsLower.some(us => us.includes(k) || k.includes(us)));
                
                // Endorsement bonus
                const userEndorsements = user.endorsements || {};
                let matchesWeight = matchedSkills.length;
                matchedSkills.forEach(skill => {
                    const lsk = skill.toLowerCase();
                    if (userEndorsements[lsk] && userEndorsements[lsk] > 0) {
                        matchesWeight += Math.min(2, 0.5 * userEndorsements[lsk]);
                    }
                });
                
                matchScore = Math.min(100, Math.round((matchesWeight / jobKeywords.length) * 100));
            }

            return {
                ...job,
                matchPercentage: matchScore,
                matchedSkills,
                missingSkills
            };
        });

        res.json(jobsWithMatch);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching jobs' });
    }
};

// Match logged in user's resume against pasted JD
const matchJd = async (req, res) => {
    const tempFiles = [];
    try {
        const userId = req.user.id;
        const user = db.findUserById(userId);

        if (!user.resume || !user.resume.path) {
            return res.status(400).json({ message: 'Please upload a resume first' });
        }

        const { jdText } = req.body;
        if (!jdText) {
            return res.status(400).json({ message: 'Job description text is required' });
        }

        // Write JD to temporary file to avoid shell expansion limits
        const jdTempPath = path.join(__dirname, `../uploads/jd_temp_${userId}_${Date.now()}.txt`);
        fs.writeFileSync(jdTempPath, jdText);
        tempFiles.push(jdTempPath);

        const stdout = await runPythonParser(['--match', user.resume.path, jdTempPath]);
        const results = JSON.parse(stdout);

        if (results.error) {
            return res.status(500).json({ message: results.error });
        }

        res.json(results);
    } catch (error) {
        console.error("JD Matcher error:", error);
        res.status(500).json({ message: 'Failed to process matching logic' });
    } finally {
        // Cleanup temp files
        tempFiles.forEach(file => {
            if (fs.existsSync(file)) {
                try { fs.unlinkSync(file); } catch(e) {}
            }
        });
    }
};

// Rank multiple uploaded resumes against a job description
const rankResumes = async (req, res) => {
    const tempFiles = [];
    try {
        const { jobDescription } = req.body;
        const files = req.files;

        if (!jobDescription) {
            return res.status(400).json({ message: 'Job Description is required' });
        }
        if (!files || files.length === 0) {
            return res.status(400).json({ message: 'At least one resume is required' });
        }

        // Write Job Description to temp file
        const jdTempPath = path.join(__dirname, `../uploads/jd_temp_rank_${Date.now()}.txt`);
        fs.writeFileSync(jdTempPath, jobDescription);
        tempFiles.push(jdTempPath);

        const rankings = [];

        // Process each resume file sequentially
        for (const file of files) {
            tempFiles.push(file.path); // add to delete list later
            try {
                const stdout = await runPythonParser(['--match', file.path, jdTempPath]);
                const results = JSON.parse(stdout);
                
                // Format candidate name from original file name
                let candidateName = path.basename(file.originalname, path.extname(file.originalname));
                candidateName = candidateName.replace(/[_-]/g, ' ')
                    .replace(/\b\w/g, c => c.toUpperCase());

                rankings.push({
                    candidateName,
                    matchPercentage: results.matchPercentage || 0,
                    matchedSkills: results.matchedSkills || [],
                    missingSkills: results.missingSkills || [],
                    email: results.resumeSkills && results.resumeSkills.length ? `${candidateName.toLowerCase().replace(/\s/g, '')}@example.com` : 'unknown@example.com'
                });
            } catch (err) {
                console.error(`Error ranking file ${file.originalname}:`, err);
                // add fallback
                rankings.push({
                    candidateName: file.originalname,
                    matchPercentage: 30,
                    matchedSkills: [],
                    missingSkills: ["Error matching"],
                    email: 'error@example.com'
                });
            }
        }

        // Sort by match score descending
        rankings.sort((a, b) => b.matchPercentage - a.matchPercentage);

        res.json({ rankings });
    } catch (error) {
        console.error("Resume ranker error:", error);
        res.status(500).json({ message: 'Failed to process ranking' });
    } finally {
        // Cleanup all temp files
        tempFiles.forEach(file => {
            if (fs.existsSync(file)) {
                try { fs.unlinkSync(file); } catch(e) {}
            }
        });
    }
};

module.exports = {
    createJob,
    getJobs,
    matchJd,
    rankResumes
};
