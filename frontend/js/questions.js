checkAuth();

const questionsForm = document.getElementById('questions-form');

if (questionsForm) {
    // Editing preferences should start from the saved values.
    fetch(`${API_URL}/users/dashboard`, { headers: getAuthHeaders() })
        .then(response => response.ok ? response.json() : null)
        .then(data => {
            const answers = data?.answers;
            if (!answers) return;
            const fields = { field: answers.field, interests: answers.interests?.join(', '), experience: answers.experienceLevel, workType: answers.workType, careerGoals: answers.careerGoals };
            Object.entries(fields).forEach(([id, value]) => {
                const input = document.getElementById(id);
                if (value && input && !input.dataset.edited) input.value = value;
            });
        }).catch(() => {});
    questionsForm.addEventListener('input', event => { event.target.dataset.edited = 'true'; });
    questionsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const button = questionsForm.querySelector('button[type="submit"]');
        if (button.disabled) return;
        button.disabled = true;
        button.textContent = 'Saving your preferences…';

        const payload = {
            field: document.getElementById('field').value,
            interests: document.getElementById('interests').value.split(',').map(i => i.trim()),
            experienceLevel: document.getElementById('experience').value,
            workType: document.getElementById('workType').value,
            careerGoals: document.getElementById('careerGoals').value
        };

        try {
            const res = await fetch(`${API_URL}/users/answers`, {
                method: 'POST',
                headers: {
                    ...getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (res.ok) {
                window.location.href = '/resume.html';
            } else {
                showMessage('error-msg', data.message || 'Saving answers failed', true);
            }
        } catch (error) {
            showMessage('error-msg', 'Network error', true);
        } finally {
            button.disabled = false;
            button.textContent = 'Save & continue →';
        }
    });
}
