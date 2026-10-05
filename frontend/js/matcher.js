// Tab switching logic
function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.matcher-section').forEach(sec => sec.classList.remove('active'));
    
    // Find button
    const btn = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.textContent.toLowerCase().includes(tabId.split('-')[1]));
    if (btn) btn.classList.add('active');
    
    const targetSection = document.getElementById(tabId);
    if (targetSection) targetSection.classList.add('active');
}

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    // Single JD Matcher Form
    const singleForm = document.getElementById('single-match-form');
    const placeholder = document.getElementById('matching-placeholder');
    const resultsBox = document.getElementById('matching-results-box');
    const singleError = document.getElementById('single-error');
    
    if (singleForm) {
        singleForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            singleError.style.display = 'none';
            
            const jdText = document.getElementById('jd-text').value;
            const btnMatch = document.getElementById('btn-match');
            
            btnMatch.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing NLP Model...';
            btnMatch.disabled = true;
            
            try {
                const res = await fetch('/api/jobs/match-jd', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ jdText })
                });
                
                const data = await res.json();
                
                if (res.ok) {
                    placeholder.style.display = 'none';
                    resultsBox.style.display = 'block';
                    
                    // Render Score
                    const score = data.matchPercentage || 0;
                    document.getElementById('score-text').textContent = `${score}%`;
                    
                    const scoreCircle = document.getElementById('score-circle');
                    scoreCircle.style.background = `conic-gradient(var(--accent) ${score * 3.6}deg, rgba(255,255,255,0.05) 0deg)`;
                    
                    // Set rating text
                    const ratingText = document.getElementById('match-rating');
                    if (score >= 80) {
                        ratingText.textContent = "Excellent Match! 🚀";
                        ratingText.style.color = "#10b981";
                    } else if (score >= 50) {
                        ratingText.textContent = "Good Fit 👍";
                        ratingText.style.color = "var(--accent)";
                    } else {
                        ratingText.textContent = "Low Relevance ⚠️";
                        ratingText.style.color = "#ef4444";
                    }
                    
                    // Render Matched Skills
                    const matchedContainer = document.getElementById('matched-skills-container');
                    matchedContainer.innerHTML = '';
                    if (data.matchedSkills && data.matchedSkills.length > 0) {
                        data.matchedSkills.forEach(skill => {
                            matchedContainer.innerHTML += `<span class="skill-tag matched"><i class="fas fa-circle-check"></i> ${skill}</span>`;
                        });
                    } else {
                        matchedContainer.innerHTML = '<span style="color: var(--text-secondary); font-size: 0.9rem;">No overlapping skills identified. Try adding skills from the job description.</span>';
                    }
                    
                    // Render Missing Skills
                    const missingContainer = document.getElementById('missing-skills-container');
                    missingContainer.innerHTML = '';
                    if (data.missingSkills && data.missingSkills.length > 0) {
                        data.missingSkills.forEach(skill => {
                            missingContainer.innerHTML += `<span class="skill-tag missing"><i class="fas fa-circle-plus"></i> ${skill}</span>`;
                        });
                    } else {
                        missingContainer.innerHTML = '<span style="color: #10b981; font-size: 0.9rem;">Fantastic! You have all the skills requested in this job description.</span>';
                    }
                    
                    // Render Keywords
                    const keywordsContainer = document.getElementById('jd-keywords-container');
                    keywordsContainer.innerHTML = '';
                    if (data.jdKeywords && data.jdKeywords.length > 0) {
                        data.jdKeywords.forEach(kw => {
                            keywordsContainer.innerHTML += `<span class="tag" style="margin: 0.2rem; background: rgba(255,255,255,0.03); border: 1px solid var(--glass-border);">${kw.text} (${kw.value})</span>`;
                        });
                    } else {
                        keywordsContainer.innerHTML = '<span style="color: var(--text-secondary); font-size: 0.9rem;">None</span>';
                    }
                    
                    // Scroll results into view
                    resultsBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    
                } else {
                    singleError.textContent = data.message || "Failed to calculate match similarity.";
                    singleError.style.display = 'block';
                }
            } catch (err) {
                console.error(err);
                singleError.textContent = "Network error while running NLP analyzer.";
                singleError.style.display = 'block';
            } finally {
                btnMatch.innerHTML = '<i class="fas fa-calculator"></i> Match My Resume';
                btnMatch.disabled = false;
            }
        });
    }

    // Multiple Resume Ranker Form
    const multiForm = document.getElementById('multi-rank-form');
    const leaderboardBox = document.getElementById('leaderboard-results-box');
    const multiError = document.getElementById('multi-error');
    const multiSuccess = document.getElementById('multi-success');
    
    if (multiForm) {
        multiForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            multiError.style.display = 'none';
            multiSuccess.style.display = 'none';
            
            const jdText = document.getElementById('multi-jd-text').value;
            const fileInput = document.getElementById('resumes-files');
            const files = fileInput.files;
            
            if (files.length === 0) {
                multiError.textContent = "Please select at least one resume file.";
                multiError.style.display = 'block';
                return;
            }
            
            const btnRank = document.getElementById('btn-rank');
            btnRank.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing NLP Pipelines...';
            btnRank.disabled = true;
            
            const formData = new FormData();
            formData.append('jobDescription', jdText);
            for (let i = 0; i < files.length; i++) {
                formData.append('resumes', files[i]);
            }
            
            try {
                const res = await fetch('/api/jobs/rank-resumes', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    body: formData
                });
                
                const data = await res.json();
                
                if (res.ok) {
                    leaderboardBox.style.display = 'block';
                    multiSuccess.textContent = `Successfully processed and ranked ${files.length} resumes!`;
                    multiSuccess.style.display = 'block';
                    
                    const tbody = document.getElementById('leaderboard-tbody');
                    tbody.innerHTML = '';
                    
                    if (data.rankings && data.rankings.length > 0) {
                        data.rankings.forEach((candidate, index) => {
                            const rank = index + 1;
                            let rankClass = 'rank-other';
                            if (rank === 1) rankClass = 'rank-1';
                            else if (rank === 2) rankClass = 'rank-2';
                            else if (rank === 3) rankClass = 'rank-3';
                            
                            let matchClass = 'match-low';
                            if (candidate.matchPercentage >= 75) matchClass = 'match-high';
                            else if (candidate.matchPercentage >= 45) matchClass = 'match-medium';
                            
                            const matchedSkillsHtml = candidate.matchedSkills.length > 0
                                ? candidate.matchedSkills.map(s => `<span class="tag" style="background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2); font-size: 0.75rem; margin: 2px;">${s}</span>`).join('')
                                : '<span style="color:var(--text-secondary); font-size:0.8rem">None</span>';
                                
                            const missingSkillsHtml = candidate.missingSkills.length > 0
                                ? candidate.missingSkills.map(s => `<span class="tag" style="background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); font-size: 0.75rem; margin: 2px;">${s}</span>`).join('')
                                : '<span style="color:#10b981; font-size:0.8rem">None</span>';
                            
                            const row = document.createElement('tr');
                            row.innerHTML = `
                                <td>
                                    <div class="rank-badge ${rankClass}">${rank}</div>
                                </td>
                                <td>
                                    <div style="font-weight: 700;">${candidate.candidateName}</div>
                                    <div style="font-size: 0.75rem; color: var(--text-secondary);">${candidate.email}</div>
                                </td>
                                <td>
                                    <div class="tag ${matchClass}" style="font-size: 1rem; font-weight: 800; padding: 0.3rem 0.8rem; display: inline-block;">${candidate.matchPercentage}%</div>
                                </td>
                                <td>
                                    <div style="display: flex; flex-wrap: wrap; max-width: 250px;">${matchedSkillsHtml}</div>
                                </td>
                                <td>
                                    <div style="display: flex; flex-wrap: wrap; max-width: 250px;">${missingSkillsHtml}</div>
                                </td>
                                <td>
                                    <button class="btn btn-secondary" onclick="alert('Interview invitation sent to ${candidate.candidateName}!')" style="padding: 0.4rem 0.8rem; font-size: 0.75rem; border: none; margin-bottom: 5px;">Invite</button>
                                    <button class="btn btn-secondary" onclick="alert('Opening chat room with ${candidate.candidateName}!')" style="padding: 0.4rem 0.8rem; font-size: 0.75rem; border: none;"><i class="fas fa-comments"></i> Chat</button>
                                </td>
                            `;
                            tbody.appendChild(row);
                        });
                    } else {
                        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">No rankings generated.</td></tr>';
                    }
                    
                    leaderboardBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    
                } else {
                    multiError.textContent = data.message || "Failed to process rankings.";
                    multiError.style.display = 'block';
                }
            } catch (err) {
                console.error(err);
                multiError.textContent = "Network error while processing candidate ranker.";
                multiError.style.display = 'block';
            } finally {
                btnRank.innerHTML = '<i class="fas fa-crown"></i> Rank Candidates';
                btnRank.disabled = false;
            }
        });
    }
});
