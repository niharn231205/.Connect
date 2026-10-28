const express = require('express');
const router = express.Router();
const { uploadResume } = require('../controllers/resumeController');
const upload = require('../middleware/uploadMiddleware');
const { protect } = require('../middleware/authMiddleware');

router.post('/upload', protect, (req, res, next) => {
    upload.single('resume')(req, res, error => {
        if (!error) return next();
        res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({
            message: error.code === 'LIMIT_FILE_SIZE' ? 'Resume must be 5 MB or smaller.' : 'Upload one PDF, DOCX, or TXT resume (maximum 5 MB).'
        });
    });
}, uploadResume);

module.exports = router;
