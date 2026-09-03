/* ================================================================
   SAI AQUA — Invoice History Module
   Browse, search, and re-share past invoices
   ================================================================ */

const History = (() => {

  // ── Render Invoice History List ────────────────────────────────
  async function renderList() {
    const screen = document.getElementById('screen-history');
    const invoices = await DB.getAllInvoices();

    screen.innerHTML = `
      <div class="section-header">
        <div>
          <h2 class="section-title">Invoices</h2>
          <div class="section-subtitle">${invoices.length} invoice${invoices.length !== 1 ? 's' : ''}</div>
        </div>
      </div>

      <div class="search-bar">
        <span class="search-icon">🔍</span>
        <input type="text" class="form-input" id="history-search" placeholder="Search by customer or invoice #..." oninput="History.handleSearch(this.value)">
      </div>

      <!-- Filter Tabs -->
      <div class="tab-bar">
        <button class="tab-item active" onclick="History.filterBy('all', this)">All</button>
        <button class="tab-item" onclick="History.filterBy('unpaid', this)">Unpaid</button>
        <button class="tab-item" onclick="History.filterBy('partial', this)">Partial</button>
        <button class="tab-item" onclick="History.filterBy('paid', this)">Paid</button>
      </div>

      <div id="history-list">
        ${await renderInvoiceItems(invoices)}
      </div>
    `;
  }

  async function renderInvoiceItems(invoices) {
    if (invoices.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <div class="empty-title">No invoices yet</div>
          <div class="empty-text">Create your first invoice to see it here</div>
          <button class="btn btn-primary btn-sm" onclick="App.navigateTo('invoice')">＋ Create Invoice</button>
        </div>
      `;
    }

    let html = '';
    for (const inv of invoices) {
      const invNum = Utils.formatInvoiceNumber(inv.invoiceNumber);
      const statusClass = inv.status === 'paid' ? 'status-paid' : (inv.status === 'partial' ? 'status-partial' : 'status-unpaid');
      const statusText = inv.status === 'paid' ? 'Paid' : (inv.status === 'partial' ? 'Partial' : 'Unpaid');
      const customerName = inv.customerName || 'Unknown';

      html += `
        <div class="list-item" style="flex-wrap: wrap;">
          <div class="item-avatar blue" style="align-self: flex-start;">📄</div>
          <div class="item-content" onclick="Invoice.viewInvoiceById(${inv.id})" style="cursor:pointer;">
            <div class="item-title">${invNum} — ${Utils.escapeHtml(customerName)}</div>
            <div class="item-subtitle">${Utils.formatDate(inv.date)}${inv.balanceDue > 0 ? ` • Balance: ${Utils.formatCurrency(inv.balanceDue)}` : ''}</div>
          </div>
          <div class="item-meta">
            <div class="item-amount">${Utils.formatCurrency(inv.subtotal)}</div>
            <span class="item-status ${statusClass}">${statusText}</span>
          </div>
          <!-- Share row -->
          <div style="width:100%; display: flex; gap: var(--space-xs); margin-top: var(--space-sm); padding-left: 54px;">
            <button class="btn btn-sm btn-ghost" style="flex:1; font-size: var(--font-xs);" onclick="event.stopPropagation(); Invoice.viewInvoiceById(${inv.id})">
              👁 View
            </button>
            <button class="btn btn-sm btn-ghost" style="flex:1; font-size: var(--font-xs); color: var(--blue);" onclick="event.stopPropagation(); Invoice.shareExistingPDF(${inv.id})">
              📄 PDF
            </button>
            <button class="btn btn-sm btn-ghost" style="flex:1; font-size: var(--font-xs); color: var(--purple);" onclick="event.stopPropagation(); Invoice.shareExistingImage(${inv.id})">
              🖼️ Image
            </button>
          </div>
        </div>
      `;
    }
    return html;
  }

  // ── Search Handler ─────────────────────────────────────────────
  const handleSearch = Utils.debounce(async (query) => {
    const listContainer = document.getElementById('history-list');
    if (!listContainer) return;

    let invoices;
    if (query.trim().length > 0) {
      invoices = await DB.searchInvoices(query);
    } else {
      invoices = await DB.getAllInvoices();
    }

    // Apply current filter
    const activeTab = document.querySelector('.tab-bar .tab-item.active');
    const filter = activeTab?.dataset?.filter || 'all';
    if (filter !== 'all') {
      invoices = invoices.filter(inv => inv.status === filter);
    }

    listContainer.innerHTML = await renderInvoiceItems(invoices);
  }, 250);

  // ── Filter By Status ───────────────────────────────────────────
  async function filterBy(status, btnElement) {
    // Update active tab
    document.querySelectorAll('.tab-bar .tab-item').forEach(t => t.classList.remove('active'));
    if (btnElement) {
      btnElement.classList.add('active');
      btnElement.dataset.filter = status;
    }

    const listContainer = document.getElementById('history-list');
    if (!listContainer) return;

    let invoices = await DB.getAllInvoices();

    // Apply search filter if active
    const searchInput = document.getElementById('history-search');
    if (searchInput && searchInput.value.trim()) {
      invoices = await DB.searchInvoices(searchInput.value.trim());
    }

    // Apply status filter
    if (status !== 'all') {
      invoices = invoices.filter(inv => inv.status === status);
    }

    listContainer.innerHTML = await renderInvoiceItems(invoices);
  }

  return {
    renderList,
    handleSearch,
    filterBy
  };
})();
