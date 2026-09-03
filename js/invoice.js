/* ================================================================
   SAI AQUA — Invoice Module
   Create invoice, render HTML, generate PDF & PNG
   The most critical module — priority #1
   ================================================================ */

const Invoice = (() => {

  let currentInvoiceData = null;
  let cachedPdfBlob = null;
  let cachedPngBlob = null;

  // ── Render Invoice Creation Form ───────────────────────────────
  async function renderCreateForm() {
    const screen = document.getElementById('screen-invoice');
    const customers = await DB.getAllCustomers();
    const products = await DB.getAllProducts();

    screen.innerHTML = `
      <div class="section-header">
        <div>
          <h2 class="section-title">New Invoice</h2>
          <div class="section-subtitle">Create and share instantly</div>
        </div>
      </div>

      <form id="invoice-form" autocomplete="off">
        <!-- Customer Selection -->
        <div class="form-group">
          <label class="form-label">Customer</label>
          <div class="customer-select-wrapper">
            <input type="text" id="inv-customer-search" class="form-input" placeholder="Search or add customer..." autocomplete="off">
            <input type="hidden" id="inv-customer-id">
            <div id="inv-customer-dropdown" class="customer-dropdown"></div>
          </div>
        </div>

        <!-- Quick Add Customer (hidden by default) -->
        <div id="quick-add-customer" style="display: none;">
          <div class="card" style="margin-bottom: var(--space-lg); border-color: var(--accent); border-style: dashed;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-md);">
              <span class="form-label" style="margin: 0;">Quick Add Customer</span>
              <button type="button" class="btn btn-sm btn-ghost" onclick="Invoice.cancelQuickAdd()">✕</button>
            </div>
            <div class="form-group">
              <input type="text" id="quick-name" class="form-input" placeholder="Customer Name *">
            </div>
            <div class="form-group">
              <input type="tel" id="quick-mobile" class="form-input" placeholder="Mobile Number">
            </div>
            <div class="form-group">
              <input type="text" id="quick-address" class="form-input" placeholder="Address (optional)">
            </div>
            <button type="button" class="btn btn-primary btn-block btn-sm" onclick="Invoice.saveQuickCustomer()">
              ✓ Add Customer
            </button>
          </div>
        </div>

        <!-- Date -->
        <div class="form-group">
          <label class="form-label">Invoice Date</label>
          <input type="date" id="inv-date" class="form-input" value="${Utils.todayISO()}">
        </div>

        <!-- Product & Quantity -->
        <div class="form-group">
          <label class="form-label">Product</label>
          <select id="inv-product" class="form-select">
            ${products.map(p => `<option value="${p.id}" data-rate="${p.rate}">${p.name} — ${Utils.formatCurrency(p.rate)}/${p.unit}</option>`).join('')}
          </select>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Quantity</label>
            <input type="number" id="inv-quantity" class="form-input" placeholder="0" min="1" inputmode="numeric">
          </div>
          <div class="form-group">
            <label class="form-label">Rate (₹)</label>
            <input type="number" id="inv-rate" class="form-input" placeholder="30" min="0" step="0.5" inputmode="decimal">
          </div>
        </div>

        <!-- Amount Display -->
        <div class="amount-display" style="margin-bottom: var(--space-lg);">
          <span class="amount-label">Subtotal</span>
          <span class="amount-value" id="inv-subtotal-display">₹0</span>
        </div>

        <!-- Payment -->
        <div class="form-group">
          <label class="form-label">Amount Paid (₹)</label>
          <input type="number" id="inv-paid" class="form-input" placeholder="0" min="0" inputmode="decimal">
        </div>

        <div class="amount-display balance" style="margin-bottom: var(--space-2xl);">
          <span class="amount-label">Balance Due</span>
          <span class="amount-value" id="inv-balance-display">₹0</span>
        </div>

        <!-- Generate Button -->
        <button type="submit" class="btn btn-primary btn-block btn-lg" id="btn-generate-invoice">
          ⚡ Generate Invoice
        </button>
      </form>
    `;

    // Setup event listeners
    setupFormListeners(customers, products);
  }

  // ── Setup Form Listeners ───────────────────────────────────────
  function setupFormListeners(customers, products) {
    const searchInput = document.getElementById('inv-customer-search');
    const dropdown = document.getElementById('inv-customer-dropdown');
    const productSelect = document.getElementById('inv-product');
    const qtyInput = document.getElementById('inv-quantity');
    const rateInput = document.getElementById('inv-rate');
    const paidInput = document.getElementById('inv-paid');
    const form = document.getElementById('invoice-form');

    // Set default rate from first product
    if (products.length > 0) {
      rateInput.value = products[0].rate;
    }

    // Customer search
    searchInput.addEventListener('focus', () => {
      showCustomerDropdown(customers, '');
    });

    searchInput.addEventListener('input', Utils.debounce(async () => {
      const query = searchInput.value.trim();
      if (query.length > 0) {
        const filtered = await DB.searchCustomers(query);
        showCustomerDropdown(filtered, query);
      } else {
        showCustomerDropdown(customers, '');
      }
    }, 200));

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.customer-select-wrapper')) {
        dropdown.classList.remove('show');
      }
    });

    // Product change → update rate
    productSelect.addEventListener('change', () => {
      const option = productSelect.selectedOptions[0];
      if (option) {
        rateInput.value = option.dataset.rate;
        recalculate();
      }
    });

    // Recalculate on input changes
    qtyInput.addEventListener('input', recalculate);
    rateInput.addEventListener('input', recalculate);
    paidInput.addEventListener('input', recalculate);

    // Form submission
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      handleGenerate();
    });
  }

  // ── Customer Dropdown ──────────────────────────────────────────
  function showCustomerDropdown(customers, query) {
    const dropdown = document.getElementById('inv-customer-dropdown');
    let html = '';

    if (customers.length === 0 && query.length > 0) {
      html = `
        <div class="customer-dropdown-item" style="color: var(--text-muted); text-align: center;">
          No customers found
        </div>
      `;
    } else {
      html = customers.map(c => `
        <div class="customer-dropdown-item" onclick="Invoice.selectCustomer(${c.id}, '${Utils.escapeHtml(c.name)}')">
          <div class="cdi-name">${Utils.escapeHtml(c.name)}</div>
          ${c.mobile ? `<div class="cdi-mobile">${Utils.formatMobile(c.mobile)}</div>` : ''}
        </div>
      `).join('');
    }

    html += `
      <div class="customer-dropdown-add" onclick="Invoice.showQuickAdd()">
        ＋ Add New Customer
      </div>
    `;

    dropdown.innerHTML = html;
    dropdown.classList.add('show');
  }

  function selectCustomer(id, name) {
    document.getElementById('inv-customer-search').value = name;
    document.getElementById('inv-customer-id').value = id;
    document.getElementById('inv-customer-dropdown').classList.remove('show');
  }

  function showQuickAdd() {
    document.getElementById('inv-customer-dropdown').classList.remove('show');
    document.getElementById('quick-add-customer').style.display = 'block';
    document.getElementById('quick-name').focus();
    // Pre-fill with search text
    const searchText = document.getElementById('inv-customer-search').value.trim();
    if (searchText) {
      document.getElementById('quick-name').value = searchText;
    }
  }

  function cancelQuickAdd() {
    document.getElementById('quick-add-customer').style.display = 'none';
    document.getElementById('quick-name').value = '';
    document.getElementById('quick-mobile').value = '';
    document.getElementById('quick-address').value = '';
  }

  async function saveQuickCustomer() {
    const name = document.getElementById('quick-name').value.trim();
    const mobile = document.getElementById('quick-mobile').value.trim();
    const address = document.getElementById('quick-address').value.trim();

    if (!name) {
      Utils.showToast('Please enter customer name', 'error');
      return;
    }

    try {
      const id = await DB.addCustomer({ name, mobile, address, email: '' });
      selectCustomer(id, name);
      cancelQuickAdd();
      Utils.showToast(`${name} added!`, 'success');
    } catch (err) {
      console.error('Failed to add customer:', err);
      Utils.showToast('Failed to add customer', 'error');
    }
  }

  // ── Recalculate Totals ─────────────────────────────────────────
  function recalculate() {
    const qty = parseFloat(document.getElementById('inv-quantity').value) || 0;
    const rate = parseFloat(document.getElementById('inv-rate').value) || 0;
    const paid = parseFloat(document.getElementById('inv-paid').value) || 0;

    const subtotal = qty * rate;
    const balance = Math.max(0, subtotal - paid);

    document.getElementById('inv-subtotal-display').textContent = Utils.formatCurrency(subtotal);
    document.getElementById('inv-balance-display').textContent = Utils.formatCurrency(balance);
  }

  // ── Handle Invoice Generation ──────────────────────────────────
  async function handleGenerate() {
    const customerId = parseInt(document.getElementById('inv-customer-id').value);
    const date = document.getElementById('inv-date').value;
    const productId = parseInt(document.getElementById('inv-product').value);
    const qty = parseFloat(document.getElementById('inv-quantity').value) || 0;
    const rate = parseFloat(document.getElementById('inv-rate').value) || 0;
    const paid = parseFloat(document.getElementById('inv-paid').value) || 0;

    // Validation
    if (!customerId) {
      Utils.showToast('Please select a customer', 'error');
      return;
    }
    if (qty <= 0) {
      Utils.showToast('Please enter quantity', 'error');
      return;
    }
    if (rate <= 0) {
      Utils.showToast('Please enter rate', 'error');
      return;
    }

    Utils.showLoading('Generating Invoice...');

    try {
      // Get related data
      const customer = await DB.getCustomer(customerId);
      const product = await DB.getProduct(productId);
      const invoiceNum = await DB.getNextInvoiceNumber();

      const subtotal = qty * rate;
      const balanceDue = Math.max(0, subtotal - paid);

      // Build invoice data model
      const invoiceData = {
        invoiceNumber: invoiceNum,
        customerId: customerId,
        date: date,
        items: [{
          productId: productId,
          productName: product ? product.name : 'Purified Water Jar',
          quantity: qty,
          rate: rate,
          amount: subtotal
        }],
        subtotal: subtotal,
        paidAmount: paid,
        balanceDue: balanceDue,
        status: balanceDue === 0 ? 'paid' : (paid > 0 ? 'partial' : 'unpaid'),
        // Denormalized for easy access
        customerName: customer.name,
        customerMobile: customer.mobile || '',
        customerAddress: customer.address || ''
      };

      // Save to database
      const savedId = await DB.saveInvoice(invoiceData);
      invoiceData.id = savedId;

      // Store current invoice
      currentInvoiceData = invoiceData;
      cachedPdfBlob = null;
      cachedPngBlob = null;

      // Render the invoice HTML (for html2canvas capture)
      renderInvoiceHTML(invoiceData);

      // Small delay to ensure DOM rendering before showing success
      await new Promise(r => setTimeout(r, 100));

      Utils.hideLoading();

      // Show success screen
      showSuccessScreen(invoiceData);

    } catch (err) {
      Utils.hideLoading();
      console.error('Invoice generation failed:', err);
      Utils.showToast('Failed to generate invoice', 'error');
    }
  }

  // ── Render Invoice HTML (Hidden — for capture) ─────────────────
  function renderInvoiceHTML(data) {
    const renderer = document.getElementById('invoice-renderer');
    const biz = DB.BUSINESS_INFO;

    const statusLabel = data.balanceDue === 0
      ? `<div class="inv-total-row fully-paid">
           <span class="total-label">✓ FULLY PAID</span>
           <span class="total-value">${Utils.formatCurrency(data.subtotal)}</span>
         </div>`
      : `<div class="inv-total-row balance">
           <span class="total-label">Balance Due</span>
           <span class="total-value">${Utils.formatCurrency(data.balanceDue)}</span>
         </div>`;

    renderer.innerHTML = `
      <div class="invoice-canvas" id="invoice-canvas">
        <!-- Header -->
        <div class="inv-header">
          <div class="inv-business-name">${biz.name}</div>
          <div class="inv-business-tagline">${biz.tagline}</div>
          <div class="inv-business-details">
            <strong>${biz.owner}</strong><br>
            Mobile: ${biz.mobile} &nbsp;|&nbsp; Email: ${biz.email}<br>
            ${biz.address.replace(/\n/g, '<br>')}
          </div>
        </div>

        <!-- Invoice Meta + Customer -->
        <div class="inv-meta-section">
          <div class="inv-meta-box">
            <div class="inv-invoice-title">INVOICE</div>
            <div class="inv-meta-row"><strong>Invoice No:</strong> ${Utils.formatInvoiceNumber(data.invoiceNumber)}</div>
            <div class="inv-meta-row"><strong>Date:</strong> ${Utils.formatDate(data.date)}</div>
          </div>
          <div class="inv-customer-box">
            <div class="inv-customer-label">Bill To</div>
            <div class="inv-customer-name">${Utils.escapeHtml(data.customerName)}</div>
            ${data.customerMobile ? `<div class="inv-customer-detail">Mobile: ${Utils.formatMobile(data.customerMobile)}</div>` : ''}
            ${data.customerAddress ? `<div class="inv-customer-detail">${Utils.escapeHtml(data.customerAddress)}</div>` : ''}
          </div>
        </div>

        <!-- Items Table -->
        <table class="inv-table">
          <thead>
            <tr>
              <th>Product</th>
              <th class="text-center">Qty</th>
              <th class="text-right">Rate</th>
              <th class="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${data.items.map(item => `
              <tr>
                <td>${Utils.escapeHtml(item.productName)}</td>
                <td class="text-center">${item.quantity}</td>
                <td class="text-right">${Utils.formatCurrency(item.rate)}</td>
                <td class="text-right">${Utils.formatCurrency(item.amount)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <!-- Totals -->
        <div class="inv-totals">
          <div class="inv-totals-table">
            <div class="inv-total-row">
              <span class="total-label">Subtotal</span>
              <span class="total-value">${Utils.formatCurrency(data.subtotal)}</span>
            </div>
            ${data.paidAmount > 0 ? `
              <div class="inv-total-row paid">
                <span class="total-label">Paid</span>
                <span class="total-value">- ${Utils.formatCurrency(data.paidAmount)}</span>
              </div>
            ` : ''}
            ${statusLabel}
          </div>
        </div>

        <!-- Footer -->
        <div class="inv-footer">
          <div class="inv-thankyou">Thank you for your business!</div>
          <div class="inv-footer-note">${biz.name} • ${biz.mobile}</div>
          <div class="inv-developer-credit">Designed, Developed & Maintained by <a href="https://www.linkedin.com/in/gauravrasane14/" target="_blank" rel="noopener">Gaurav Rasane</a> (<a href="https://wa.me/+917620984926" target="_blank" rel="noopener">76209 84926</a>)</div>
        </div>
      </div>
    `;
  }

  // ── Generate PNG from rendered invoice ─────────────────────────
  async function generatePNG(data) {
    if (cachedPngBlob && currentInvoiceData?.id === data?.id) return cachedPngBlob;

    // Make sure the invoice HTML is rendered
    if (!document.getElementById('invoice-canvas')) {
      renderInvoiceHTML(data || currentInvoiceData);
      await new Promise(r => setTimeout(r, 50));
    }

    const canvas = await html2canvas(document.getElementById('invoice-canvas'), {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: 540,
      windowWidth: 540
    });

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        cachedPngBlob = blob;
        resolve(blob);
      }, 'image/png', 1.0);
    });
  }

  // ── Generate PDF from rendered invoice ─────────────────────────
  async function generatePDF(data) {
    if (cachedPdfBlob && currentInvoiceData?.id === data?.id) return cachedPdfBlob;

    // Generate PNG first (used as base for PDF)
    const pngBlob = await generatePNG(data);
    const pngDataUrl = await blobToDataUrl(pngBlob);

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Load image to get dimensions
    const img = new Image();
    img.src = pngDataUrl;
    await new Promise((resolve) => { img.onload = resolve; });

    // Calculate scaled dimensions to fit A4 with margins
    const margin = 10;
    const maxWidth = pageWidth - (margin * 2);
    const maxHeight = pageHeight - (margin * 2);

    let imgWidth = maxWidth;
    let imgHeight = (img.height * imgWidth) / img.width;

    if (imgHeight > maxHeight) {
      imgHeight = maxHeight;
      imgWidth = (img.width * imgHeight) / img.height;
    }

    const x = (pageWidth - imgWidth) / 2;
    const y = margin;

    pdf.addImage(pngDataUrl, 'PNG', x, y, imgWidth, imgHeight);

    const pdfBlob = pdf.output('blob');
    cachedPdfBlob = pdfBlob;
    return pdfBlob;
  }

  // ── Helper: Blob to Data URL ───────────────────────────────────
  function blobToDataUrl(blob) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  }

  // ── Show Success Screen ────────────────────────────────────────
  function showSuccessScreen(data) {
    const screen = document.getElementById('screen-invoice');
    const invNum = Utils.formatInvoiceNumber(data.invoiceNumber);
    const statusClass = data.status === 'paid' ? 'accent' : (data.status === 'partial' ? 'orange' : 'orange');

    screen.innerHTML = `
      <div class="success-screen">
        <div class="success-checkmark">✓</div>
        <h2 class="success-title">Invoice Created!</h2>

        <div class="success-details">
          <div class="success-detail-row">
            <span class="label">Invoice</span>
            <span class="value accent">${invNum}</span>
          </div>
          <div class="success-detail-row">
            <span class="label">Customer</span>
            <span class="value">${Utils.escapeHtml(data.customerName)}</span>
          </div>
          <div class="success-detail-row">
            <span class="label">Total</span>
            <span class="value">${Utils.formatCurrency(data.subtotal)}</span>
          </div>
          ${data.paidAmount > 0 ? `
            <div class="success-detail-row">
              <span class="label">Paid</span>
              <span class="value" style="color: var(--green);">${Utils.formatCurrency(data.paidAmount)}</span>
            </div>
          ` : ''}
          <div class="success-detail-row">
            <span class="label">Balance</span>
            <span class="value ${statusClass}">${Utils.formatCurrency(data.balanceDue)}</span>
          </div>
        </div>

        <!-- Primary Share Actions -->
        <div class="success-share-actions">
          <button class="btn btn-share btn-share-pdf" onclick="Invoice.handleSharePDF()">
            📄 &nbsp;SHARE PDF (WhatsApp)
          </button>
          <button class="btn btn-share btn-share-img" onclick="Invoice.handleShareImage()">
            🖼️ &nbsp;SHARE IMAGE (WhatsApp)
          </button>
        </div>

        <!-- Download Buttons (Prominent) -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-sm); width: 100%; margin-bottom: var(--space-md);">
          <button class="btn btn-secondary btn-lg" onclick="Invoice.handleDownloadPDF()" style="font-size: var(--font-sm); font-weight: 700;">
            ⬇️ Download PDF
          </button>
          <button class="btn btn-secondary btn-lg" onclick="Invoice.handleSaveImage()" style="font-size: var(--font-sm); font-weight: 700;">
            💾 Download Image
          </button>
        </div>

        <!-- Secondary Actions (View / Print) -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-sm); width: 100%; margin-bottom: var(--space-xl);">
          <button class="btn btn-ghost" onclick="Invoice.handleViewInvoice()">
            👁️ View Invoice
          </button>
          <button class="btn btn-ghost" onclick="Invoice.handlePrint()">
            🖨️ Print
          </button>
        </div>

        <!-- Create New -->
        <button class="btn btn-primary btn-block btn-lg" onclick="Invoice.renderCreateForm()">
          ＋ Create Another Invoice
        </button>
      </div>
    `;
  }

  // ── Share/Download Action Handlers ─────────────────────────────
  async function handleSharePDF() {
    Utils.showLoading('Preparing PDF...');
    try {
      const pdf = await generatePDF(currentInvoiceData);
      Utils.hideLoading();
      await Share.sharePDF(pdf, Utils.formatInvoiceNumber(currentInvoiceData.invoiceNumber));
    } catch (err) {
      Utils.hideLoading();
      console.error('PDF share error:', err);
      Utils.showToast('Failed to share PDF', 'error');
    }
  }

  async function handleShareImage() {
    Utils.showLoading('Preparing Image...');
    try {
      const png = await generatePNG(currentInvoiceData);
      Utils.hideLoading();
      await Share.shareImage(png, Utils.formatInvoiceNumber(currentInvoiceData.invoiceNumber));
    } catch (err) {
      Utils.hideLoading();
      console.error('Image share error:', err);
      Utils.showToast('Failed to share image', 'error');
    }
  }

  async function handleDownloadPDF() {
    Utils.showLoading('Generating PDF...');
    try {
      const pdf = await generatePDF(currentInvoiceData);
      Utils.hideLoading();
      Share.downloadPDF(pdf, Utils.formatInvoiceNumber(currentInvoiceData.invoiceNumber));
    } catch (err) {
      Utils.hideLoading();
      Utils.showToast('Failed to download PDF', 'error');
    }
  }

  async function handleSaveImage() {
    Utils.showLoading('Generating Image...');
    try {
      const png = await generatePNG(currentInvoiceData);
      Utils.hideLoading();
      Share.saveImage(png, Utils.formatInvoiceNumber(currentInvoiceData.invoiceNumber));
    } catch (err) {
      Utils.hideLoading();
      Utils.showToast('Failed to save image', 'error');
    }
  }

  function handlePrint() {
    const el = document.getElementById('invoice-canvas');
    if (el) {
      Share.printInvoice(el);
    } else {
      Utils.showToast('Please generate invoice first', 'error');
    }
  }

  let lastReturnScreen = 'history';

  function handleViewInvoice() {
    if (!currentInvoiceData) return;
    showInvoiceView(currentInvoiceData, 'invoice');
  }

  function closeInvoiceView() {
    App.navigateTo(lastReturnScreen || 'history');
  }

  // ── View Invoice (in-app preview with share & download actions) ─
  async function showInvoiceView(data, returnScreen = 'history') {
    lastReturnScreen = returnScreen;

    // Load full data if needed
    if (!data.customerName && data.customerId) {
      const customer = await DB.getCustomer(data.customerId);
      data.customerName = customer?.name || 'Unknown';
      data.customerMobile = customer?.mobile || '';
      data.customerAddress = customer?.address || '';
    }

    // Render the invoice HTML into the off-screen canvas
    renderInvoiceHTML(data);
    currentInvoiceData = data;
    cachedPdfBlob = null;
    cachedPngBlob = null;

    const screen = document.getElementById('screen-invoice-view');
    const invNum = Utils.formatInvoiceNumber(data.invoiceNumber);

    screen.innerHTML = `
      <div class="sub-header">
        <button class="back-btn" onclick="Invoice.closeInvoiceView()">←</button>
        <div>
          <h2 class="section-title">${invNum}</h2>
          <div class="section-subtitle">${Utils.escapeHtml(data.customerName)} • ${Utils.formatDate(data.date)}</div>
        </div>
      </div>

      <div class="invoice-preview-container">
        ${document.getElementById('invoice-canvas').outerHTML}
      </div>

      <div class="invoice-view-actions" style="margin-top: var(--space-base);">
        <!-- Primary Share Buttons -->
        <button class="btn btn-share btn-share-pdf" onclick="Invoice.handleSharePDF()">
          📄 &nbsp;SHARE PDF (WhatsApp)
        </button>
        <button class="btn btn-share btn-share-img" onclick="Invoice.handleShareImage()">
          🖼️ &nbsp;SHARE IMAGE (WhatsApp)
        </button>

        <!-- Direct Download Buttons -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-sm); margin-top: var(--space-xs);">
          <button class="btn btn-secondary btn-lg" onclick="Invoice.handleDownloadPDF()" style="font-weight: 700;">
            ⬇️ Download PDF
          </button>
          <button class="btn btn-secondary btn-lg" onclick="Invoice.handleSaveImage()" style="font-weight: 700;">
            💾 Download Image
          </button>
        </div>

        <button class="btn btn-ghost btn-block" onclick="Invoice.handlePrint()" style="margin-top: var(--space-xs);">
          🖨️ Print Invoice
        </button>
      </div>
    `;

    // Show dedicated invoice view screen without triggering form reset
    App.navigateTo('invoice-view');
  }

  // ── View existing invoice by ID ────────────────────────────────
  async function viewInvoiceById(invoiceId, returnScreen = 'history') {
    const data = await DB.getInvoice(invoiceId);
    if (data) {
      await showInvoiceView(data, returnScreen);
    } else {
      Utils.showToast('Invoice not found', 'error');
    }
  }

  // ── Direct Download helpers for existing invoices ──────────────
  async function downloadExistingPDF(invoiceId) {
    const data = await DB.getInvoice(invoiceId);
    if (!data) { Utils.showToast('Invoice not found', 'error'); return; }

    if (!data.customerName && data.customerId) {
      const customer = await DB.getCustomer(data.customerId);
      data.customerName = customer?.name || 'Unknown';
      data.customerMobile = customer?.mobile || '';
    }

    renderInvoiceHTML(data);
    currentInvoiceData = data;
    cachedPdfBlob = null;
    cachedPngBlob = null;

    await new Promise(r => setTimeout(r, 50));
    await handleDownloadPDF();
  }

  async function saveExistingImage(invoiceId) {
    const data = await DB.getInvoice(invoiceId);
    if (!data) { Utils.showToast('Invoice not found', 'error'); return; }

    if (!data.customerName && data.customerId) {
      const customer = await DB.getCustomer(data.customerId);
      data.customerName = customer?.name || 'Unknown';
      data.customerMobile = customer?.mobile || '';
    }

    renderInvoiceHTML(data);
    currentInvoiceData = data;
    cachedPdfBlob = null;
    cachedPngBlob = null;

    await new Promise(r => setTimeout(r, 50));
    await handleSaveImage();
  }

  // ── Share existing invoice ─────────────────────────────────────
  async function shareExistingPDF(invoiceId) {
    const data = await DB.getInvoice(invoiceId);
    if (!data) { Utils.showToast('Invoice not found', 'error'); return; }

    if (!data.customerName && data.customerId) {
      const customer = await DB.getCustomer(data.customerId);
      data.customerName = customer?.name || 'Unknown';
      data.customerMobile = customer?.mobile || '';
    }

    renderInvoiceHTML(data);
    currentInvoiceData = data;
    cachedPdfBlob = null;
    cachedPngBlob = null;

    await new Promise(r => setTimeout(r, 50));
    await handleSharePDF();
  }

  async function shareExistingImage(invoiceId) {
    const data = await DB.getInvoice(invoiceId);
    if (!data) { Utils.showToast('Invoice not found', 'error'); return; }

    if (!data.customerName && data.customerId) {
      const customer = await DB.getCustomer(data.customerId);
      data.customerName = customer?.name || 'Unknown';
      data.customerMobile = customer?.mobile || '';
    }

    renderInvoiceHTML(data);
    currentInvoiceData = data;
    cachedPdfBlob = null;
    cachedPngBlob = null;

    await new Promise(r => setTimeout(r, 50));
    await handleShareImage();
  }

  return {
    renderCreateForm,
    selectCustomer,
    showQuickAdd,
    cancelQuickAdd,
    saveQuickCustomer,
    handleSharePDF,
    handleShareImage,
    handleDownloadPDF,
    handleSaveImage,
    handlePrint,
    handleViewInvoice,
    closeInvoiceView,
    showInvoiceView,
    viewInvoiceById,
    downloadExistingPDF,
    saveExistingImage,
    shareExistingPDF,
    shareExistingImage,
    renderInvoiceHTML,
    generatePNG,
    generatePDF
  };
})();
