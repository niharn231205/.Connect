document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    // Decode token to get user ID safely
    const payloadInfo = JSON.parse(atob(token.split('.')[1]));
    const myId = payloadInfo.id;

    // Connect socket
    const socket = io();
    socket.emit('join_self', myId);

    const connectionsList = document.getElementById('connectionsList');
    const chatWindow = document.getElementById('chatWindow');

    let currentChatUserId = null;
    let connections = [];

    // Load connections
    async function loadConnections() {
        try {
            const res = await fetch('/api/users/connections', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            
            // Filter only accepted connections
            connections = data.filter(c => c.status === 'accepted');
            
            if (connections.length === 0) {
                connectionsList.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--text-muted);">No accepted connections yet. Go to Dashboard and connect with someone!</div>`;
                return;
            }

            renderConnections();
        } catch (err) {
            console.error(err);
            connectionsList.innerHTML = `<div style="color: red; padding: 1rem;">Failed to load connections.</div>`;
        }
    }

    function renderConnections() {
        connectionsList.innerHTML = '';
        connections.forEach(conn => {
            const li = document.createElement('li');
            li.className = `connection-item ${currentChatUserId === conn.userId ? 'active' : ''}`;
            li.onclick = () => openChat(conn);
            
            const initial = conn.name.charAt(0).toUpperCase();

            li.innerHTML = `
                <div class="connection-avatar">${initial}</div>
                <div class="connection-info">
                    <h4>${conn.name}</h4>
                    <p>${conn.label || conn.category || 'Professional'}</p>
                </div>
            `;
            connectionsList.appendChild(li);
        });
    }

    async function openChat(conn) {
        currentChatUserId = conn.userId;
        renderConnections(); // update active state

        // Setup Chat UI
        const initial = conn.name.charAt(0).toUpperCase();
        chatWindow.innerHTML = `
            <div class="chat-header">
                <div class="connection-avatar">${initial}</div>
                <div>
                    <h3 style="margin: 0; font-size: 1.1rem">${conn.name}</h3>
                    <p style="margin: 0; font-size: 0.8rem; color: var(--text-muted)">${conn.label || 'Professional'}</p>
                </div>
            </div>
            <div class="chat-messages" id="chatMessages">
                <!-- Messages go here -->
            </div>
            <div class="chat-input-area">
                <input type="text" class="chat-input" id="messageInput" placeholder="Type a message..." autocomplete="off">
                <button class="send-btn" id="sendBtn"><i class="fas fa-paper-plane"></i></button>
            </div>
        `;

        // Fetch history
        try {
            const res = await fetch(`/api/users/chat/${conn.userId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const messages = await res.json();
            
            const msgContainer = document.getElementById('chatMessages');
            if (messages.length > 0) {
                messages.forEach(msg => {
                    appendMessageUI(msg);
                });
            } else {
                msgContainer.innerHTML = '<div style="text-align: center; color: var(--text-muted); margin-top: 2rem;">Say hello!</div>';
            }
            scrollToBottom();
        } catch (err) {
            console.error("Failed to load chat history", err);
        }

        // Add event listeners for new inputs
        document.getElementById('sendBtn').onclick = sendMessage;
        document.getElementById('messageInput').onkeypress = (e) => {
            if (e.key === 'Enter') sendMessage();
        };
    }

    function appendMessageUI(msg) {
        const msgContainer = document.getElementById('chatMessages');
        // Remove "Say hello" if present
        if (msgContainer.innerHTML.includes('Say hello!')) {
            msgContainer.innerHTML = '';
        }

        const isOutgoing = msg.senderId === myId;
        
        // Create wrapper to align left/right properly
        const wrapperDiv = document.createElement('div');
        wrapperDiv.className = `message-wrapper ${isOutgoing ? 'outgoing' : 'incoming'}`;
        
        // Create message bubble
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${isOutgoing ? 'outgoing' : 'incoming'}`;
        
        const time = new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        msgDiv.innerHTML = `
            ${msg.text}
            <span class="timestamp">${time} ${isOutgoing ? '<i class="fas fa-check-double tick"></i>' : ''}</span>
        `;
        
        wrapperDiv.appendChild(msgDiv);
        msgContainer.appendChild(wrapperDiv);
        scrollToBottom();
    }

    function scrollToBottom() {
        const msgContainer = document.getElementById('chatMessages');
        if(msgContainer) msgContainer.scrollTop = msgContainer.scrollHeight;
    }

    function sendMessage() {
        const input = document.getElementById('messageInput');
        const text = input.value.trim();
        if (!text || !currentChatUserId) return;

        input.value = '';
        
        const data = {
            senderId: myId,
            receiverId: currentChatUserId,
            text
        };

        // Emit through socket
        socket.emit('send_message', data);
    }

    // Socket message listeners
    socket.on('receive_message', (msg) => {
        // If chat is currently open with the sender
        if (msg.senderId === currentChatUserId) {
            appendMessageUI(msg);
        } else {
            // Need a notification UI eventually
            console.log('New message from', msg.senderId);
        }
    });

    socket.on('message_sent', (msg) => {
        if (msg.receiverId === currentChatUserId) {
            appendMessageUI(msg);
        }
    });

    // Start
    loadConnections();
});
