const express = require('express');
const router = express.Router();
const { 
    createJob,
    getJobs,
    matchJd,
    rankResumes
} = require('../controllers/jobController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');
const { careerAdvice } = require('../controllers/careerAdviceController');

router.post('/', protect, createJob);
router.get('/', protect, getJobs);
router.post('/match-jd', protect, matchJd);
router.post('/career-advice', protect, careerAdvice);
router.post('/rank-resumes', protect, (req, res, next) => {
    upload.array('resumes')(req, res, error => {
        if (!error) return next();
        res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({
            message: error.code === 'LIMIT_FILE_SIZE' ? 'Each resume must be 5 MB or smaller.' : 'Upload PDF, DOCX, or TXT resumes (maximum 5 MB each).'
        });
    });
}, rankResumes);

module.exports = router;

