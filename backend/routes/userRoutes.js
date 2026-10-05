const express = require('express');
const router = express.Router();
const { 
    setAnswers, 
    getDashboardData, 
    getRecommendations,
    sendConnectionRequest,
    acceptConnectionRequest,
    getConnections,
    getChatHistory,
    addPortfolioItem,
    endorseSkill,
    saveInterviewScore,
    getLeaderboard,
    getActivityFeed
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

router.post('/answers', protect, setAnswers);
router.get('/dashboard', protect, getDashboardData);
router.get('/recommendations', protect, getRecommendations);
router.post('/connect/:targetId', protect, sendConnectionRequest);
router.post('/connect/accept/:senderId', protect, acceptConnectionRequest);
router.get('/connections', protect, getConnections);
router.get('/chat/:targetId', protect, getChatHistory);

router.post('/portfolio', protect, addPortfolioItem);
router.post('/endorse/:targetId', protect, endorseSkill);

// New Pro routes
router.post('/interview-score', protect, saveInterviewScore);
router.get('/leaderboard', protect, getLeaderboard);
router.get('/activity', protect, getActivityFeed);

module.exports = router;
