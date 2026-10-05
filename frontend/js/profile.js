// Profile logic
checkAuth();

const renderProfile = async () => {
    try {
        const res = await fetch(`${API_URL}/users/dashboard`, {
            headers: getAuthHeaders()
        });
        const data = await res.json();

        if (res.ok) {
            // Basic Info
            document.getElementById('profile-name').innerText = data.name;
            document.getElementById('profile-email').innerText = data.email;
            document.getElementById('profile-initials').innerText = data.name.charAt(0).toUpperCase();

            // Label / Field
            const labelEl = document.getElementById('profile-label');
            if (data.label) {
                labelEl.innerText = `Field: ${data.label}`;
            } else {
                labelEl.style.display = 'none';
            }

            // Stats
            document.getElementById('profile-ats').innerText = data.atsScore || 0;
            document.getElementById('ats-vibe').innerText = data.atsScore > 70 ? 'Ready for matching!' : 'Try improving your resume';

            // Identity
            document.getElementById('profile-category').innerText = data.category || 'Not Set';
            document.getElementById('profile-level').innerText = data.answers?.experienceLevel || '---';

            // Answers
            if (data.answers) {
                document.getElementById('profile-goals').innerText = data.answers.careerGoals || '---';
                document.getElementById('profile-work').innerText = data.answers.workType || '---';

                const interestsContainer = document.getElementById('profile-interests');
                interestsContainer.innerHTML = '';
                if (data.answers.interests && data.answers.interests.length > 0) {
                    data.answers.interests.forEach(interest => {
                        const span = document.createElement('span');
                        span.className = 'tag';
                        span.innerText = interest;
                        interestsContainer.appendChild(span);
                    });
                } else {
                    interestsContainer.innerText = 'No interests set.';
                }
            }

            // Resume
            const resumeStatus = document.getElementById('resume-status');
            const resumeLink = document.getElementById('resume-link');
            if (data.resume) {
                resumeStatus.innerHTML = `<p>Latest resume: <strong>${data.resume}</strong></p>`;
                resumeLink.style.display = 'inline-block';
                resumeLink.innerText = 'Update Resume';
            } else {
                resumeLink.style.display = 'inline-block';
                resumeLink.innerText = 'Upload Resume';
                resumeLink.href = '/resume.html';
            }

            // Skill Cloud & Endorsements
            renderSkillCloud(data);

        } else {
            console.error('Failed to fetch profile', data.message);
        }

        // Portfolio Rendering
        if (data && data.portfolio) {
            renderPortfolio(data.portfolio);
        }

    } catch (error) {
        console.error('Network error fetching profile', error);
    }
};

function renderSkillCloud(data) {
    const container = document.getElementById('profile-skills-cloud');
    if (!container) return;
    container.innerHTML = '';

    // Collect skills from interests and resume keywords
    const skills = new Set(data.answers?.interests || []);
    if (data.suggestions?.keywordsToAdd) {
        data.suggestions.keywordsToAdd.slice(0, 5).forEach(k => skills.add(k));
    }

    if (skills.size === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.9rem;">Set interests or upload resume to see skills.</p>';
        return;
    }

    skills.forEach(skill => {
        const count = data.endorsements?.[skill.toLowerCase()] || 0;
        const skillCard = document.createElement('div');
        skillCard.style.cssText = `
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid var(--glass-border);
            padding: 0.8rem 1.2rem;
            border-radius: 12px;
            display: flex;
            align-items: center;
            gap: 1rem;
            cursor: pointer;
            transition: all 0.3s;
        `;
        skillCard.innerHTML = `
            <span style="font-weight: 600; font-size: 0.95rem;">${skill}</span>
            <div style="display: flex; align-items: center; gap: 0.4rem; color: var(--accent); background: rgba(245, 158, 11, 0.1); padding: 0.2rem 0.6rem; border-radius: 999px;">
                <i class="fas fa-thumbs-up" style="font-size: 0.8rem;"></i>
                <span style="font-weight: 700; font-size: 0.85rem;" id="count-${skill.replace(/\s+/g, '-')}">${count}</span>
            </div>
        `;
        
        skillCard.onclick = () => endorseSkill(skill, skill.replace(/\s+/g, '-'));
        container.appendChild(skillCard);
    });
}

async function endorseSkill(skill, idSuffix) {
    try {
        const token = localStorage.getItem('token');
        const userId = localStorage.getItem('userId'); // Assuming we store this
        // In a real app, we'd endorse OTHER users. For demo, we allow self-endorse or just simulate it.
        // The API expects targetId in params. Let's assume we are viewing the current user's profile for now.
        // To really make it "Pro", we'd visit other's profiles. But here we'll just show the functionality.
        
        const res = await fetch(`${API_URL}/users/endorse/me`, { // Special keyword for self for demo if needed, or get from data
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ skill })
        });

        if (res.ok) {
            const data = await res.json();
            const countEl = document.getElementById(`count-${idSuffix}`);
            if (countEl) {
                countEl.innerText = data.endorsements[skill.toLowerCase()];
                // Visual feedback
                countEl.parentElement.style.transform = 'scale(1.2)';
                setTimeout(() => countEl.parentElement.style.transform = 'scale(1)', 200);
            }
        }
    } catch (err) {
        console.error(err);
    }
}

function renderPortfolio(portfolio) {
    const grid = document.getElementById('portfolioGrid');
    grid.innerHTML = '';

    if (portfolio.length === 0) {
        grid.innerHTML = '<p style="color: var(--text-muted); grid-column: 1 / -1;">No projects added yet.</p>';
        return;
    }

    portfolio.forEach(item => {
        const div = document.createElement('div');
        div.style.cssText = 'background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); padding: 1.5rem; border-radius: 1rem;';
        div.innerHTML = `
            <h3 style="margin: 0 0 0.5rem 0; color: var(--primary-color)">${item.title}</h3>
            <p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 1rem;">${item.description}</p>
            ${item.link ? `<a href="${item.link}" target="_blank" style="color: var(--text-main); text-decoration: none; font-size: 0.9rem;"><i class="fas fa-external-link-alt"></i> View Project</a>` : ''}
        `;
        grid.appendChild(div);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    renderProfile();

    // Modal logic
    const modal = document.getElementById('projectModal');
    document.getElementById('addProjectBtn').onclick = () => {
        modal.style.display = 'flex';
    };
    document.getElementById('cancelProjectBtn').onclick = () => {
        modal.style.display = 'none';
        document.getElementById('projectTitle').value = '';
        document.getElementById('projectDesc').value = '';
        document.getElementById('projectLink').value = '';
    };

    document.getElementById('saveProjectBtn').onclick = async () => {
        const title = document.getElementById('projectTitle').value.trim();
        const description = document.getElementById('projectDesc').value.trim();
        const link = document.getElementById('projectLink').value.trim();

        if (!title) return alert("Title is required");

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/users/portfolio`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ title, description, link })
            });
            const data = await res.json();
            if (res.ok) {
                renderPortfolio(data.portfolio);
                document.getElementById('cancelProjectBtn').click();
            } else {
                alert(data.message);
            }
        } catch (err) {
            console.error(err);
        }
    };
});