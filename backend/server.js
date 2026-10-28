const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*"
    }
});

app.use(cors());
app.use(express.json());
// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend')));
// Resume files contain personal data; do not serve the upload directory publicly.

// Initialize upload folder if missing
if (!fs.existsSync(path.join(__dirname, 'uploads'))) {
    fs.mkdirSync(path.join(__dirname, 'uploads'));
}

// Routes
const authRoutes = require('./routes/authRoutes');
const resumeRoutes = require('./routes/resumeRoutes');
const userRoutes = require('./routes/userRoutes');
const jobRoutes = require('./routes/jobRoutes');
const interviewRoutes = require('./routes/interviewRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/resume', resumeRoutes);
app.use('/api/users', userRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/interview', interviewRoutes);

// Socket.IO logic
const { saveMessage } = require('./data/database');

io.on('connection', (socket) => {
    console.log('New client connected', socket.id);
    
    // Join a private room for the user to receive direct messages
    socket.on('join_self', (userId) => {
        socket.join(userId);
    });

    socket.on('send_message', (data) => {
        // data should have { senderId, receiverId, text }
        const savedMessage = saveMessage(data.senderId, data.receiverId, data.text);
        // emit back to sender to confirm, and to receiver
        io.to(data.receiverId).emit('receive_message', savedMessage);
        io.to(data.senderId).emit('message_sent', savedMessage);
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected', socket.id);
    });
});

// Catch-all: serve frontend index.html for any unmatched GET requests (Express 5 compatible)
app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
        return res.sendFile(path.join(__dirname, '../frontend/index.html'));
    }
    next();
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
