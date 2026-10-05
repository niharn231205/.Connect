checkAuth();

document.addEventListener('DOMContentLoaded', async () => {
    await init();
});

const init = async () => {
    const connections = await fetchConnections();
    await loadRecommendations(connections);
    renderSidebar(connections);
};

const fetchConnections = async () => {
    try {
        const res = await fetch(`${API_URL}/users/connections`, {
            headers: getAuthHeaders()
        });
        return await res.json();
    } catch (error) {
        console.error("Fetch connections error:", error);
        return [];
    }
};

const loadRecommendations = async (myConnections) => {
    try {
        const res = await fetch(`${API_URL}/users/recommendations`, {
            headers: getAuthHeaders()
        });
        
        if (res.status === 401) {
            logout();
            return;
        }

        const users = await res.json();
        const grid = document.getElementById('connections-grid');
        
        if (users.length === 0) {
            grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--text-secondary);">No matches found right now. Check back later!</div>`;
            return;
        }
        
        grid.innerHTML = users.map(user => {
            const connection = myConnections.find(c => c.userId === user.id);
            let buttonHtml = `<button onclick="sendRequest('${user.id}')" class="btn btn-primary btn-block" style="margin-top: 1rem; padding: 0.8rem;">Request Connection</button>`;
            
            if (connection) {
                if (connection.status === 'accepted') {
                    buttonHtml = `<button class="btn btn-secondary btn-block" disabled style="margin-top: 1rem; opacity: 0.6; cursor: default;">Connected</button>`;
                } else if (connection.direction === 'sent') {
                    buttonHtml = `<button class="btn btn-secondary btn-block" disabled style="margin-top: 1rem; opacity: 0.6; cursor: default;">Request Sent</button>`;
                } else {
                    buttonHtml = `<button onclick="acceptRequest('${user.id}')" class="btn btn-primary btn-block" style="margin-top: 1rem;">Accept Request</button>`;
                }
            }

            // Generate a more professional role title
            let roleTitle = user.category;
            if (roleTitle.includes('Developer')) roleTitle = "Full-Stack Engineer";
            if (roleTitle.includes('Beginner')) roleTitle = "Associate " + roleTitle.replace(' (Beginner)', '');
            if (roleTitle.includes('Designer')) roleTitle = "Product Designer";

            return `
                <div class="glass-card" style="padding: 1.5rem; transition: transform 0.3s; height: 100%; display: flex; flex-direction: column;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.8rem;">
                        <h3 style="margin-bottom: 0;">${user.name}</h3>
                        ${user.label ? `<span class="tag" style="background: var(--accent); color: #000; border: none; font-weight: 800; font-size: 0.7rem; padding: 0.2rem 0.5rem;">${user.label}</span>` : ''}
                    </div>
                    <p style="color: var(--warning); font-size: 0.8rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.5rem;">${roleTitle}</p>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); flex: 1; margin-bottom: 1rem;">Specializing in ${user.field} with focus on ${user.interests.slice(0, 2).join(' & ')}.</p>
                    <div style="display: flex; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 1rem;">
                        ${user.interests.map(i => `<span class="tag" style="font-size: 0.7rem; padding: 0.2rem 0.4rem;">${i}</span>`).slice(0, 3).join('')}
                    </div>
                    ${buttonHtml}
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error("Recommendations error:", error);
        document.getElementById('connections-grid').innerHTML = `<p class="error">Failed to load recommendations.</p>`;
    }
};

const renderSidebar = (connections) => {
    const pendingRequests = connections.filter(c => c.status === 'pending' && c.direction === 'received');
    const activeNetwork = connections.filter(c => c.status === 'accepted');

    const pendingContainer = document.getElementById('pending-requests');
    const activeContainer = document.getElementById('active-network');

    // Render Pending
    if (pendingRequests.length > 0) {
        pendingContainer.innerHTML = pendingRequests.map(req => `
            <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); padding: 0.75rem; border-radius: 10px;">
                <div>
                    <div style="font-weight: 600; font-size: 0.9rem;">${req.name}</div>
                    <div style="font-size: 0.75rem; color: var(--text-secondary);">${req.label || req.category || ''}</div>
                </div>
                <button onclick="acceptRequest('${req.userId}')" class="btn btn-primary" style="padding: 0.3rem 0.8rem; font-size: 0.75rem;">Accept</button>
            </div>
        `).join('');
    } else {
        pendingContainer.innerHTML = `<p style="font-size: 0.85rem; color: var(--text-secondary);">No pending requests.</p>`;
    }

    // Render Active
    if (activeNetwork.length > 0) {
        activeContainer.innerHTML = activeNetwork.map(conn => `
            <div style="display: flex; align-items: center; gap: 0.75rem; background: rgba(255,255,255,0.03); padding: 0.75rem; border-radius: 10px;">
                <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--accent); color: #000; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.8rem;">
                    ${conn.name.charAt(0)}
                </div>
                <div>
                    <div style="font-weight: 600; font-size: 0.9rem;">${conn.name}</div>
                    <div style="font-size: 0.75rem; color: var(--text-secondary);">${conn.label || conn.category || ''}</div>
                </div>
            </div>
        `).join('');
    } else {
        activeContainer.innerHTML = `<p style="font-size: 0.85rem; color: var(--text-secondary);">Start connecting to see your network grow!</p>`;
    }
};

const sendRequest = async (userId) => {
    try {
        const res = await fetch(`${API_URL}/users/connect/${userId}`, {
            method: 'POST',
            headers: getAuthHeaders()
        });
        const data = await res.json();
        if (res.ok) {
            showMessage('message-box', 'Request sent successfully!', false);
            init(); // Refresh UI
        } else {
            showMessage('message-box', data.message || "Failed to send request", true);
        }
    } catch (error) {
        console.error("Connect error:", error);
    }
};

const acceptRequest = async (userId) => {
    try {
        const res = await fetch(`${API_URL}/users/connect/accept/${userId}`, {
            method: 'POST',
            headers: getAuthHeaders()
        });
        const data = await res.json();
        if (res.ok) {
            showMessage('message-box', 'Connection accepted!', false);
            init(); // Refresh UI
        } else {
            showMessage('message-box', data.message || "Failed to accept request", true);
        }
    } catch (error) {
        console.error("Accept error:", error);
    }
}; window.sendRequest = sendRequest; window.acceptRequest = acceptRequest;
