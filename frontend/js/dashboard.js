checkAuth();

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const res = await fetch(`${API_URL}/users/dashboard`, {
            headers: getAuthHeaders()
        });
        
        if (res.status === 401) {
            logout();
            return;
        }

        const data = await res.json();
        
        // --- Welcome & Quick Stats ---
        document.getElementById('welcome-msg').textContent = `Welcome back, ${data.name}!`;
        document.getElementById('qs-ats').textContent = data.atsScore || 0;
        document.getElementById('qs-interviews').textContent = (data.interviewHistory || []).length;
        
        const totalEndorsements = Object.values(data.endorsements || {}).reduce((s, v) => s + v, 0);
        document.getElementById('qs-endorsements').textContent = totalEndorsements;

        // We need connections count - approximate from answers
        document.getElementById('qs-connections').textContent = '—';

        // Fetch connections count
        try {
            const connRes = await fetch(`${API_URL}/users/connections`, { headers: getAuthHeaders() });
            const connData = await connRes.json();
            const accepted = connData.filter(c => c.status === 'accepted').length;
            document.getElementById('qs-connections').textContent = accepted;
        } catch(e) { /* ignore */ }

        // --- ATS Gauge ---
        document.getElementById('ats-number').textContent = data.atsScore || 0;
        document.getElementById('user-category').textContent = data.category || 'Not Set';
        document.getElementById('user-label').textContent = data.label || 'Complete questionnaire';
        drawAtsGauge(data.atsScore || 0);

        // --- Skill Radar Chart ---
        if (data.skillBreakdown) {
            const labels = Object.keys(data.skillBreakdown);
            const values = Object.values(data.skillBreakdown);
            
            new Chart(document.getElementById('skillRadarChart'), {
                type: 'radar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Your Skills',
                        data: values,
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245, 158, 11, 0.15)',
                        borderWidth: 2,
                        pointBackgroundColor: '#f59e0b',
                        pointBorderColor: '#fff',
                        pointRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    plugins: { legend: { display: false } },
                    scales: {
                        r: {
                            beginAtZero: true,
                            max: 100,
                            ticks: {
                                stepSize: 20,
                                color: '#a8a29e',
                                backdropColor: 'transparent',
                                font: { size: 10 }
                            },
                            grid: { color: 'rgba(255,255,255,0.08)' },
                            angleLines: { color: 'rgba(255,255,255,0.08)' },
                            pointLabels: {
                                color: '#fafaf9',
                                font: { size: 11, weight: '500' }
                            }
                        }
                    }
                }
            });
        }

        // --- Interview History Line Chart ---
        const history = data.interviewHistory || [];
        if (history.length > 0) {
            const chartLabels = history.map((h, i) => h.company + ' #' + (i + 1));
            const chartData = history.map(h => h.score);

            new Chart(document.getElementById('interviewLineChart'), {
                type: 'line',
                data: {
                    labels: chartLabels,
                    datasets: [{
                        label: 'Score',
                        data: chartData,
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: '#f59e0b',
                        pointBorderColor: '#fff',
                        pointRadius: 5,
                        pointHoverRadius: 7
                    }]
                },
                options: {
                    responsive: true,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100,
                            ticks: { color: '#a8a29e', font: { size: 10 } },
                            grid: { color: 'rgba(255,255,255,0.05)' }
                        },
                        x: {
                            ticks: { color: '#a8a29e', font: { size: 10 }, maxRotation: 45 },
                            grid: { display: false }
                        }
                    }
                }
            });
        } else {
            document.getElementById('interviewLineChart').style.display = 'none';
            document.getElementById('noInterviewMsg').style.display = 'block';
        }

        // --- Suggestions ---
        const suggestionsBox = document.getElementById('suggestions-box');
        if (data.suggestions && (
            (data.suggestions.missingSkills && data.suggestions.missingSkills.length) ||
            data.suggestions.formatting ||
            (data.suggestions.keywordsToAdd && data.suggestions.keywordsToAdd.length)
        )) {
            const missingSkills = data.suggestions.missingSkills || [];
            const keywordsToAdd = data.suggestions.keywordsToAdd || [];
            const formatting = data.suggestions.formatting || '';

            const checkboxesHtml = missingSkills.map((skill, i) => `
                <label style="display:flex;align-items:center;gap:0.75rem;padding:0.6rem 0.8rem;border-radius:10px;cursor:pointer;transition:background 0.2s;margin-bottom:0.3rem;"
                    onmouseover="this.style.background='rgba(245,158,11,0.05)'" onmouseout="this.style.background='transparent'">
                    <input type="checkbox" id="skill-cb-${i}" style="width:16px;height:16px;accent-color:var(--accent);cursor:pointer;flex-shrink:0;"
                        onchange="toggleSkillDone(this, 'skill-label-${i}')">
                    <span id="skill-label-${i}" style="font-size:0.9rem;transition:all 0.2s;">
                        <i class="fas fa-circle-plus" style="color:#ef4444;margin-right:0.3rem;font-size:0.8rem;"></i>${skill}
                    </span>
                </label>
            `).join('');

            const keywordsHtml = keywordsToAdd.length
                ? keywordsToAdd.map(kw => `<span style="display:inline-block;padding:0.3rem 0.7rem;border-radius:20px;font-size:0.8rem;background:rgba(245,158,11,0.08);color:var(--accent);border:1px solid rgba(245,158,11,0.2);margin:3px;">${kw}</span>`).join('')
                : '<span style="color:var(--text-secondary);font-size:0.85rem;">No additional keywords needed.</span>';

            suggestionsBox.innerHTML = `
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;">
                    <div>
                        <h4 style="font-size:0.9rem;margin-bottom:0.75rem;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.05em;">
                            <i class="fas fa-list-check" style="color:var(--accent);"></i> Missing Skills Checklist
                        </h4>
                        ${missingSkills.length ? checkboxesHtml : '<p style="color:#10b981;font-size:0.9rem;"><i class="fas fa-circle-check"></i> None — Resume looks complete!</p>'}
                    </div>
                    <div>
                        <h4 style="font-size:0.9rem;margin-bottom:0.75rem;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.05em;">
                            <i class="fas fa-tags" style="color:var(--accent);"></i> Keywords to Add
                        </h4>
                        <div style="line-height:2;">${keywordsHtml}</div>
                        ${formatting ? `
                        <div style="margin-top:1.2rem;padding:0.75rem;background:rgba(255,255,255,0.02);border-radius:10px;border:1px solid var(--glass-border);">
                            <span style="font-size:0.78rem;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:0.05em;"><i class="fas fa-info-circle"></i> Note</span>
                            <p style="font-size:0.85rem;color:var(--text-secondary);margin:0.4rem 0 0;">${formatting}</p>
                        </div>` : ''}
                    </div>
                </div>
                <div style="margin-top:1.5rem;padding-top:1.5rem;border-top:1px solid var(--glass-border);display:flex;gap:1rem;">
                    <a href="/resume.html" class="btn btn-secondary" style="font-size:0.85rem;padding:0.5rem 1rem;border:none;">
                        <i class="fas fa-upload"></i> Re-Upload Resume
                    </a>
                    <a href="/matcher.html" class="btn btn-primary" style="font-size:0.85rem;padding:0.5rem 1rem;">
                        <i class="fas fa-arrows-left-right"></i> Match to a Job Description
                    </a>
                </div>
            `;
        } else if (data.resume) {
            suggestionsBox.innerHTML = `<p style="color:#10b981;"><i class="fas fa-circle-check"></i> Resume analyzed — no major suggestions. <a href="/matcher.html" style="color:var(--accent);">Match it to a job now.</a></p>`;
        }


        // --- Companies ---
        const companiesBox = document.getElementById('companies-box');
        if (data.suggestedCompanies) {
            companiesBox.innerHTML = data.suggestedCompanies.map(company => `
                <div class="tag" style="padding: 0.5rem 1rem; font-size: 1rem; cursor: pointer; border: 1px solid var(--accent);">
                    ${company}
                </div>
            `).join('');
        }

        // --- Activity Feed ---
        loadActivityFeed();

        // --- Roadmap Rendering ---
        if (data.roadmap) {
            renderRoadmap(data.roadmap);
        }

    } catch (error) {
        console.error("Dashboard error:", error);
    }
});

// ATS Gauge Drawing (Custom Canvas)
function drawAtsGauge(score) {
    const canvas = document.getElementById('atsGauge');
    const ctx = canvas.getContext('2d');
    const size = 160;
    const center = size / 2;
    const radius = 65;
    const lineWidth = 12;

    ctx.clearRect(0, 0, size, size);

    // Background ring
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = lineWidth;
    ctx.stroke();

    // Score ring (animated)
    const endAngle = (score / 100) * Math.PI * 2 - Math.PI / 2;
    let currentAngle = -Math.PI / 2;
    const step = (endAngle - currentAngle) / 60;
    let frame = 0;

    function animate() {
        if (frame >= 60) return;
        frame++;
        currentAngle += step;

        ctx.clearRect(0, 0, size, size);
        // Background
        ctx.beginPath();
        ctx.arc(center, center, radius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = lineWidth;
        ctx.stroke();
        // Score
        ctx.beginPath();
        ctx.arc(center, center, radius, -Math.PI / 2, currentAngle);
        const gradient = ctx.createLinearGradient(0, 0, size, size);
        gradient.addColorStop(0, '#f59e0b');
        gradient.addColorStop(1, '#d97706');
        ctx.strokeStyle = gradient;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.stroke();

        requestAnimationFrame(animate);
    }
    animate();
}

// Activity Feed
async function loadActivityFeed() {
    try {
        const res = await fetch(`${API_URL}/users/activity`, { headers: getAuthHeaders() });
        const activities = await res.json();
        
        const feedEl = document.getElementById('activityFeed');
        
        if (!activities.length) {
            feedEl.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                    <i class="fas fa-bell-slash" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.3;"></i>
                    <p>No recent activity yet. Start connecting and practicing!</p>
                </div>
            `;
            return;
        }

        feedEl.innerHTML = activities.map(a => {
            const iconClass = a.type === 'interview' ? 'interview' : a.type === 'endorsement' ? 'endorsement' : 'connection';
            const icon = a.type === 'interview' ? 'fa-robot' : a.type === 'endorsement' ? 'fa-star' : 'fa-user-plus';
            const timeAgo = getTimeAgo(a.timestamp);

            return `
                <div class="activity-item">
                    <div class="activity-icon ${iconClass}"><i class="fas ${icon}"></i></div>
                    <div>
                        <div class="activity-text">${a.message}</div>
                        <div class="activity-time">${timeAgo}</div>
                    </div>
                </div>
            `;
        }).join('');
    } catch(e) {
        console.error("Activity feed error:", e);
    }
}

function getTimeAgo(timestamp) {
    if (!timestamp) return '';
    const seconds = Math.floor((new Date() - new Date(timestamp)) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
    return Math.floor(seconds / 86400) + 'd ago';
}

function renderRoadmap(roadmap) {
    const container = document.getElementById('roadmap-container');
    if (!container) return;
    container.innerHTML = '';

    let completedPoints = 0;
    let totalPoints = 0;

    roadmap.forEach(item => {
        totalPoints += item.points;
        if (item.completed) completedPoints += item.points;

        const itemDiv = document.createElement('div');
        itemDiv.style.cssText = `
            display: flex;
            align-items: center;
            gap: 1rem;
            padding: 0.8rem;
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid var(--glass-border);
            border-radius: 12px;
            transition: all 0.3s;
        `;

        const checkIcon = item.completed ? 
            `<i class="fas fa-check-circle" style="color: var(--success); font-size: 1.2rem;"></i>` : 
            `<i class="far fa-circle" style="color: var(--text-secondary); font-size: 1.2rem; opacity: 0.5;"></i>`;

        itemDiv.innerHTML = `
            ${checkIcon}
            <div style="flex: 1;">
                <p style="font-size: 0.9rem; color: ${item.completed ? 'var(--text-secondary)' : 'var(--text-primary)'}; ${item.completed ? 'text-decoration: line-through; opacity: 0.6;' : ''}">${item.text}</p>
            </div>
            <span style="font-size: 0.75rem; font-weight: 700; color: var(--accent); opacity: 0.8;">+${item.points} XP</span>
        `;
        
        container.appendChild(itemDiv);
    });

    // Update Progress Bar
    const progressPercent = Math.round((completedPoints / totalPoints) * 100);
    const progressBar = document.getElementById('roadmap-progress-bar');
    const xpLabel = document.getElementById('roadmap-xp');
    
    if (progressBar) progressBar.style.width = `${progressPercent}%`;
    if (xpLabel) xpLabel.innerText = `${completedPoints} / ${totalPoints} XP`;
}

// Toggle skill checklist item as done
function toggleSkillDone(checkbox, labelId) {
    const label = document.getElementById(labelId);
    if (!label) return;
    if (checkbox.checked) {
        label.style.textDecoration = 'line-through';
        label.style.opacity = '0.45';
        label.querySelector('i').style.color = '#10b981';
        label.querySelector('i').className = 'fas fa-circle-check';
    } else {
        label.style.textDecoration = 'none';
        label.style.opacity = '1';
        label.querySelector('i').style.color = '#ef4444';
        label.querySelector('i').className = 'fas fa-circle-plus';
    }
}

