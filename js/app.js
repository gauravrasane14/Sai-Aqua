/* ================================================================
   SAI AQUA — Main Application Controller
   Navigation, routing, dashboard, settings, initialization
   ================================================================ */

const App = (() => {

  let currentScreen = 'dashboard';

  // ── Initialize Application ─────────────────────────────────────
  async function init() {
    try {
      // Initialize database
      await DB.init();

      // Initialize auth (checks password / shows login if needed)
      const authenticated = await Auth.init();

      // Set up navigation listeners
      setupNavigation();

      // Only load dashboard if already authenticated
      if (authenticated) {
        await navigateTo('dashboard');
      }

      // Register service worker
      registerServiceWorker();

      console.log('✅ Sai Aqua initialized');
    } catch (err) {
      console.error('❌ Initialization failed:', err);
      Utils.showToast('App failed to initialize', 'error');
    }
  }

  // ── Navigation ─────────────────────────────────────────────────
  function setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const screen = item.dataset.screen;
        if (screen) navigateTo(screen);
      });
    });
  }

  async function navigateTo(screenName) {
    const isAuth = await Auth.isAuthenticated();
    if (!isAuth) {
      Auth.showLoginScreen();
      return;
    }

    currentScreen = screenName;

    // Hide all screens
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

    // Show target screen
    const target = document.getElementById(`screen-${screenName}`);
    if (target) target.classList.add('active');

    // Update nav active state
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const navItem = document.querySelector(`.nav-item[data-screen="${screenName}"]`);
    if (navItem) navItem.classList.add('active');

    // Load screen content
    switch (screenName) {
      case 'dashboard':
        await renderDashboard();
        break;
      case 'invoice':
        await Invoice.renderCreateForm();
        break;
      case 'customers':
        await Customers.renderList();
        break;
      case 'history':
        await History.renderList();
        break;
      case 'products':
        await Products.renderList();
        break;
      case 'settings':
        await renderSettings();
        break;
    }
  }

  // ── Dashboard ──────────────────────────────────────────────────
  async function renderDashboard() {
    const screen = document.getElementById('screen-dashboard');
    const stats = await DB.getDashboardStats();

    screen.innerHTML = `
      <!-- Quick Create Button -->
      <button class="quick-create-btn" onclick="App.navigateTo('invoice')">
        ⚡ Create New Invoice
      </button>

      <!-- Stats Grid -->
      <div class="stats-grid">
        <div class="stat-card accent">
          <div class="stat-icon accent">📄</div>
          <div class="stat-value">${stats.todayInvoices}</div>
          <div class="stat-label">Today's Invoices</div>
        </div>
        <div class="stat-card blue">
          <div class="stat-icon blue">💰</div>
          <div class="stat-value">${Utils.formatCurrency(stats.todayTotal)}</div>
          <div class="stat-label">Today's Revenue</div>
        </div>
        <div class="stat-card ${stats.totalOutstanding > 0 ? 'orange' : 'green'}">
          <div class="stat-icon ${stats.totalOutstanding > 0 ? 'orange' : 'green'}">⏳</div>
          <div class="stat-value">${Utils.formatCurrency(stats.totalOutstanding)}</div>
          <div class="stat-label">Outstanding</div>
        </div>
        <div class="stat-card purple">
          <div class="stat-icon purple">👥</div>
          <div class="stat-value">${stats.totalCustomers}</div>
          <div class="stat-label">Customers</div>
        </div>
      </div>

      <!-- Recent Invoices -->
      <div class="section-header">
        <h3 class="section-title" style="font-size: var(--font-md);">Recent Invoices</h3>
        ${stats.recentInvoices.length > 0 ? `<button class="btn btn-sm btn-ghost" onclick="App.navigateTo('history')">View All</button>` : ''}
      </div>

      <div id="dashboard-recent">
        ${renderRecentInvoices(stats.recentInvoices)}
      </div>

      <!-- Quick Links -->
      <div class="divider"></div>
      <div class="stats-grid">
        <button class="btn btn-secondary btn-block" onclick="App.navigateTo('customers')" style="justify-content: flex-start;">
          👥 Customers
        </button>
        <button class="btn btn-secondary btn-block" onclick="App.navigateTo('settings')" style="justify-content: flex-start;">
          ⚙️ Settings
        </button>
      </div>
    `;
  }

  function renderRecentInvoices(invoices) {
    if (invoices.length === 0) {
      return `
        <div class="empty-state" style="padding: var(--space-xl);">
          <div class="empty-icon">📋</div>
          <div class="empty-title">No invoices yet</div>
          <div class="empty-text">Create your first invoice to get started!</div>
        </div>
      `;
    }

    return invoices.map(inv => {
      const invNum = Utils.formatInvoiceNumber(inv.invoiceNumber);
      const statusClass = inv.status === 'paid' ? 'status-paid' : (inv.status === 'partial' ? 'status-partial' : 'status-unpaid');
      const statusText = inv.status === 'paid' ? 'Paid' : (inv.status === 'partial' ? 'Partial' : 'Unpaid');
      const customerName = inv.customerName || 'Unknown';

      return `
        <div class="list-item" onclick="Invoice.viewInvoiceById(${inv.id})">
          <div class="item-avatar ${Utils.getAvatarColor(customerName)}">${Utils.getInitials(customerName)}</div>
          <div class="item-content">
            <div class="item-title">${invNum} — ${Utils.escapeHtml(customerName)}</div>
            <div class="item-subtitle">${Utils.formatDate(inv.date)}</div>
          </div>
          <div class="item-meta">
            <div class="item-amount">${Utils.formatCurrency(inv.subtotal)}</div>
            <span class="item-status ${statusClass}">${statusText}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  // ── Settings Screen ────────────────────────────────────────────
  async function renderSettings() {
    const screen = document.getElementById('screen-settings');
    const passwordEnabled = await Auth.isPasswordEnabled();

    screen.innerHTML = `
      <div class="section-header">
        <div>
          <h2 class="section-title">Settings</h2>
          <div class="section-subtitle">App configuration</div>
        </div>
      </div>

      <!-- Password Settings -->
      <div class="card" style="margin-bottom: var(--space-lg);">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-base);">
          <div>
            <div style="font-weight: 600; font-size: var(--font-base);">🔒 Password Lock</div>
            <div style="font-size: var(--font-sm); color: var(--text-secondary);">Require password to open app</div>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" id="settings-password-toggle" ${passwordEnabled ? 'checked' : ''} onchange="App.togglePassword(this.checked)">
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div id="password-settings-section" style="${passwordEnabled ? '' : 'display:none;'}">
          <div class="divider" style="margin: var(--space-md) 0;"></div>
          <button class="btn btn-secondary btn-block btn-sm" onclick="App.showChangePassword()">
            🔑 Change Password
          </button>

          <div id="change-password-form" style="display:none; margin-top: var(--space-base);">
            <div class="form-group">
              <label class="form-label">Current Password</label>
              <input type="password" id="settings-current-pass" class="form-input" placeholder="Current password">
            </div>
            <div class="form-group">
              <label class="form-label">New Password</label>
              <input type="password" id="settings-new-pass" class="form-input" placeholder="New password (min 4 chars)">
            </div>
            <div class="form-group">
              <label class="form-label">Confirm New Password</label>
              <input type="password" id="settings-confirm-pass" class="form-input" placeholder="Confirm new password">
            </div>
            <button class="btn btn-primary btn-block btn-sm" onclick="App.handleChangePassword()">
              ✓ Update Password
            </button>
          </div>
        </div>
      </div>

      <!-- Products -->
      <div class="list-item" onclick="App.navigateTo('products')" style="margin-bottom: var(--space-sm);">
        <div class="item-avatar accent">📦</div>
        <div class="item-content">
          <div class="item-title">Products</div>
          <div class="item-subtitle">Manage water jar products & rates</div>
        </div>
        <div style="color: var(--text-muted); font-size: 1.2rem;">›</div>
      </div>

      <!-- Logout -->
      <div class="list-item" onclick="Auth.logout()" style="margin-bottom: var(--space-lg);">
        <div class="item-avatar" style="background: var(--red-dim); color: var(--red);">🚪</div>
        <div class="item-content">
          <div class="item-title" style="color: var(--red);">Logout</div>
          <div class="item-subtitle">Lock the app</div>
        </div>
      </div>

      <!-- App Info -->
      <div class="card" style="text-align: center; padding: var(--space-xl);">
        <div style="font-size: var(--font-lg); font-weight: 800; background: var(--gradient-accent); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; margin-bottom: var(--space-xs);">
          SAI AQUA
        </div>
        <div style="font-size: var(--font-sm); color: var(--text-secondary);">
          Purified Water Jar Suppliers<br>Invoice Manager
        </div>
      </div>
    `;
  }

  // ── Toggle Password Lock ───────────────────────────────────────
  async function togglePassword(enabled) {
    await Auth.setPasswordEnabled(enabled);
    const section = document.getElementById('password-settings-section');
    if (section) {
      section.style.display = enabled ? '' : 'none';
    }
    Utils.showToast(enabled ? 'Password lock enabled' : 'Password lock disabled', 'success');
  }

  // ── Show Change Password Form ──────────────────────────────────
  function showChangePassword() {
    const form = document.getElementById('change-password-form');
    if (form) {
      form.style.display = form.style.display === 'none' ? 'block' : 'none';
    }
  }

  // ── Handle Password Change ─────────────────────────────────────
  async function handleChangePassword() {
    const current = document.getElementById('settings-current-pass').value;
    const newPass = document.getElementById('settings-new-pass').value;
    const confirm = document.getElementById('settings-confirm-pass').value;

    if (!current) {
      Utils.showToast('Enter current password', 'error');
      return;
    }
    if (newPass !== confirm) {
      Utils.showToast('New passwords do not match', 'error');
      return;
    }

    const result = await Auth.changePassword(current, newPass);
    if (result.success) {
      Utils.showToast(result.message, 'success');
      document.getElementById('settings-current-pass').value = '';
      document.getElementById('settings-new-pass').value = '';
      document.getElementById('settings-confirm-pass').value = '';
      document.getElementById('change-password-form').style.display = 'none';
    } else {
      Utils.showToast(result.message, 'error');
    }
  }

  // ── Service Worker Registration ────────────────────────────────
  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(() => {
        console.log('Service Worker registered');
      }).catch(err => {
        console.warn('Service Worker registration failed:', err);
      });
    }
  }

  return {
    init,
    navigateTo,
    renderDashboard,
    renderSettings,
    togglePassword,
    showChangePassword,
    handleChangePassword
  };
})();

// ── Boot ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
