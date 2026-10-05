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

router.post('/', protect, createJob);
router.get('/', protect, getJobs);
router.post('/match-jd', protect, matchJd);
router.post('/rank-resumes', protect, upload.array('resumes'), rankResumes);

module.exports = router;

