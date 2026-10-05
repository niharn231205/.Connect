const express = require('express');
const router = express.Router();
const { uploadResume } = require('../controllers/resumeController');
const upload = require('../middleware/uploadMiddleware');
const { protect } = require('../middleware/authMiddleware');

router.post('/upload', protect, upload.single('resume'), uploadResume);

module.exports = router;
