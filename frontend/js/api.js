const API_URL = 'http://localhost:3000/api';

const setToken = (token) => localStorage.setItem('token', token);
const getToken = () => localStorage.getItem('token');
const removeToken = () => localStorage.removeItem('token');

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
        setTimeout(() => {
            el.style.display = 'none';
        }, 5000);
    }
};
