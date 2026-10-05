const fs = require('fs');
const path = require('path');

const dataFile = path.join(__dirname, 'users.json');

// Initialize data file if it doesn't exist
if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify([]));
}

const getUsers = () => {
    try {
        const data = fs.readFileSync(dataFile, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return [];
    }
};

const saveUsers = (users) => {
    fs.writeFileSync(dataFile, JSON.stringify(users, null, 2));
};

const findUserByEmail = (email) => {
    const users = getUsers();
    return users.find(u => u.email === email);
};

const findUserById = (id) => {
    const users = getUsers();
    return users.find(u => u.id === id);
};

const createUser = (userData) => {
    const users = getUsers();
    const newUser = {
        id: Date.now().toString() + Math.random().toString(36).substring(2),
        ...userData
    };
    users.push(newUser);
    saveUsers(users);
    return newUser;
};

const updateUser = (id, updateData) => {
    const users = getUsers();
    const index = users.findIndex(u => u.id === id);
    if (index !== -1) {
        users[index] = { ...users[index], ...updateData };
        saveUsers(users);
        return users[index];
    }
    return null;
};

const chatsFile = path.join(__dirname, 'chats.json');

// Initialize chats file if it doesn't exist
if (!fs.existsSync(chatsFile)) {
    fs.writeFileSync(chatsFile, JSON.stringify([]));
}

const getChats = () => {
    try {
        const data = fs.readFileSync(chatsFile, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return [];
    }
};

const saveChats = (chats) => {
    fs.writeFileSync(chatsFile, JSON.stringify(chats, null, 2));
};

const saveMessage = (senderId, receiverId, text) => {
    const chats = getChats();
    const newMessage = {
        id: Date.now().toString() + Math.random().toString(36).substring(2),
        senderId,
        receiverId,
        text,
        timestamp: new Date().toISOString()
    };
    chats.push(newMessage);
    saveChats(chats);
    return newMessage;
};

const getMessagesBetweenUsers = (userId1, userId2) => {
    const chats = getChats();
    return chats.filter(msg => 
        (msg.senderId === userId1 && msg.receiverId === userId2) ||
        (msg.senderId === userId2 && msg.receiverId === userId1)
    ).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
};

module.exports = {
    getUsers,
    findUserByEmail,
    findUserById,
    createUser,
    updateUser,
    saveMessage,
    getMessagesBetweenUsers
};
