/* ============================================================
   APP.JS  –  Shared state, API client, utilities, and router
   Data comes from the POS server (/api/*), which reads products
   from InventaAPI and keeps prices, stock and sales in Supabase.
   ============================================================ */

// ── API client ──────────────────────────────────────────
// The InventaAPI keys are never handled here: the server reads them from .env.
// Every call says which store it is for (?store=grocery|pharmacy|hardware).
async function api(path, { method = 'GET', body, store = State.store } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const url = '/api/' + path + (path.includes('?') ? '&' : '?') + 'store=' + encodeURIComponent(store);

  let res;
  try {
    res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw Object.assign(new Error('Cannot reach the POS server. Is `npm run dev` running?'), { data: {} });
  }
  let data = {};
  try { data = await res.json(); } catch { /* empty */ }
  if (!res.ok) throw Object.assign(new Error(data.error || `Request failed (${res.status}).`), { status: res.status, data });
  return data;
}

// ── State ──────────────────────────────────────────────────
const STORE_PREF = 'quickpos_store';

const State = {
  store: (() => { try { return localStorage.getItem(STORE_PREF) || 'grocery'; } catch { return 'grocery'; } })(),
  status: null,
  products: [],
  transactions: [],
  loaded: false,

  async refresh() {
    const [status, p, t] = await Promise.all([api('status'), api('products'), api('transactions')]);
    this.status = status;
    this.products = p.products;
    this.transactions = t.transactions;   // newest first
    this.loaded = true;
    renderConnection();
  },

  async switchStore(id) {
    this.store = id;
    try { localStorage.setItem(STORE_PREF, id); } catch { /* private mode */ }
    if (typeof cart !== 'undefined') cart = [];
    await this.refresh();
  },

  currentStore() {
    return this.status?.stores.find(s => s.id === this.store) || { id: this.store, label: this.store, icon: '🏪' };
  },

  async sync() {
    const result = await api('sync', { method: 'POST' });
    await this.refresh();
    return result;
  },

  async updateProduct(id, data) {
    const { product } = await api('products', { method: 'PATCH', body: { id, ...data } });
    const i = this.products.findIndex(x => x.id === id);
    if (i > -1) this.products[i] = product;
    return product;
  },

  async checkout(items, discount, cash) {
    const { transaction } = await api('checkout', { method: 'POST', body: { items, discount, cash } });
    this.transactions.unshift(transaction);
    const p = await api('products');
    this.products = p.products;
    return transaction;
  },
};

// ── Utilities ──────────────────────────────────────────────
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function peso(n) {
  return '₱' + Number(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
}

function receiptNo(t) {
  return '#' + String(t.id).padStart(4, '0');
}

function productLabel(p) {
  return p.variant ? `${p.name} – ${p.variant}` : p.name;
}

function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'show' + (type ? ' toast-' + type : '');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.className = ''; }, 3200);
}

// Store switcher and key status in the top bar
function renderConnection() {
  const el = document.getElementById('conn-status');
  const sel = document.getElementById('store-select');
  if (!el || !State.status) return;
  const s = State.status;
  if (!s.stores.some(x => x.id === State.store)) State.store = 'grocery';

  if (sel) {
    sel.innerHTML = s.stores.map(x => `<option value="${esc(x.id)}">${esc(x.icon + ' ' + x.label)}</option>`).join('');
    sel.value = State.store;
  }
  const cur = State.currentStore();
  document.getElementById('store-name').textContent = cur.label + ' Store';
  document.getElementById('store-icon').textContent = cur.icon;

  const keyText = cur.keySet ? `Key ${cur.keyHint}` : `No ${cur.label} key in .env`;
  const storeText = s.storage === 'supabase' ? 'Supabase' : 'Local file';
  el.className = 'store-status' + (cur.keySet ? '' : ' warn');
  el.innerHTML = `<span class="status-dot"></span><span>${esc(keyText)} · ${esc(storeText)}</span>`;
  el.title = `InventaAPI: ${s.inventaUrl}`;
}

async function onStoreChange(id) {
  try {
    await State.switchStore(id);
    navigate(_currentPage || 'dashboard');
    showToast(`Switched to ${State.currentStore().label}.`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── Router ─────────────────────────────────────────────────
const PAGES = {
  dashboard:    { title: 'Dashboard',       loader: () => loadDashboard()    },
  cashier:      { title: 'Cashier',         loader: () => loadCashier()      },
  products:     { title: 'Products',        loader: () => loadProducts()     },
  transactions: { title: 'Transactions',    loader: () => loadTransactions() },
  apikey:       { title: 'API Key Tester',  loader: () => loadApiKey()       },
};

let _currentPage = null;

async function navigate(page) {
  if (!PAGES[page]) page = 'dashboard';
  _currentPage = page;
  if (location.hash !== '#' + page) history.replaceState(null, '', '#' + page);

  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
  document.getElementById('page-title').textContent = PAGES[page].title;

  const html = await fetch('pages/' + page + '.html').then(r => r.text());
  if (_currentPage !== page) return;   // user clicked elsewhere meanwhile
  document.getElementById('page-content').innerHTML = html;
  PAGES[page].loader();
}

document.getElementById('sidebar-toggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('collapsed');
});

document.querySelectorAll('.nav-item').forEach(el => {
  el.addEventListener('click', e => {
    e.preventDefault();
    navigate(el.dataset.page);
  });
});

window.addEventListener('hashchange', () => {
  const hash = location.hash.replace('#', '') || 'dashboard';
  if (hash !== _currentPage) navigate(hash);
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  }
});

document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
  }
});

// ── Init ───────────────────────────────────────────────────
(async function init() {
  document.getElementById('topbar-date').textContent = new Date().toLocaleDateString('en-PH', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
  });

  try {
    await State.refresh();
  } catch (err) {
    showToast(err.message, 'error');
  }

  const startPage = location.hash.replace('#', '') || (State.products.length ? 'dashboard' : 'apikey');
  navigate(startPage);
})();
