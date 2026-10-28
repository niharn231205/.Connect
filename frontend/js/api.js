// Dynamic API URL: works seamlessly in production (deployed) and local dev
const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port !== '3000' && window.location.port !== ''
    ? `${window.location.protocol}//${window.location.hostname}:3000/api`
    : '/api';

const setToken = (token) => localStorage.setItem('token', token);
const getToken = () => localStorage.getItem('token');
const removeToken = () => localStorage.removeItem('token');

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

const getAuthHeaders = () => {
    const token = getToken();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
};

const checkAuth = () => {
    if(!getToken()) {
        window.location.href = '/login.html';
    }
};

const logout = () => {
    removeToken();
    window.location.href = '/login.html';
};

const showMessage = (elementId, message, isError = false) => {
    const el = document.getElementById(elementId);
    if(el) {
        el.textContent = message;
        el.style.display = 'block';
        el.className = isError ? 'error' : 'success';
        el.setAttribute('role', isError ? 'alert' : 'status');
    }
};
