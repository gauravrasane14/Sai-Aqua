/* ================================================================
   SAI AQUA — Product Management Module
   Simple CRUD for products (water jar types, rates)
   ================================================================ */

const Products = (() => {

  // ── Render Product List ────────────────────────────────────────
  async function renderList() {
    const screen = document.getElementById('screen-products');
    if (!screen) return;

    const products = await DB.getAllProductsIncludingInactive();

    screen.innerHTML = `
      <div class="section-header">
        <div>
          <h2 class="section-title">Products</h2>
          <div class="section-subtitle">${products.length} product${products.length !== 1 ? 's' : ''}</div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="Products.showForm()">＋ Add</button>
      </div>

      <div id="product-list">
        ${renderProductItems(products)}
      </div>
    `;
  }

  function renderProductItems(products) {
    if (products.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-icon">📦</div>
          <div class="empty-title">No products</div>
          <div class="empty-text">Add your first product</div>
          <button class="btn btn-primary btn-sm" onclick="Products.showForm()">＋ Add Product</button>
        </div>
      `;
    }

    return products.map(p => `
      <div class="list-item" onclick="Products.showForm(${p.id})">
        <div class="item-avatar accent">💧</div>
        <div class="item-content">
          <div class="item-title">${Utils.escapeHtml(p.name)}</div>
          <div class="item-subtitle">${Utils.formatCurrency(p.rate)} per ${p.unit || 'jar'}</div>
        </div>
        <div>
          <span class="badge ${p.isActive ? 'green' : 'red'}">${p.isActive ? 'Active' : 'Inactive'}</span>
        </div>
      </div>
    `).join('');
  }

  // ── Show Add/Edit Form ─────────────────────────────────────────
  async function showForm(productId = null) {
    const screen = document.getElementById('screen-products');

    let product = { name: '', rate: '', unit: 'jar', isActive: true };
    if (productId) {
      product = await DB.getProduct(productId) || product;
    }

    screen.innerHTML = `
      <div class="sub-header">
        <button class="back-btn" onclick="Products.renderList()">←</button>
        <h2 class="section-title">${productId ? 'Edit' : 'Add'} Product</h2>
      </div>

      <form id="product-form">
        <div class="form-group">
          <label class="form-label">Product Name *</label>
          <input type="text" id="prod-name" class="form-input" placeholder="e.g. Purified Water Jar" value="${Utils.escapeHtml(product.name)}" required>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Rate (₹) *</label>
            <input type="number" id="prod-rate" class="form-input" placeholder="30" value="${product.rate || ''}" min="0" step="0.5" inputmode="decimal" required>
          </div>
          <div class="form-group">
            <label class="form-label">Unit</label>
            <input type="text" id="prod-unit" class="form-input" placeholder="jar" value="${product.unit || 'jar'}">
          </div>
        </div>

        ${productId ? `
          <div class="form-group">
            <label class="form-label">Status</label>
            <select id="prod-active" class="form-select">
              <option value="1" ${product.isActive ? 'selected' : ''}>Active</option>
              <option value="0" ${!product.isActive ? 'selected' : ''}>Inactive</option>
            </select>
          </div>
        ` : ''}

        <button type="submit" class="btn btn-primary btn-block btn-lg">
          ${productId ? '✓ Update Product' : '＋ Add Product'}
        </button>

        ${productId ? `
          <button type="button" class="btn btn-danger btn-block" style="margin-top: var(--space-md);" onclick="Products.handleDelete(${productId})">
            🗑 Delete Product
          </button>
        ` : ''}
      </form>
    `;

    document.getElementById('product-form').addEventListener('submit', (e) => handleFormSubmit(e, productId));
  }

  // ── Form Submit ────────────────────────────────────────────────
  async function handleFormSubmit(e, productId) {
    e.preventDefault();

    const name = document.getElementById('prod-name').value.trim();
    const rate = parseFloat(document.getElementById('prod-rate').value);
    const unit = document.getElementById('prod-unit').value.trim() || 'jar';

    if (!name) {
      Utils.showToast('Please enter product name', 'error');
      return;
    }
    if (isNaN(rate) || rate < 0) {
      Utils.showToast('Please enter a valid rate', 'error');
      return;
    }

    try {
      if (productId) {
        const isActive = document.getElementById('prod-active')?.value === '1';
        await DB.updateProduct(productId, { name, rate, unit, isActive });
        Utils.showToast('Product updated!', 'success');
      } else {
        await DB.addProduct({ name, rate, unit });
        Utils.showToast('Product added!', 'success');
      }
      renderList();
    } catch (err) {
      console.error('Product save failed:', err);
      Utils.showToast('Failed to save product', 'error');
    }
  }

  // ── Delete Product ─────────────────────────────────────────────
  async function handleDelete(id) {
    const confirmed = await Utils.confirm('Delete this product?');
    if (!confirmed) return;

    try {
      await DB.deleteProduct(id);
      Utils.showToast('Product deleted', 'success');
      renderList();
    } catch (err) {
      Utils.showToast('Failed to delete product', 'error');
    }
  }

  return {
    renderList,
    showForm,
    handleDelete
  };
})();
