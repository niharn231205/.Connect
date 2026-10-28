const express = require('express');
const router = express.Router();
const {
    getQuestionsByCompany,
    downloadQuestionsPDF,
    getAnswer
} = require('../controllers/interviewController');
const { protect } = require('../middleware/authMiddleware');
const aiInterview = require('../controllers/aiInterviewController');

router.post('/generate', protect, aiInterview.generate);
router.post('/evaluate-ai', protect, aiInterview.evaluate);

router.get('/questions/:company', protect, getQuestionsByCompany);
router.post('/evaluate', protect, aiInterview.evaluate);
router.get('/download', protect, downloadQuestionsPDF);
router.post('/answer', protect, getAnswer);

module.exports = router;
