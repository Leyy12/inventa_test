/* ============================================================
   CASHIER.JS  –  POS cart and checkout logic
   ============================================================ */

const CATEGORY_EMOJI = {
  'Beverages':    '🥤',
  'Food':         '🍱',
  'Snacks':       '🍿',
  'Household':    '🧹',
  'Personal Care':'🧴',
  'Other':        '📦',
};

let cart = [];
let _lastTxn = null;

// ── Load ───────────────────────────────────────────────────
function loadCashier() {
  cart = [];
  renderPosTiles();
  renderCart();
}

// ── Product Tiles ──────────────────────────────────────────
function renderPosTiles() {
  const q      = (document.getElementById('pos-search')?.value || '').toLowerCase();
  const grid   = document.getElementById('pos-tiles');
  if (!grid) return;

  const list = State.products.filter(p =>
    p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
  );

  if (list.length === 0) {
    grid.innerHTML = '<div style="color:var(--text-xs); font-size:13px; padding:20px; grid-column:1/-1;">No products found.</div>';
    return;
  }

  grid.innerHTML = list.map(p => `
    <div class="product-tile ${p.stock === 0 ? 'oos' : ''}" onclick="addToCart('${p.id}')">
      <div class="tile-emoji">${CATEGORY_EMOJI[p.category] || '📦'}</div>
      <div class="tile-name">${p.name}</div>
      <div class="tile-price">${peso(p.price)}</div>
      <div class="tile-stock">${p.stock === 0 ? 'Out of stock' : p.stock + ' left'}</div>
    </div>
  `).join('');
}

// ── Cart Actions ───────────────────────────────────────────
function addToCart(id) {
  const product = State.products.find(p => p.id === id);
  if (!product || product.stock === 0) return;

  const existing = cart.find(c => c.id === id);
  if (existing) {
    if (existing.qty >= product.stock) {
      showToast('Not enough stock!', 'error');
      return;
    }
    existing.qty++;
  } else {
    cart.push({ id: product.id, name: product.name, price: product.price, qty: 1 });
  }
  renderCart();
}

function changeQty(id, delta) {
  const item    = cart.find(c => c.id === id);
  const product = State.products.find(p => p.id === id);
  if (!item) return;

  item.qty += delta;

  if (item.qty <= 0) {
    cart = cart.filter(c => c.id !== id);
  } else if (product && item.qty > product.stock) {
    item.qty = product.stock;
    showToast('Max stock reached!', 'error');
  }
  renderCart();
}

function removeFromCart(id) {
  cart = cart.filter(c => c.id !== id);
  renderCart();
}

function clearCart() {
  cart = [];
  const di = document.getElementById('discount-input');
  const ci = document.getElementById('cash-input');
  if (di) di.value = '';
  if (ci) ci.value = '';
  renderCart();
}

// ── Render Cart ────────────────────────────────────────────
function renderCart() {
  const container = document.getElementById('cart-items');
  const countEl   = document.getElementById('cart-count');
  if (!container) return;

  const totalQty = cart.reduce((s, i) => s + i.qty, 0);
  if (countEl) countEl.textContent = totalQty;

  if (cart.length === 0) {
    container.innerHTML = `
      <div class="cart-empty">
        <div class="cart-empty-icon">🛒</div>
        Cart is empty.<br>Click a product to add.
      </div>`;
  } else {
    container.innerHTML = cart.map(item => `
      <div class="cart-item">
        <div class="cart-item-info">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-unit">${peso(item.price)} each</div>
        </div>
        <div class="qty-ctrl">
          <button class="qty-btn" onclick="changeQty('${item.id}', -1)">−</button>
          <span class="qty-num">${item.qty}</span>
          <button class="qty-btn" onclick="changeQty('${item.id}', 1)">＋</button>
        </div>
        <div class="cart-item-subtotal">${peso(item.price * item.qty)}</div>
        <button class="remove-btn" onclick="removeFromCart('${item.id}')">✕</button>
      </div>
    `).join('');
  }

  renderTotals();
}

// ── Totals ─────────────────────────────────────────────────
function renderTotals() {
  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const discount = Math.max(0, parseFloat(document.getElementById('discount-input')?.value) || 0);
  const cash     = Math.max(0, parseFloat(document.getElementById('cash-input')?.value) || 0);
  const total    = Math.max(0, subtotal - discount);
  const change   = cash >= total ? cash - total : 0;

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('t-subtotal', peso(subtotal));
  set('t-discount', peso(discount));
  set('t-total',    peso(total));
  set('t-change',   peso(change));
}

// ── Checkout ───────────────────────────────────────────────
function checkout() {
  if (cart.length === 0) { showToast('Cart is empty!', 'error'); return; }

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const discount = Math.max(0, parseFloat(document.getElementById('discount-input').value) || 0);
  const cash     = parseFloat(document.getElementById('cash-input').value) || 0;
  const total    = Math.max(0, subtotal - discount);

  if (cash > 0 && cash < total) {
    showToast('Cash is less than total!', 'error');
    return;
  }

  // Deduct stock
  cart.forEach(item => {
    const p = State.products.find(x => x.id === item.id);
    if (p) State.updateProduct(p.id, { stock: Math.max(0, p.stock - item.qty) });
  });

  const txn = {
    id:       genId(),
    ts:       Date.now(),
    items:    cart.map(i => ({ ...i })),
    subtotal,
    discount,
    total,
    cash:     cash || total,
    change:   Math.max(0, cash - total),
    status:   'Paid',
  };

  State.addTransaction(txn);
  _lastTxn = txn;

  showReceipt(txn);

  cart = [];
  document.getElementById('discount-input').value = '';
  document.getElementById('cash-input').value = '';
  renderCart();
  renderPosTiles();
}

// ── Receipt ────────────────────────────────────────────────
function showReceipt(txn) {
  const num = State.transactions.length;
  document.getElementById('receipt-content').innerHTML = `
    <div class="receipt-store">🛒 QuickPOS</div>
    <div class="receipt-sub">Official Receipt</div>
    <hr class="receipt-divider">
    <div class="receipt-meta">
      <div>Receipt #: ${num.toString().padStart(4,'0')}</div>
      <div>Date: ${formatDate(txn.ts)}</div>
    </div>
    <hr class="receipt-divider">
    ${txn.items.map(i => `
      <div class="receipt-line">
        <span>${i.name} ×${i.qty}</span>
        <span>${peso(i.price * i.qty)}</span>
      </div>
    `).join('')}
    <hr class="receipt-divider">
    <div class="receipt-line"><span>Subtotal</span><span>${peso(txn.subtotal)}</span></div>
    ${txn.discount > 0 ? `<div class="receipt-line"><span>Discount</span><span>-${peso(txn.discount)}</span></div>` : ''}
    <div class="receipt-total"><span>TOTAL</span><span>${peso(txn.total)}</span></div>
    <hr class="receipt-divider">
    <div class="receipt-line"><span>Cash</span><span>${peso(txn.cash)}</span></div>
    <div class="receipt-change">Change: ${peso(txn.change)}</div>
    <hr class="receipt-divider">
    <div class="receipt-thanks">Thank you for your purchase!</div>
  `;
  document.getElementById('receipt-modal').classList.add('open');
}

function closeReceiptModal() {
  document.getElementById('receipt-modal')?.classList.remove('open');
}

function printReceipt() {
  const html = document.getElementById('receipt-content').innerHTML;
  const win  = window.open('', '_blank', 'width=320,height=560');
  win.document.write(`
    <html>
      <head><style>
        body { font-family: 'Courier New', monospace; font-size:12px; padding:16px; line-height:1.7; }
        .receipt-store { text-align:center; font-size:16px; font-weight:800; }
        .receipt-sub, .receipt-thanks { text-align:center; font-size:11px; color:#666; }
        hr { border:none; border-top:1px dashed #ccc; margin:6px 0; }
        .receipt-line, .receipt-total { display:flex; justify-content:space-between; }
        .receipt-total { font-weight:800; font-size:14px; }
        .receipt-change { text-align:center; font-weight:800; font-size:15px; color:#16a34a; }
      </style></head>
      <body>${html}</body>
    </html>
  `);
  win.document.close();
  win.print();
}
