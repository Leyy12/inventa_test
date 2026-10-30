/* ============================================================
   CASHIER.JS  –  POS cart and checkout logic
   ============================================================ */

const CATEGORY_EMOJI = {
  'Beverages':    '🥤',
  'Beverage':     '🥤',
  'Drinks':       '🥤',
  'Food':         '🍱',
  'Snacks':       '🍿',
  'Household':    '🧹',
  'Personal Care':'🧴',
  'Hardware':     '🔧',
  'Construction': '🧱',
  'Pharmacy':     '💊',
  'Medicine':     '💊',
  'Electronics':  '🔌',
  'Other':        '📦',
};

let cart = [];
let _checkingOut = false;

// ── Load ───────────────────────────────────────────────────
function loadCashier() {
  renderPosTiles();
  renderCart();
}

const sellable = p => p.price > 0;

// ── Product Tiles ──────────────────────────────────────────
function renderPosTiles() {
  const q    = (document.getElementById('pos-search')?.value || '').toLowerCase();
  const grid = document.getElementById('pos-tiles');
  if (!grid) return;

  if (State.products.length === 0) {
    grid.innerHTML = `<div class="grid-empty">No products yet.<br>Go to <a href="#products">Products</a> and press <b>Sync from API</b>.</div>`;
    return;
  }

  const list = State.products.filter(p =>
    [p.name, p.variant, p.sku, p.category].join(' ').toLowerCase().includes(q)
  );

  if (list.length === 0) {
    grid.innerHTML = '<div class="grid-empty">No products found.</div>';
    return;
  }

  grid.innerHTML = list.map(p => {
    const disabled = p.stock === 0 || !sellable(p);
    const note = !sellable(p) ? 'Set a price' : p.stock === 0 ? 'Out of stock' : p.stock + ' left';
    const visual = p.image_url
      ? `<img class="tile-img" src="${esc(p.image_url)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'tile-emoji',textContent:'📦'}))">`
      : `<div class="tile-emoji">${CATEGORY_EMOJI[p.category] || '📦'}</div>`;
    return `
      <div class="product-tile ${disabled ? 'oos' : ''}" data-id="${esc(p.id)}" onclick="addToCart(this.dataset.id)">
        ${visual}
        <div class="tile-name">${esc(p.name)}</div>
        ${p.variant ? `<div class="tile-variant">${esc(p.variant)}</div>` : ''}
        <div class="tile-price">${sellable(p) ? peso(p.price) : '—'}</div>
        <div class="tile-stock">${note}</div>
      </div>`;
  }).join('');
}

// ── Cart Actions ───────────────────────────────────────────
function addToCart(id) {
  const product = State.products.find(p => p.id === id);
  if (!product || product.stock === 0 || !sellable(product)) return;

  const existing = cart.find(c => c.id === id);
  if (existing) {
    if (existing.qty >= product.stock) {
      showToast('Not enough stock!', 'error');
      return;
    }
    existing.qty++;
  } else {
    cart.push({ id: product.id, qty: 1 });
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

// Cart lines joined with current product data (name, price).
function cartLines() {
  return cart
    .map(c => ({ ...c, product: State.products.find(p => p.id === c.id) }))
    .filter(c => c.product);
}

// ── Render Cart ────────────────────────────────────────────
function renderCart() {
  const container = document.getElementById('cart-items');
  const countEl   = document.getElementById('cart-count');
  if (!container) return;

  cart = cart.filter(c => State.products.some(p => p.id === c.id));
  const lines = cartLines();
  if (countEl) countEl.textContent = lines.reduce((s, i) => s + i.qty, 0);

  if (lines.length === 0) {
    container.innerHTML = `
      <div class="cart-empty">
        <div class="cart-empty-icon">🛒</div>
        Cart is empty.<br>Click a product to add.
      </div>`;
  } else {
    container.innerHTML = lines.map(({ id, qty, product: p }) => `
      <div class="cart-item" data-id="${esc(id)}">
        <div class="cart-item-info">
          <div class="cart-item-name">${esc(productLabel(p))}</div>
          <div class="cart-item-unit">${peso(p.price)} each</div>
        </div>
        <div class="qty-ctrl">
          <button class="qty-btn" onclick="changeQty(this.closest('.cart-item').dataset.id, -1)">−</button>
          <span class="qty-num">${qty}</span>
          <button class="qty-btn" onclick="changeQty(this.closest('.cart-item').dataset.id, 1)">＋</button>
        </div>
        <div class="cart-item-subtotal">${peso(p.price * qty)}</div>
        <button class="remove-btn" onclick="removeFromCart(this.closest('.cart-item').dataset.id)">✕</button>
      </div>
    `).join('');
  }

  renderTotals();
}

// ── Totals ─────────────────────────────────────────────────
function renderTotals() {
  const subtotal = cartLines().reduce((s, i) => s + i.product.price * i.qty, 0);
  const discount = Math.min(subtotal, Math.max(0, parseFloat(document.getElementById('discount-input')?.value) || 0));
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
async function checkout() {
  if (_checkingOut) return;
  if (cart.length === 0) { showToast('Cart is empty!', 'error'); return; }

  const subtotal = cartLines().reduce((s, i) => s + i.product.price * i.qty, 0);
  const discount = Math.max(0, parseFloat(document.getElementById('discount-input').value) || 0);
  const cash     = parseFloat(document.getElementById('cash-input').value) || 0;
  const total    = Math.max(0, subtotal - discount);

  if (cash > 0 && cash < total) {
    showToast('Cash is less than total!', 'error');
    return;
  }

  _checkingOut = true;
  const btn = document.getElementById('checkout-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Processing…'; }
  try {
    const txn = await State.checkout(cart.map(({ id, qty }) => ({ id, qty })), discount, cash);
    showReceipt(txn);
    clearCart();
    renderPosTiles();
  } catch (err) {
    showToast(err.message, 'error');
    // Stock may have changed elsewhere; show the latest numbers.
    try { State.products = (await api('products')).products; renderPosTiles(); renderCart(); } catch { /* ignore */ }
  } finally {
    _checkingOut = false;
    if (btn) { btn.disabled = false; btn.innerHTML = '💳 &nbsp; Checkout'; }
  }
}

// ── Receipt ────────────────────────────────────────────────
function showReceipt(txn) {
  document.getElementById('receipt-content').innerHTML = `
    <div class="receipt-store">${esc(State.currentStore().icon + " QuickPOS " + State.currentStore().label)}</div>
    <div class="receipt-sub">Official Receipt</div>
    <hr class="receipt-divider">
    <div class="receipt-meta">
      <div>Receipt: ${receiptNo(txn)}</div>
      <div>Date: ${formatDate(txn.created_at)}</div>
    </div>
    <hr class="receipt-divider">
    ${txn.items.map(i => `
      <div class="receipt-line">
        <span>${esc(i.name)} ×${i.qty}</span>
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
  if (!win) { showToast('Allow pop-ups to print receipts.', 'error'); return; }
  win.document.write(`
    <html>
      <head><title>Receipt</title><style>
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
