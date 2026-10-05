const db = require('../data/database');

const setAnswers = (req, res) => {
    try {
        const { field, interests, experienceLevel, workType, careerGoals } = req.body;
        const userId = req.user.id;
        const user = db.findUserById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Logic to categorize user
        let category = "General";
        const lField = (field || "").toLowerCase();
        
        if (lField.includes('tech') || lField.includes('develop') || lField.includes('engineer')) {
            category = "Developer";
        } else if (lField.includes('design') || lField.includes('ui') || lField.includes('ux')) {
            category = "Designer";
        } else if (lField.includes('business') || lField.includes('manage')) {
            category = "Business/Manager";
        }

        let isBeginner = false;
        if (experienceLevel && experienceLevel.toLowerCase().includes('begin')) {
            isBeginner = true;
            category += " (Beginner)";
        }

        const updatedUser = db.updateUser(userId, {
            answers: {
                field,
                interests,
                experienceLevel,
                workType,
                careerGoals
            },
            label: field, // Explicit label for matching
            category
        });

        res.json({
            message: 'Answers saved successfully',
            category: updatedUser.category,
            label: updatedUser.label
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error saving answers' });
    }
};

const getDashboardData = (req, res) => {
    try {
        const userId = req.user.id;
        const user = db.findUserById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Suggested companies based on category
        const companyMap = {
            "Developer": ["Google", "Meta", "OpenAI", "Stripe", "GitHub"],
            "Designer": ["Airbnb", "Figma", "Apple", "Canva", "Adobe"],
            "Business/Manager": ["Goldman Sachs", "McKinsey", "Amazon", "J.P. Morgan", "Salesforce"],
            "General": ["LinkedIn", "Indeed", "Glassdoor"]
        };

        const baseCategory = (user.category || "").split(' (')[0] || "General";
        const suggestedCompanies = companyMap[baseCategory] || companyMap["General"];

        // Build skill breakdown from resume keywords and answers
        const skillBreakdown = {
            'Problem Solving': Math.min(100, (user.atsScore || 0) + 15),
            'Data Structures': Math.min(100, ((user.interviewHistory || []).length * 12) + 20),
            'System Design': Math.min(100, ((user.interviewHistory || []).filter(h => h.score >= 60).length * 18) + 10),
            'Communication': Math.min(100, ((user.connections || []).filter(c => c.status === 'accepted').length * 20) + 30),
            'Networking': Math.min(100, ((user.connections || []).length * 15) + 10),
            'Portfolio': Math.min(100, ((user.portfolio || []).length * 25) + 5)
        };

        // Generate Personalized Roadmap
        const roadmap = [
            { id: 1, text: "Upload professional resume", completed: !!user.resume, points: 50 },
            { id: 2, text: `Finish your first ${suggestedCompanies[0]} prep session`, completed: (user.interviewHistory || []).some(h => h.company === suggestedCompanies[0]), points: 100 },
            { id: 3, text: "Reach 5+ professional connections", completed: (user.connections || []).filter(c => c.status === 'accepted').length >= 5, points: 150 },
            { id: 4, text: "Add 3 projects to your portfolio", completed: (user.portfolio || []).length >= 3, points: 200 },
            { id: 5, text: "Receive a skill endorsement", completed: Object.values(user.endorsements || {}).some(count => count > 0), points: 100 }
        ];

        res.json({
            name: user.name,
            email: user.email,
            atsScore: user.atsScore || 0,
            category: user.category || "Not Set",
            label: user.label || null,
            suggestions: user.suggestions || null,
            answers: user.answers || null,
            resume: user.resume || null,
            portfolio: user.portfolio || [],
            endorsements: user.endorsements || {},
            interviewHistory: user.interviewHistory || [],
            skillBreakdown,
            suggestedCompanies,
            roadmap
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const getRecommendations = (req, res) => {
    try {
        const userId = req.user.id;
        const currentUser = db.findUserById(userId);

        if (!currentUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        const allUsers = db.getUsers();
        
        const myBaseCategory = (currentUser.category || "").replace(" (Beginner)", "");
        const myLabel = currentUser.label;
        const myConnectionIds = (currentUser.connections || []).map(c => c.userId);

        // Simple matching logic based on label first, then category
        const recommendations = allUsers.filter(u => {
            if (u.id === userId) return false;
            if (myConnectionIds.includes(u.id)) return false; // Hide existing connections
            
            const uBaseCategory = (u.category || "").replace(" (Beginner)", "");
            const uLabel = u.label;

            // Prioritize Label Match
            if (myLabel && uLabel && uLabel === myLabel) return true;
            
            // Fallback to Category Match
            return (myBaseCategory && uBaseCategory && uBaseCategory === myBaseCategory);
        }).map(u => ({
            id: u.id,
            name: u.name,
            category: u.category,
            label: u.label,
            field: u.answers?.field || "Unknown",
            experienceLevel: u.answers?.experienceLevel || "Unknown",
            interests: u.answers?.interests || []
        }));

        res.json(recommendations);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error fetching recommendations' });
    }
};

const sendConnectionRequest = (req, res) => {
    try {
        const { targetId } = req.params;
        const senderId = req.user.id;
        console.log(`Processing connection: ${senderId} -> ${targetId}`);

        if (targetId === senderId) {
            return res.status(400).json({ message: 'You cannot connect with yourself' });
        }

        const sender = db.findUserById(senderId);
        const receiver = db.findUserById(targetId);

        if (!sender) {
            console.log('Sender not found:', senderId);
            return res.status(404).json({ message: 'Sender not found' });
        }
        if (!receiver) {
            console.log('Receiver not found:', targetId);
            return res.status(404).json({ message: 'User not found' });
        }

        const senderConnections = sender.connections || [];
        const receiverConnections = receiver.connections || [];

        console.log('Current sender connections:', senderConnections.length);

        // Check if already connected or pending
        if (senderConnections.find(c => c.userId === targetId)) {
            console.log('Connection already exists between', senderId, 'and', targetId);
            return res.status(400).json({ message: 'Connection already exists or is pending' });
        }

        // Add to sender
        senderConnections.push({ userId: targetId, status: 'pending', direction: 'sent' });
        db.updateUser(senderId, { connections: senderConnections });

        // Add to receiver
        receiverConnections.push({ userId: senderId, status: 'pending', direction: 'received' });
        db.updateUser(targetId, { connections: receiverConnections });

        console.log('Connection request successful');
        res.json({ message: 'Connection request sent successfully' });
    } catch (error) {
        console.error('Connection request error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const acceptConnectionRequest = (req, res) => {
    try {
        const { senderId } = req.params;
        const receiverId = req.user.id; // The one accepting is the receiver

        const receiver = db.findUserById(receiverId);
        const sender = db.findUserById(senderId);

        if (!sender) return res.status(404).json({ message: 'User not found' });

        const receiverConnections = receiver.connections || [];
        const senderConnections = sender.connections || [];

        const rIndex = receiverConnections.findIndex(c => c.userId === senderId && c.status === 'pending');
        const sIndex = senderConnections.findIndex(c => c.userId === receiverId && c.status === 'pending');

        if (rIndex === -1 || sIndex === -1) {
            return res.status(400).json({ message: 'Pending request not found' });
        }

        // Update to accepted
        receiverConnections[rIndex].status = 'accepted';
        senderConnections[sIndex].status = 'accepted';

        db.updateUser(receiverId, { connections: receiverConnections });
        db.updateUser(senderId, { connections: senderConnections });

        res.json({ message: 'Connection accepted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const getConnections = (req, res) => {
    try {
        const userId = req.user.id;
        const user = db.findUserById(userId);
        const allUsers = db.getUsers();

        const connections = (user.connections || []).map(conn => {
            const connectedUser = allUsers.find(u => u.id === conn.userId);
            return {
                ...conn,
                name: connectedUser ? connectedUser.name : 'Unknown User',
                label: connectedUser ? connectedUser.label : null,
                category: connectedUser ? connectedUser.category : null
            };
        });

        res.json(connections);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const getChatHistory = (req, res) => {
    try {
        const userId = req.user.id;
        const { targetId } = req.params;
        
        // Ensure they are connected first
        const user = db.findUserById(userId);
        const isConnected = user.connections && user.connections.some(c => c.userId === targetId && c.status === 'accepted');
        
        if (!isConnected) {
            return res.status(403).json({ message: 'Must be connected to view chat history' });
        }

        const messages = db.getMessagesBetweenUsers(userId, targetId);
        res.json(messages);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error fetching chat history' });
    }
}

const addPortfolioItem = (req, res) => {
    try {
        const userId = req.user.id;
        const { title, description, link } = req.body;
        
        const user = db.findUserById(userId);
        const portfolio = user.portfolio || [];
        portfolio.push({ title, description, link });
        
        db.updateUser(userId, { portfolio });
        res.status(201).json({ message: 'Portfolio item added', portfolio });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error adding portfolio item' });
    }
};

const endorseSkill = (req, res) => {
    try {
        const userId = req.user.id;
        const { targetId } = req.params;
        const { skill } = req.body;

        if (!skill) return res.status(400).json({ message: "Skill required" });

        const targetUser = db.findUserById(targetId);
        if (!targetUser) return res.status(404).json({ message: 'User not found' });

        // Format: { "react": 1 }
        const endorsements = targetUser.endorsements || {};
        const lowerSkill = skill.toLowerCase();
        
        if (!endorsements[lowerSkill]) endorsements[lowerSkill] = 0;
        endorsements[lowerSkill] += 1;

        // Log activity
        const activity = targetUser.activityLog || [];
        const endorser = db.findUserById(userId);
        activity.unshift({
            type: 'endorsement',
            message: `${endorser ? endorser.name : 'Someone'} endorsed you for "${skill}"`,
            timestamp: new Date().toISOString()
        });

        db.updateUser(targetId, { endorsements, activityLog: activity.slice(0, 50) });
        res.json({ message: `Endorsed ${targetUser.name} for ${skill}`, endorsements });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error endorsing skill' });
    }
};

const saveInterviewScore = (req, res) => {
    try {
        const userId = req.user.id;
        const { company, score } = req.body;
        const user = db.findUserById(userId);

        if (!user) return res.status(404).json({ message: 'User not found' });

        const history = user.interviewHistory || [];
        history.push({
            company,
            score,
            date: new Date().toISOString()
        });

        // Log activity
        const activity = user.activityLog || [];
        activity.unshift({
            type: 'interview',
            message: `Completed a ${company} mock interview with score ${score}/100`,
            timestamp: new Date().toISOString()
        });

        db.updateUser(userId, { 
            interviewHistory: history, 
            activityLog: activity.slice(0, 50) 
        });

        res.json({ message: 'Interview score saved', history });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error saving interview score' });
    }
};

const getLeaderboard = (req, res) => {
    try {
        const allUsers = db.getUsers();

        const leaderboard = allUsers.map(u => {
            const acceptedConnections = (u.connections || []).filter(c => c.status === 'accepted').length;
            const totalEndorsements = Object.values(u.endorsements || {}).reduce((sum, v) => sum + v, 0);
            const interviewSessions = (u.interviewHistory || []).length;
            const avgInterviewScore = interviewSessions > 0
                ? Math.round((u.interviewHistory || []).reduce((sum, h) => sum + h.score, 0) / interviewSessions)
                : 0;
            const portfolioCount = (u.portfolio || []).length;

            // Composite score for ranking
            const compositeScore = (u.atsScore || 0) 
                + (acceptedConnections * 10) 
                + (totalEndorsements * 5) 
                + (avgInterviewScore) 
                + (portfolioCount * 8);

            return {
                id: u.id,
                name: u.name,
                category: u.category || 'General',
                atsScore: u.atsScore || 0,
                connections: acceptedConnections,
                endorsements: totalEndorsements,
                interviewSessions,
                avgInterviewScore,
                portfolioCount,
                compositeScore
            };
        });

        leaderboard.sort((a, b) => b.compositeScore - a.compositeScore);

        // Assign ranks
        leaderboard.forEach((entry, index) => {
            entry.rank = index + 1;
        });

        res.json(leaderboard);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching leaderboard' });
    }
};

const getActivityFeed = (req, res) => {
    try {
        const userId = req.user.id;
        const user = db.findUserById(userId);

        if (!user) return res.status(404).json({ message: 'User not found' });

        const activity = user.activityLog || [];

        // Also check for recent connection events
        const connections = user.connections || [];
        const recentAccepted = connections
            .filter(c => c.status === 'accepted')
            .map(c => {
                const other = db.findUserById(c.userId);
                return {
                    type: 'connection',
                    message: `You are now connected with ${other ? other.name : 'a user'}`,
                    timestamp: null // We don't track connection timestamps yet
                };
            });

        // Merge and sort (activity log has timestamps)
        const combined = [...activity, ...recentAccepted.slice(0, 5)]
            .filter(a => a.timestamp)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 20);

        res.json(combined);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching activity feed' });
    }
};

module.exports = { 
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
};
