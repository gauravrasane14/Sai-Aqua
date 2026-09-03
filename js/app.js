/* ================================================================
   SAI AQUA — Main Application Controller
   Navigation, routing, dashboard, initialization
   ================================================================ */

const App = (() => {

  let currentScreen = 'dashboard';

  // ── Initialize Application ─────────────────────────────────────
  async function init() {
    try {
      // Initialize database
      await DB.init();

      // Set up navigation listeners
      setupNavigation();

      // Load dashboard
      await navigateTo('dashboard');

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
        <button class="btn btn-secondary btn-block" onclick="App.navigateTo('products')" style="justify-content: flex-start;">
          📦 Products
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
    renderDashboard
  };
})();

// ── Boot ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
