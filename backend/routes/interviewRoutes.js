const express = require('express');
const router = express.Router();
const {
    getQuestionsByCompany,
    evaluateAnswer,
    downloadQuestionsPDF,
    getAnswer
} = require('../controllers/interviewController');
const { protect } = require('../middleware/authMiddleware');

router.get('/questions/:company', protect, getQuestionsByCompany);
router.post('/evaluate', protect, evaluateAnswer);
router.get('/download', protect, downloadQuestionsPDF);
router.post('/answer', protect, getAnswer);

module.exports = router;