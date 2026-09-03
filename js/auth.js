/* ================================================================
   SAI AQUA — Authentication Module
   Simple admin password gate with disable option
   ================================================================ */

const Auth = (() => {

  const SESSION_KEY = 'saiaqua_authenticated';
  const DEFAULT_PASSWORD = 'saiaqua';

  // ── Check if user is authenticated ─────────────────────────────
  async function isAuthenticated() {
    const enabled = await isPasswordEnabled();
    if (!enabled) return true; // Password disabled — always authenticated
    return sessionStorage.getItem(SESSION_KEY) === 'true';
  }

  // ── Check if password feature is enabled ───────────────────────
  async function isPasswordEnabled() {
    const setting = await DB.db.settings.get('passwordEnabled');
    // Default: enabled (true) if no setting exists
    return setting ? setting.value !== false : true;
  }

  // ── Get stored password ────────────────────────────────────────
  async function getPassword() {
    const setting = await DB.db.settings.get('adminPassword');
    return setting ? setting.value : DEFAULT_PASSWORD;
  }

  // ── Login attempt ──────────────────────────────────────────────
  async function login(inputPassword) {
    const storedPassword = await getPassword();
    if (inputPassword === storedPassword) {
      sessionStorage.setItem(SESSION_KEY, 'true');
      return true;
    }
    return false;
  }

  // ── Logout ─────────────────────────────────────────────────────
  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    showLoginScreen();
  }

  // ── Change password ────────────────────────────────────────────
  async function changePassword(currentPass, newPass) {
    const storedPassword = await getPassword();
    if (currentPass !== storedPassword) {
      return { success: false, message: 'Current password is incorrect' };
    }
    if (!newPass || newPass.length < 4) {
      return { success: false, message: 'New password must be at least 4 characters' };
    }
    await DB.db.settings.put({ key: 'adminPassword', value: newPass });
    return { success: true, message: 'Password changed successfully' };
  }

  // ── Toggle password requirement ────────────────────────────────
  async function setPasswordEnabled(enabled) {
    await DB.db.settings.put({ key: 'passwordEnabled', value: enabled });
    if (!enabled) {
      // Auto-authenticate when disabling
      sessionStorage.setItem(SESSION_KEY, 'true');
    }
  }

  // ── Show Login Screen ──────────────────────────────────────────
  function showLoginScreen() {
    const overlay = document.getElementById('login-overlay');
    if (overlay) {
      overlay.classList.add('active');
      document.body.style.overflow = 'hidden';
      // Focus password field
      setTimeout(() => {
        const input = document.getElementById('login-password');
        if (input) input.focus();
      }, 300);
    }
  }

  // ── Hide Login Screen ──────────────────────────────────────────
  function hideLoginScreen() {
    const overlay = document.getElementById('login-overlay');
    if (overlay) {
      overlay.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  // ── Handle Login Form Submit ───────────────────────────────────
  async function handleLogin() {
    const input = document.getElementById('login-password');
    const errorEl = document.getElementById('login-error');
    const password = input ? input.value : '';

    if (!password) {
      if (errorEl) { errorEl.textContent = 'Please enter password'; errorEl.style.display = 'block'; }
      return;
    }

    const success = await login(password);
    if (success) {
      hideLoginScreen();
      if (errorEl) errorEl.style.display = 'none';
      if (input) input.value = '';
      // Initialize app content
      await App.navigateTo('dashboard');
    } else {
      if (errorEl) { errorEl.textContent = 'Incorrect password'; errorEl.style.display = 'block'; }
      if (input) { input.value = ''; input.focus(); }
      // Shake animation
      const card = document.querySelector('.login-card');
      if (card) {
        card.classList.add('shake');
        setTimeout(() => card.classList.remove('shake'), 500);
      }
    }
  }

  // ── Initialize Auth ────────────────────────────────────────────
  async function init() {
    // Seed default password if not set
    const passEntry = await DB.db.settings.get('adminPassword');
    if (!passEntry) {
      await DB.db.settings.put({ key: 'adminPassword', value: DEFAULT_PASSWORD });
    }

    // Setup login form handler
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        handleLogin();
      });
    }

    // Check auth state
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      showLoginScreen();
      return false;
    }
    return true;
  }

  return {
    init,
    isAuthenticated,
    isPasswordEnabled,
    getPassword,
    login,
    logout,
    changePassword,
    setPasswordEnabled,
    showLoginScreen,
    hideLoginScreen,
    handleLogin
  };
})();
