checkAuth();

const questionsForm = document.getElementById('questions-form');

if (questionsForm) {
    questionsForm.addEventListener('submit', async (e) => {
        e.preventDefault();

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
        }
    });
}
