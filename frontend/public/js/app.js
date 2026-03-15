/**
 * Core app – auth, navigation, toasts
 */
const App = (() => {
  let currentUser = null;

  function init() {
    const token = localStorage.getItem('token');
    if (token) {
      API.me().then(user => {
        currentUser = user;
        showApp();
      }).catch(() => {
        localStorage.removeItem('token');
        showAuth();
      });
    } else {
      showAuth();
    }

    // Enter key on login
    document.getElementById('login-password').addEventListener('keydown', e => {
      if (e.key === 'Enter') App.login();
    });
    document.getElementById('login-username').addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('login-password').focus();
    });

    // Nav
    document.querySelectorAll('.nav-item[data-page]').forEach(btn => {
      btn.addEventListener('click', () => navigate(btn.dataset.page));
    });
  }

  async function login() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errEl = document.getElementById('auth-error');
    errEl.style.display = 'none';

    if (!username || !password) {
      errEl.textContent = 'Введите логин и пароль';
      errEl.style.display = 'block';
      return;
    }

    try {
      const data = await API.login(username, password);
      localStorage.setItem('token', data.access_token);
      currentUser = { username: data.username };
      showApp();
    } catch (e) {
      errEl.textContent = 'Неверный логин или пароль';
      errEl.style.display = 'block';
    }
  }

  function logout() {
    localStorage.removeItem('token');
    currentUser = null;
    document.getElementById('app').style.display = 'none';
    document.getElementById('auth-screen').style.display = 'flex';
    document.getElementById('login-password').value = '';
  }

  function showAuth() {
    document.getElementById('auth-screen').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
  }

  function showApp() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    document.getElementById('sidebar-username').textContent = currentUser.username;
    navigate('recipes');
  }

  function navigate(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const pageEl = document.getElementById(`page-${page}`);
    if (pageEl) pageEl.classList.add('active');

    const navEl = document.querySelector(`.nav-item[data-page="${page}"]`);
    if (navEl) navEl.classList.add('active');

    // Load page data
    if (page === 'recipes') RecipesPage.load();
    if (page === 'menu') MenuPage.load();
    if (page === 'shopping') ShoppingPage.load();
    if (page === 'history') HistoryPage.load();
  }

  // ── Toasts ──
  function toast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    el.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${msg}</span>`;
    container.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s'; setTimeout(() => el.remove(), 300); }, 3500);
  }

  // ── Helpers ──
  function cookingMethodLabel(m) {
    const map = { boiling: '🫕 Варка', frying: '🍳 Жарка', dry_frying: '🥘 Жарка на сухой сковороде', stewing: '♨️ Тушение', air_fryer: '💨 Аэрогриль', baking: '🔥 Запекание', raw: '🥗 Сырое' };
    return map[m] || m;
  }

  function formatDate(d) {
    return new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  return { init, login, logout, navigate, toast, cookingMethodLabel, formatDate };
})();

document.addEventListener('DOMContentLoaded', () => App.init());
