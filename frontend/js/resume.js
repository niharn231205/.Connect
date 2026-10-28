function escapeResumeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

checkAuth();

const resumeForm = document.getElementById('resume-form');
if (resumeForm) {
    resumeForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const fileInput = document.getElementById('resume-file');
        const file = fileInput.files[0];
        const submitBtn = resumeForm.querySelector('button[type="submit"]');

        if (!file) {
            showMessage('error-msg', 'Please select a file to analyze.', true);
            return;
        }

        if (!/\.(pdf|docx|txt)$/i.test(file.name) || file.size > 5 * 1024 * 1024) {
            showMessage('error-msg', 'Choose a PDF, DOCX or TXT file, maximum 5 MB.', true);
            return;
        }

        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Extracting and verifying resume…';
        submitBtn.disabled = true;
        document.getElementById('error-msg').style.display = 'none';
        document.getElementById('success-msg').style.display = 'none';

        const formData = new FormData();
        formData.append('resume', file);

        try {
            const res = await fetch(`${API_URL}/resume/upload`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: formData
            });

            const data = await res.json();

            if (res.ok) {
                renderAnalysisResults(data, file.name);
            } else {
                showMessage('error-msg', data.message || 'Upload failed. Please try again.', true);
                submitBtn.innerHTML = 'Analyze My Resume';
                submitBtn.disabled = false;
            }
        } catch (error) {
            showMessage('error-msg', 'Network error. Is the server running?', true);
            submitBtn.innerHTML = 'Analyze My Resume';
            submitBtn.disabled = false;
        }
    });
}

function renderAnalysisResults(data, fileName) {
    const formCard = document.querySelector('.glass-card');
    if (!formCard) return;

    const score = Math.max(0, Math.min(100, Number(data.atsScore) || 0));
    let scoreColor = '#ef4444';
    let scoreLabel = 'Needs Improvement';
    let scoreTip = 'Add more quantified achievements and relevant keywords.';
    if (score >= 80) {
        scoreColor = '#10b981';
        scoreLabel = 'Strong structure';
        scoreTip = 'This heuristic checks structure and keywords; it does not predict hiring outcomes.';
    } else if (score >= 60) {
        scoreColor = '#f59e0b';
        scoreLabel = 'Good';
        scoreTip = 'A few improvements could significantly boost your chances.';
    }

    const skillsHtml = (data.skills || []).map(skill =>
        `<span style="display:inline-flex;align-items:center;gap:0.3rem;padding:0.35rem 0.75rem;border-radius:20px;font-size:0.82rem;font-weight:600;background:rgba(16,185,129,0.1);color:#10b981;border:1px solid rgba(16,185,129,0.25);margin:3px;">
            <i class="fas fa-check" style="font-size:0.7rem;"></i>${escapeResumeHtml(skill)}
        </span>`
    ).join('');

    const keywordsHtml = (data.suggestions && data.suggestions.keywordsToAdd && data.suggestions.keywordsToAdd.length)
        ? data.suggestions.keywordsToAdd.map(kw =>
            `<span style="display:inline-block;padding:0.3rem 0.7rem;border-radius:20px;font-size:0.8rem;background:rgba(245,158,11,0.08);color:var(--accent);border:1px solid rgba(245,158,11,0.2);margin:3px;">${escapeResumeHtml(kw)}</span>`
        ).join('')
        : '<span style="color:var(--text-secondary);font-size:0.9rem;">—</span>';

    const formatting = (data.suggestions && data.suggestions.formatting) || 'Analysis complete.';

    formCard.innerHTML = `
        <header style="margin-bottom:2rem;display:flex;align-items:center;gap:1rem;">
            <div style="width:48px;height:48px;border-radius:12px;background:rgba(16,185,129,0.1);display:flex;align-items:center;justify-content:center;border:1px solid rgba(16,185,129,0.25);flex-shrink:0;">
                <i class="fas fa-file-check" style="color:#10b981;font-size:1.3rem;"></i>
            </div>
            <div>
                <h2 style="margin:0;color:var(--text-primary);font-size:1.4rem;">Analysis Complete</h2>
                <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;margin-top:0.25rem;">
                    <p style="margin:0;font-size:0.85rem;color:var(--text-secondary);">${escapeResumeHtml(fileName)}</p>
                    ${data.verification?.isResume === true && data.verification?.provider === 'gemini' ? `<span style="display:inline-flex;align-items:center;gap:0.3rem;padding:0.2rem 0.55rem;background:rgba(59,130,246,0.12);color:#60a5fa;border:1px solid rgba(59,130,246,0.3);border-radius:12px;font-size:0.75rem;font-weight:600;"><i class="fas fa-robot"></i> Gemini Verified Resume</span>` : ''}
                </div>
            </div>
        </header>

        <p style="margin-bottom:1rem;">${escapeResumeHtml(data.verification?.reason || '')}</p>
        <p style="font-size:0.85rem;">Gemini classifies the document type. The score below is a local heuristic, not a Gemini rating.</p>
        <!-- Structure Score -->
        <div style="text-align:center;padding:1.5rem;background:rgba(255,255,255,0.02);border-radius:16px;border:1px solid var(--glass-border);margin-bottom:1.5rem;">
            <div style="position:relative;width:130px;height:130px;margin:0 auto 1rem;">
                <svg viewBox="0 0 130 130" style="transform:rotate(-90deg);width:130px;height:130px;">
                    <circle cx="65" cy="65" r="55" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="12"/>
                    <circle cx="65" cy="65" r="55" fill="none" stroke="${scoreColor}" stroke-width="12"
                        stroke-dasharray="${(score/100)*345.4} 345.4"
                        stroke-linecap="round" style="transition:stroke-dasharray 1s ease-out;"/>
                </svg>
                <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;">
                    <div style="font-size:2rem;font-weight:900;color:${scoreColor};">${score}</div>
                    <div style="font-size:0.7rem;color:var(--text-secondary);">/ 100</div>
                </div>
            </div>
            <h4 style="color:${scoreColor};margin-bottom:0.3rem;">${scoreLabel} Structure Score</h4>
            <p style="font-size:0.85rem;color:var(--text-secondary);max-width:320px;margin:0 auto;">${scoreTip}</p>
        </div>

        <!-- Detected Skills -->
        <div style="margin-bottom:1.5rem;">
            <h4 style="font-size:0.95rem;margin-bottom:0.75rem;display:flex;align-items:center;gap:0.5rem;">
                <i class="fas fa-circle-check" style="color:#10b981;"></i> Detected Skills (${(data.skills||[]).length})
            </h4>
            <div style="line-height:2;">${skillsHtml || '<span style="color:var(--text-secondary);font-size:0.9rem;">No skills detected. Try uploading a more detailed resume.</span>'}</div>
        </div>

        <!-- Keywords -->
        <div style="margin-bottom:1.5rem;">
            <h4 style="font-size:0.95rem;margin-bottom:0.75rem;display:flex;align-items:center;gap:0.5rem;">
                <i class="fas fa-tags" style="color:var(--accent);"></i> Suggested Improvements
            </h4>
            <div style="line-height:2;">${keywordsHtml}</div>
        </div>

        <!-- Formatting Note -->
        <div style="padding:1rem;background:rgba(255,255,255,0.02);border-radius:12px;border:1px solid var(--glass-border);margin-bottom:1.5rem;">
            <h4 style="font-size:0.85rem;margin-bottom:0.4rem;color:var(--accent);">
                <i class="fas fa-info-circle"></i> Formatting Note
            </h4>
            <p style="font-size:0.85rem;color:var(--text-secondary);margin:0;">${escapeResumeHtml(formatting)}</p>
        </div>

        <p><a href="/resume.html">Upload another resume</a></p>
        <!-- Action Buttons -->
        <div style="display:flex;gap:1rem;flex-wrap:wrap;">
            <a href="/dashboard.html" class="btn btn-primary" style="flex:1;text-align:center;">
                <i class="fas fa-gauge-high"></i> View Dashboard
            </a>
            <a href="/matcher.html" class="btn btn-secondary" style="flex:1;text-align:center;border:none;">
                <i class="fas fa-arrows-left-right"></i> Match to a Job
            </a>
        </div>
    `;
}

