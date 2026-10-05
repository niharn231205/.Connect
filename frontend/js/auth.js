// Auth handling logic
const signupForm = document.getElementById('signup-form');
const loginForm = document.getElementById('login-form');

if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            const res = await fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password })
            });
            const data = await res.json();

            if (res.ok) {
                setToken(data.token);
                // after signup, go to questions
                window.location.href = '/questions.html';
            } else {
                showMessage('error-msg', data.message || 'Signup failed', true);
            }
        } catch (error) {
            showMessage('error-msg', 'Network error', true);
        }
    });
}

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            const res = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();

            if (res.ok) {
                setToken(data.token);
                // after login, go to dashboard
                window.location.href = '/dashboard.html';
            } else {
                showMessage('error-msg', data.message || 'Login failed', true);
            }
        } catch (error) {
            showMessage('error-msg', 'Network error', true);
        }
    });
}

// Add password toggle logic
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('toggle-password')) {
        const passwordInput = e.target.previousElementSibling;
        if (passwordInput && passwordInput.tagName === 'INPUT') {
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                e.target.classList.remove('fa-eye');
                e.target.classList.add('fa-eye-slash');
            } else {
                passwordInput.type = 'password';
                e.target.classList.remove('fa-eye-slash');
                e.target.classList.add('fa-eye');
            }
        }
    }
});
