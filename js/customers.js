/* ================================================================
   SAI AQUA — Customer Management Module
   Customer CRUD, account view, transaction history
   ================================================================ */

const Customers = (() => {

  let currentView = 'list'; // 'list' | 'detail' | 'form'
  let editingCustomerId = null;

  // ── Render Customer List ───────────────────────────────────────
  async function renderList() {
    currentView = 'list';
    editingCustomerId = null;
    const screen = document.getElementById('screen-customers');
    const customers = await DB.getAllCustomers();

    screen.innerHTML = `
      <div class="section-header">
        <div>
          <h2 class="section-title">Customers</h2>
          <div class="section-subtitle">${customers.length} customer${customers.length !== 1 ? 's' : ''}</div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="Customers.showForm()">＋ Add</button>
      </div>

      <div class="search-bar">
        <span class="search-icon">🔍</span>
        <input type="text" class="form-input" id="customer-search" placeholder="Search customers..." oninput="Customers.handleSearch(this.value)">
      </div>

      <div id="customer-list">
        ${renderCustomerItems(customers)}
      </div>
    `;
  }

  function renderCustomerItems(customers) {
    if (customers.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-icon">👥</div>
          <div class="empty-title">No customers yet</div>
          <div class="empty-text">Add your first customer to start creating invoices</div>
          <button class="btn btn-primary btn-sm" onclick="Customers.showForm()">＋ Add Customer</button>
        </div>
      `;
    }

    return customers.map(c => `
      <div class="list-item" onclick="Customers.showDetail(${c.id})">
        <div class="item-avatar ${Utils.getAvatarColor(c.name)}">${Utils.getInitials(c.name)}</div>
        <div class="item-content">
          <div class="item-title">${Utils.escapeHtml(c.name)}</div>
          <div class="item-subtitle">${c.mobile ? Utils.formatMobile(c.mobile) : 'No mobile'}</div>
        </div>
        <div style="color: var(--text-muted); font-size: 1.2rem;">›</div>
      </div>
    `).join('');
  }

  // ── Search Handler ─────────────────────────────────────────────
  const handleSearch = Utils.debounce(async (query) => {
    const listContainer = document.getElementById('customer-list');
    if (!listContainer) return;

    let customers;
    if (query.trim().length > 0) {
      customers = await DB.searchCustomers(query);
    } else {
      customers = await DB.getAllCustomers();
    }
    listContainer.innerHTML = renderCustomerItems(customers);
  }, 250);

  // ── Show Add/Edit Form ─────────────────────────────────────────
  async function showForm(customerId = null) {
    currentView = 'form';
    editingCustomerId = customerId;
    const screen = document.getElementById('screen-customers');

    let customer = { name: '', mobile: '', address: '', email: '' };
    if (customerId) {
      customer = await DB.getCustomer(customerId) || customer;
    }

    screen.innerHTML = `
      <div class="sub-header">
        <button class="back-btn" onclick="Customers.renderList()">←</button>
        <h2 class="section-title">${customerId ? 'Edit' : 'Add'} Customer</h2>
      </div>

      <form id="customer-form">
        <div class="form-group">
          <label class="form-label">Name *</label>
          <input type="text" id="cust-name" class="form-input" placeholder="Customer name" value="${Utils.escapeHtml(customer.name)}" required>
        </div>

        <div class="form-group">
          <label class="form-label">Mobile</label>
          <input type="tel" id="cust-mobile" class="form-input" placeholder="10-digit mobile number" value="${customer.mobile || ''}" inputmode="numeric">
        </div>

        <div class="form-group">
          <label class="form-label">Address</label>
          <input type="text" id="cust-address" class="form-input" placeholder="Address (optional)" value="${Utils.escapeHtml(customer.address || '')}">
        </div>

        <div class="form-group">
          <label class="form-label">Email</label>
          <input type="email" id="cust-email" class="form-input" placeholder="Email (optional)" value="${customer.email || ''}">
        </div>

        <button type="submit" class="btn btn-primary btn-block btn-lg">
          ${customerId ? '✓ Update Customer' : '＋ Add Customer'}
        </button>

        ${customerId ? `
          <button type="button" class="btn btn-danger btn-block" style="margin-top: var(--space-md);" onclick="Customers.handleDelete(${customerId})">
            🗑 Delete Customer
          </button>
        ` : ''}
      </form>
    `;

    document.getElementById('customer-form').addEventListener('submit', handleFormSubmit);
  }

  // ── Form Submit ────────────────────────────────────────────────
  async function handleFormSubmit(e) {
    e.preventDefault();

    const name = document.getElementById('cust-name').value.trim();
    const mobile = document.getElementById('cust-mobile').value.trim();
    const address = document.getElementById('cust-address').value.trim();
    const email = document.getElementById('cust-email').value.trim();

    if (!name) {
      Utils.showToast('Please enter customer name', 'error');
      return;
    }

    try {
      if (editingCustomerId) {
        await DB.updateCustomer(editingCustomerId, { name, mobile, address, email });
        Utils.showToast('Customer updated!', 'success');
        showDetail(editingCustomerId);
      } else {
        const id = await DB.addCustomer({ name, mobile, address, email });
        Utils.showToast('Customer added!', 'success');
        showDetail(id);
      }
    } catch (err) {
      console.error('Customer save failed:', err);
      Utils.showToast('Failed to save customer', 'error');
    }
  }

  // ── Delete Customer ────────────────────────────────────────────
  async function handleDelete(id) {
    const confirmed = await Utils.confirm('Delete this customer? This cannot be undone.');
    if (!confirmed) return;

    try {
      await DB.deleteCustomer(id);
      Utils.showToast('Customer deleted', 'success');
      renderList();
    } catch (err) {
      Utils.showToast('Failed to delete customer', 'error');
    }
  }

  // ── Customer Detail / Account View ─────────────────────────────
  async function showDetail(customerId) {
    currentView = 'detail';
    const screen = document.getElementById('screen-customers');
    const customer = await DB.getCustomer(customerId);

    if (!customer) {
      Utils.showToast('Customer not found', 'error');
      renderList();
      return;
    }

    const summary = await DB.getCustomerAccountSummary(customerId);

    screen.innerHTML = `
      <div class="sub-header">
        <button class="back-btn" onclick="Customers.renderList()">←</button>
        <div style="flex:1;">
          <div class="customer-header" style="margin-bottom: 0;">
            <div class="customer-avatar">${Utils.getInitials(customer.name)}</div>
            <div class="customer-info">
              <div class="customer-name">${Utils.escapeHtml(customer.name)}</div>
              <div class="customer-mobile">${customer.mobile ? Utils.formatMobile(customer.mobile) : 'No mobile'}</div>
            </div>
          </div>
        </div>
        <button class="btn btn-sm btn-ghost" onclick="Customers.showForm(${customerId})">✎</button>
      </div>

      ${customer.address ? `<div style="font-size: var(--font-sm); color: var(--text-muted); margin-bottom: var(--space-lg);">${Utils.escapeHtml(customer.address)}</div>` : ''}

      <!-- Account Summary -->
      <div class="stats-grid">
        <div class="stat-card accent">
          <div class="stat-icon accent">📄</div>
          <div class="stat-value">${summary.invoiceCount}</div>
          <div class="stat-label">Invoices</div>
        </div>
        <div class="stat-card ${summary.totalBalance > 0 ? 'orange' : 'green'}">
          <div class="stat-icon ${summary.totalBalance > 0 ? 'orange' : 'green'}">${summary.totalBalance > 0 ? '⏳' : '✓'}</div>
          <div class="stat-value">${Utils.formatCurrency(summary.totalBalance)}</div>
          <div class="stat-label">Outstanding</div>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card blue">
          <div class="stat-icon blue">💰</div>
          <div class="stat-value">${Utils.formatCurrency(summary.totalBilled)}</div>
          <div class="stat-label">Total Billed</div>
        </div>
        <div class="stat-card green">
          <div class="stat-icon green" style="background: var(--green-dim); color: var(--green);">✓</div>
          <div class="stat-value">${Utils.formatCurrency(summary.totalPaid)}</div>
          <div class="stat-label">Total Paid</div>
        </div>
      </div>

      <!-- Quick Action -->
      <button class="btn btn-primary btn-block" onclick="App.navigateTo('invoice')" style="margin-bottom: var(--space-lg);">
        ⚡ Create Invoice for ${Utils.escapeHtml(customer.name)}
      </button>

      <!-- Invoice History -->
      <div class="section-header">
        <h3 class="section-title" style="font-size: var(--font-md);">Transaction History</h3>
      </div>

      <div id="customer-invoices">
        ${renderCustomerInvoices(summary.invoices)}
      </div>
    `;
  }

  function renderCustomerInvoices(invoices) {
    if (invoices.length === 0) {
      return `
        <div class="empty-state" style="padding: var(--space-xl);">
          <div class="empty-icon">📋</div>
          <div class="empty-text">No invoices yet</div>
        </div>
      `;
    }

    return invoices.map(inv => {
      const invNum = Utils.formatInvoiceNumber(inv.invoiceNumber);
      const statusClass = inv.status === 'paid' ? 'status-paid' : (inv.status === 'partial' ? 'status-partial' : 'status-unpaid');
      const statusText = inv.status === 'paid' ? 'Paid' : (inv.status === 'partial' ? 'Partial' : 'Unpaid');

      return `
        <div class="list-item" style="flex-wrap: wrap;">
          <div class="item-avatar blue" style="align-self: flex-start;">📄</div>
          <div class="item-content" onclick="Invoice.viewInvoiceById(${inv.id}, 'customers')" style="cursor: pointer;">
            <div class="item-title">${invNum}</div>
            <div class="item-subtitle">${Utils.formatDate(inv.date)}</div>
          </div>
          <div class="item-meta">
            <div class="item-amount">${Utils.formatCurrency(inv.subtotal)}</div>
            <span class="item-status ${statusClass}">${statusText}</span>
          </div>
          <!-- Quick Actions -->
          <div style="width: 100%; display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 4px; margin-top: var(--space-sm);">
            <button class="btn btn-sm btn-ghost" style="padding: 4px 6px; font-size: 11px;" onclick="event.stopPropagation(); Invoice.viewInvoiceById(${inv.id}, 'customers')">
              👁️ View
            </button>
            <button class="btn btn-sm btn-secondary" style="padding: 4px 6px; font-size: 11px;" onclick="event.stopPropagation(); Invoice.downloadExistingPDF(${inv.id})">
              ⬇️ PDF
            </button>
            <button class="btn btn-sm btn-secondary" style="padding: 4px 6px; font-size: 11px;" onclick="event.stopPropagation(); Invoice.saveExistingImage(${inv.id})">
              💾 Image
            </button>
            <button class="btn btn-sm btn-ghost" style="padding: 4px 6px; font-size: 11px; color: var(--accent);" onclick="event.stopPropagation(); Invoice.shareExistingPDF(${inv.id})">
              📤 Share
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  return {
    renderList,
    handleSearch,
    showForm,
    handleDelete,
    showDetail
  };
})();
