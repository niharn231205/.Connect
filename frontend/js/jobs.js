document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    async function loadJobs() {
        try {
            // First check if user has filled in field/experience
            const profileRes = await fetch('/api/users/dashboard', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const profileData = await profileRes.json();

            if (!profileData.answers || !profileData.answers.field || !profileData.answers.experienceLevel) {
                document.getElementById('personalizationModal').style.display = 'flex';
            }

            const res = await fetch('/api/jobs', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const jobs = await res.json();
            
            const jobList = document.getElementById('jobList');
            jobList.innerHTML = '';

            if (jobs.length === 0) {
                jobList.innerHTML = '<p style="text-align:center; color: var(--text-muted);">No jobs found at the moment.</p>';
                return;
            }

            // Sort by match percentage
            jobs.sort((a,b) => b.matchPercentage - a.matchPercentage);

            jobs.forEach(job => {
                let matchClass = 'match-low';
                let matchLabel = 'Growing Match';
                if (job.matchPercentage >= 70) {
                    matchClass = 'match-high';
                    matchLabel = 'Top Choice';
                } else if (job.matchPercentage >= 40) {
                    matchClass = 'match-medium';
                    matchLabel = 'Strong Fit';
                }

                // Format tags
                const tagsHtml = job.keywords.map(kw => `<span>${kw}</span>`).join('');
                
                let insightHtml = '';
                if (job.missingSkills && job.missingSkills.length > 0) {
                    insightHtml = `
                        <div style="margin-top: 1rem; padding: 0.8rem; background: rgba(245, 158, 11, 0.05); border-radius: 8px; border: 1px dashed rgba(245, 158, 11, 0.2);">
                            <span style="font-size: 0.75rem; color: var(--accent); font-weight: 700; text-transform: uppercase;">Pro Insight:</span>
                            <span style="font-size: 0.85rem; color: var(--text-secondary);"> You're missing <strong>${job.missingSkills.join(', ')}</strong> in your current resume.</span>
                        </div>
                    `;
                }

                const card = document.createElement('div');
                card.className = 'job-card';
                card.innerHTML = `
                    <div class="job-info" style="flex: 1;">
                        <span style="font-size: 0.7rem; color: var(--accent); font-weight: 800; letter-spacing: 1px; text-transform: uppercase;">${matchLabel}</span>
                        <h2 style="margin-top: 0.2rem;">${job.title}</h2>
                        <span class="company-name"><i class="fas fa-building"></i> ${job.company}</span>
                        <p class="description">${job.description}</p>
                        <div class="job-tags">
                            ${tagsHtml}
                        </div>
                        ${insightHtml}
                    </div>
                    <div class="match-score-container">
                        <div class="match-score ${matchClass}">
                            ${job.matchPercentage}%
                        </div>
                        <span style="font-size: 0.8rem; color: var(--text-muted)">Matching Probability</span>
                        <button class="apply-btn" onclick="alert('Application Submitted! Recruiters have been notified of your Pro status.')">One-Click Apply</button>
                    </div>
                `;
                jobList.appendChild(card);
            });

        } catch(err) {
            console.error(err);
            document.getElementById('jobList').innerHTML = '<p style="text-align:center; color: red;">Error loading jobs.</p>';
        }
    }

    const savePersonalizationBtn = document.getElementById('savePersonalizationBtn');
    if (savePersonalizationBtn) {
        savePersonalizationBtn.onclick = async () => {
            const field = document.getElementById('fieldSelect').value;
            const experience = document.getElementById('experienceSelect').value;

            if (!field || !experience) return alert("Please select both field and experience level!");

            try {
                const res = await fetch('/api/users/answers', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ 
                        field: field, 
                        experienceLevel: experience 
                    })
                });

                if (res.ok) {
                    document.getElementById('personalizationModal').style.display = 'none';
                    loadJobs(); // Reload to get updated match percentages
                }
            } catch (err) {
                console.error("Failed to save personalization", err);
            }
        };
    }

    loadJobs();
});
