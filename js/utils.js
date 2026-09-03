/* ================================================================
   SAI AQUA — Utility Functions
   Helpers for currency, dates, formatting, toasts, and modals
   ================================================================ */

const Utils = (() => {

  // ── Indian Currency Formatting ─────────────────────────────────
  function formatCurrency(amount) {
    const num = parseFloat(amount) || 0;
    return '₹' + num.toLocaleString('en-IN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
  }

  function formatNumber(num) {
    return parseFloat(num || 0).toLocaleString('en-IN');
  }

  // ── Date Formatting ────────────────────────────────────────────
  function formatDate(date) {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  function formatDateShort(date) {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${day} ${months[d.getMonth()]}`;
  }

  function formatDateISO(date) {
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  }

  function todayISO() {
    return formatDateISO(new Date());
  }

  // ── Invoice Number Formatting ──────────────────────────────────
  function formatInvoiceNumber(num) {
    return 'SA-' + String(num).padStart(4, '0');
  }

  // ── Mobile Number Formatting ───────────────────────────────────
  function formatMobile(mobile) {
    if (!mobile) return '';
    const clean = String(mobile).replace(/\D/g, '');
    if (clean.length === 10) {
      return clean.slice(0, 5) + ' ' + clean.slice(5);
    }
    return mobile;
  }

  // ── Toast Notification System ──────────────────────────────────
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  // ── Loading Overlay ────────────────────────────────────────────
  function showLoading(text = 'Generating...') {
    let overlay = document.getElementById('loading-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'loading-overlay';
      overlay.className = 'loading-overlay';
      overlay.innerHTML = `
        <div class="spinner"></div>
        <div class="loading-text">${text}</div>
      `;
      document.body.appendChild(overlay);
    } else {
      overlay.querySelector('.loading-text').textContent = text;
      overlay.style.display = 'flex';
    }
  }

  function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      overlay.style.display = 'none';
    }
  }

  // ── Modal Helpers ──────────────────────────────────────────────
  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  // ── Debounce ───────────────────────────────────────────────────
  function debounce(fn, delay = 300) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  // ── Get initials from name ─────────────────────────────────────
  function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  // ── Avatar color from name ─────────────────────────────────────
  const avatarColors = ['accent', 'blue', 'purple', 'orange'];
  function getAvatarColor(name) {
    if (!name) return avatarColors[0];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return avatarColors[Math.abs(hash) % avatarColors.length];
  }

  // ── Confirm Dialog ─────────────────────────────────────────────
  function confirm(message) {
    return new Promise((resolve) => {
      // Use native confirm for now - can be replaced with custom modal
      resolve(window.confirm(message));
    });
  }

  // ── Escape HTML ────────────────────────────────────────────────
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return {
    formatCurrency,
    formatNumber,
    formatDate,
    formatDateShort,
    formatDateISO,
    todayISO,
    formatInvoiceNumber,
    formatMobile,
    showToast,
    showLoading,
    hideLoading,
    openModal,
    closeModal,
    debounce,
    getInitials,
    getAvatarColor,
    confirm,
    escapeHtml
  };
})();
