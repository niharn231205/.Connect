checkAuth();

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Get current user ID from token
        const token = localStorage.getItem('token');
        const payload = JSON.parse(atob(token.split('.')[1]));
        const currentUserId = payload.id;

        const res = await fetch(`${API_URL}/users/leaderboard`, {
            headers: getAuthHeaders()
        });

        if (res.status === 401) {
            logout();
            return;
        }

        const leaderboard = await res.json();

        // --- Your Rank Banner ---
        const myEntry = leaderboard.find(e => e.id === currentUserId);
        if (myEntry) {
            document.getElementById('yourRankBanner').style.display = 'flex';
            document.getElementById('yourRankNumber').textContent = `#${myEntry.rank}`;
            document.getElementById('yourCompositeScore').textContent = myEntry.compositeScore;
        }

        // --- Podium (Top 3) ---
        const podiumEl = document.getElementById('podium');
        const medals = ['🥇', '🥈', '🥉'];
        const classes = ['gold', 'silver', 'bronze'];
        const podiumOrder = [1, 0, 2]; // Silver, Gold, Bronze (Gold in center)

        const top3 = leaderboard.slice(0, 3);
        
        if (top3.length >= 3) {
            podiumEl.innerHTML = podiumOrder.map(i => {
                const entry = top3[i];
                if (!entry) return '';
                return `
                    <div class="podium-card ${classes[i]}">
                        <div class="podium-medal">${medals[i]}</div>
                        <div class="podium-name">${entry.name}</div>
                        <div class="podium-category">${entry.category}</div>
                        <div class="podium-score">${entry.compositeScore}</div>
                        <div class="podium-score-label">Composite Score</div>
                    </div>
                `;
            }).join('');
        } else {
            // Less than 3 users
            podiumEl.innerHTML = top3.map((entry, i) => `
                <div class="podium-card ${classes[i]}">
                    <div class="podium-medal">${medals[i]}</div>
                    <div class="podium-name">${entry.name}</div>
                    <div class="podium-category">${entry.category}</div>
                    <div class="podium-score">${entry.compositeScore}</div>
                    <div class="podium-score-label">Composite Score</div>
                </div>
            `).join('');
        }

        // --- Full Rankings Table ---
        const tbody = document.getElementById('rankingsBody');
        
        if (leaderboard.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 2rem; color: var(--text-secondary);">No users found yet.</td></tr>';
            return;
        }

        tbody.innerHTML = leaderboard.map(entry => {
            const isCurrentUser = entry.id === currentUserId;
            return `
                <tr class="${isCurrentUser ? 'current-user-row' : ''}">
                    <td><span class="rank-badge">${entry.rank}</span></td>
                    <td style="font-weight: 600;">${entry.name} ${isCurrentUser ? '<span style="color: var(--accent); font-size: 0.75rem;">(You)</span>' : ''}</td>
                    <td><span class="stat-pill">${entry.category}</span></td>
                    <td>${entry.atsScore}</td>
                    <td>${entry.connections}</td>
                    <td>${entry.endorsements}</td>
                    <td>${entry.interviewSessions}</td>
                    <td style="font-weight: 700; color: var(--accent);">${entry.compositeScore}</td>
                </tr>
            `;
        }).join('');

    } catch (error) {
        console.error("Leaderboard error:", error);
    }
});
