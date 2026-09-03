/* ================================================================
   SAI AQUA — Database Layer (Dexie.js / IndexedDB)
   Local persistence for customers, products, invoices, settings
   ================================================================ */

const DB = (() => {
  // Initialize Dexie database
  const db = new Dexie('SaiAquaDB');

  // Database schema
  db.version(1).stores({
    customers: '++id, name, mobile, createdAt',
    products:  '++id, name, isActive',
    invoices:  '++id, invoiceNumber, customerId, date, createdAt',
    settings:  'key'
  });

  // ── Business Info (constant) ───────────────────────────────────
  const BUSINESS_INFO = {
    name: 'SAI AQUA',
    tagline: 'Purified Water Jar Suppliers',
    owner: 'Kartik Shede',
    mobile: '90115 76211',
    email: 'saishede44@gmail.com',
    address: 'Opp. Shree Padma Lawns,\nLande Vasti Road, Shevgaon,\nMaharashtra – 414502'
  };

  // ── Initialization ─────────────────────────────────────────────
  async function init() {
    // Seed default product if none exist
    const productCount = await db.products.count();
    if (productCount === 0) {
      await db.products.add({
        name: 'Purified Water Jar',
        rate: 30,
        unit: 'jar',
        isActive: true,
        createdAt: new Date().toISOString()
      });
    }

    // Seed invoice counter if not set
    const counter = await db.settings.get('invoiceCounter');
    if (!counter) {
      await db.settings.put({ key: 'invoiceCounter', value: 0 });
    }
  }

  // ── Invoice Number Generator ───────────────────────────────────
  async function getNextInvoiceNumber() {
    const counter = await db.settings.get('invoiceCounter');
    const next = (counter?.value || 0) + 1;
    await db.settings.put({ key: 'invoiceCounter', value: next });
    return next;
  }

  // ── Customer CRUD ──────────────────────────────────────────────
  async function addCustomer(customer) {
    customer.createdAt = new Date().toISOString();
    return await db.customers.add(customer);
  }

  async function updateCustomer(id, data) {
    return await db.customers.update(id, data);
  }

  async function deleteCustomer(id) {
    return await db.customers.delete(id);
  }

  async function getCustomer(id) {
    return await db.customers.get(id);
  }

  async function getAllCustomers() {
    return await db.customers.orderBy('name').toArray();
  }

  async function searchCustomers(query) {
    const q = query.toLowerCase();
    return await db.customers
      .filter(c => c.name.toLowerCase().includes(q) || (c.mobile && c.mobile.includes(q)))
      .toArray();
  }

  // ── Product CRUD ───────────────────────────────────────────────
  async function addProduct(product) {
    product.createdAt = new Date().toISOString();
    product.isActive = true;
    return await db.products.add(product);
  }

  async function updateProduct(id, data) {
    return await db.products.update(id, data);
  }

  async function deleteProduct(id) {
    return await db.products.delete(id);
  }

  async function getProduct(id) {
    return await db.products.get(id);
  }

  async function getAllProducts() {
    return await db.products.where('isActive').equals(1).toArray();
  }

  async function getAllProductsIncludingInactive() {
    return await db.products.toArray();
  }

  // ── Invoice CRUD ───────────────────────────────────────────────
  async function saveInvoice(invoice) {
    invoice.createdAt = new Date().toISOString();
    return await db.invoices.add(invoice);
  }

  async function updateInvoice(id, data) {
    return await db.invoices.update(id, data);
  }

  async function getInvoice(id) {
    return await db.invoices.get(id);
  }

  async function getAllInvoices() {
    return await db.invoices.orderBy('createdAt').reverse().toArray();
  }

  async function getInvoicesByCustomer(customerId) {
    return await db.invoices
      .where('customerId')
      .equals(customerId)
      .reverse()
      .sortBy('createdAt');
  }

  async function searchInvoices(query) {
    const allInvoices = await getAllInvoices();
    const q = query.toLowerCase();
    // We need customer names for search, so we fetch all
    const results = [];
    for (const inv of allInvoices) {
      const customer = await getCustomer(inv.customerId);
      const customerName = customer ? customer.name.toLowerCase() : '';
      const invNum = Utils.formatInvoiceNumber(inv.invoiceNumber).toLowerCase();
      if (customerName.includes(q) || invNum.includes(q)) {
        results.push(inv);
      }
    }
    return results;
  }

  // ── Dashboard Stats ────────────────────────────────────────────
  async function getDashboardStats() {
    const today = Utils.todayISO();
    const allInvoices = await getAllInvoices();
    const allCustomers = await getAllCustomers();

    let todayCount = 0;
    let todayTotal = 0;
    let totalOutstanding = 0;

    for (const inv of allInvoices) {
      if (inv.date === today) {
        todayCount++;
        todayTotal += inv.subtotal || 0;
      }
      totalOutstanding += inv.balanceDue || 0;
    }

    return {
      todayInvoices: todayCount,
      todayTotal,
      totalOutstanding,
      totalCustomers: allCustomers.length,
      recentInvoices: allInvoices.slice(0, 5)
    };
  }

  // ── Customer Account Summary ───────────────────────────────────
  async function getCustomerAccountSummary(customerId) {
    const invoices = await getInvoicesByCustomer(customerId);
    let totalBilled = 0;
    let totalPaid = 0;
    let totalBalance = 0;

    for (const inv of invoices) {
      totalBilled += inv.subtotal || 0;
      totalPaid += inv.paidAmount || 0;
      totalBalance += inv.balanceDue || 0;
    }

    return {
      invoices,
      totalBilled,
      totalPaid,
      totalBalance,
      invoiceCount: invoices.length
    };
  }

  return {
    db,
    BUSINESS_INFO,
    init,
    getNextInvoiceNumber,
    // Customers
    addCustomer,
    updateCustomer,
    deleteCustomer,
    getCustomer,
    getAllCustomers,
    searchCustomers,
    // Products
    addProduct,
    updateProduct,
    deleteProduct,
    getProduct,
    getAllProducts,
    getAllProductsIncludingInactive,
    // Invoices
    saveInvoice,
    updateInvoice,
    getInvoice,
    getAllInvoices,
    getInvoicesByCustomer,
    searchInvoices,
    // Stats
    getDashboardStats,
    getCustomerAccountSummary
  };
})();
