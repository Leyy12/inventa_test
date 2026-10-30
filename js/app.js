/* ============================================================
   APP.JS  –  Shared state, utilities, and router
   ============================================================ */

// ── State ──────────────────────────────────────────────────
const State = {
  products:     JSON.parse(localStorage.getItem('pos_products')     || '[]'),
  transactions: JSON.parse(localStorage.getItem('pos_transactions') || '[]'),

  save() {
    localStorage.setItem('pos_products',     JSON.stringify(this.products));
    localStorage.setItem('pos_transactions', JSON.stringify(this.transactions));
  },

  addProduct(p)       { this.products.push(p);              this.save(); },
  updateProduct(id, data) {
    const i = this.products.findIndex(x => x.id === id);
    if (i > -1) { this.products[i] = { ...this.products[i], ...data }; this.save(); }
  },
  deleteProduct(id)   { this.products = this.products.filter(x => x.id !== id); this.save(); },

  addTransaction(t)   { this.transactions.push(t); this.save(); },
};

// ── Utilities ──────────────────────────────────────────────
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

function peso(n) {
  return '₱' + Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
}

function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'show' + (type ? ' toast-' + type : '');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.className = ''; }, 2800);
}

// ── Router ─────────────────────────────────────────────────
const PAGES = {
  dashboard:    { title: 'Dashboard',    loader: loadDashboard    },
  cashier:      { title: 'Cashier',      loader: loadCashier      },
  products:     { title: 'Products',     loader: loadProducts      },
  transactions: { title: 'Transactions', loader: loadTransactions  },
};

function navigate(page) {
  if (!PAGES[page]) page = 'dashboard';

  // Highlight active nav item
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });

  // Update topbar title
  document.getElementById('page-title').textContent = PAGES[page].title;

  // Load page HTML then call loader
  fetch('pages/' + page + '.html')
    .then(r => r.text())
    .then(html => {
      document.getElementById('page-content').innerHTML = html;
      PAGES[page].loader();
    });
}

// Sidebar collapse toggle
document.getElementById('sidebar-toggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('collapsed');
});

// Nav clicks (hash-based)
document.querySelectorAll('.nav-item').forEach(el => {
  el.addEventListener('click', e => {
    e.preventDefault();
    navigate(el.dataset.page);
  });
});

// Hash routing
window.addEventListener('hashchange', () => {
  const hash = location.hash.replace('#', '') || 'dashboard';
  navigate(hash);
});

// Keyboard shortcut: Escape closes any open modal
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  }
});

// Click-outside to close modal
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
  }
});

// ── Init ───────────────────────────────────────────────────
(function init() {
  // Topbar date
  document.getElementById('topbar-date').textContent = new Date().toLocaleDateString('en-PH', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
  });

  // Seed sample products if empty
  if (State.products.length === 0) {
    const samples = [
      { name: 'Coca-Cola 1.5L',        category: 'Beverages',     price: 65,  stock: 50, threshold: 10 },
      { name: 'Sprite 1.5L',            category: 'Beverages',     price: 60,  stock: 40, threshold: 10 },
      { name: 'Lucky Me Pancit Canton', category: 'Food',          price: 15,  stock: 100,threshold: 20 },
      { name: 'Nissin Cup Noodles',     category: 'Food',          price: 25,  stock: 60, threshold: 15 },
      { name: 'Nova Country Cheddar',   category: 'Snacks',        price: 30,  stock: 45, threshold: 10 },
      { name: 'Chippy Barbecue',        category: 'Snacks',        price: 20,  stock: 55, threshold: 10 },
      { name: 'Ariel Powder 66g',       category: 'Household',     price: 12,  stock: 30, threshold: 8  },
      { name: 'Safeguard Bar Soap',     category: 'Personal Care', price: 45,  stock: 25, threshold: 5  },
    ];
    samples.forEach(s => State.addProduct({ id: genId(), ...s }));
  }

  // Load starting page
  const startPage = location.hash.replace('#', '') || 'dashboard';
  navigate(startPage);
})();
