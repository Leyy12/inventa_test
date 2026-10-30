/* ============================================================
   PRODUCTS.JS  –  Products synced from the InventaAPI key
   ============================================================ */

let _editingId = null;

function loadProducts() {
  renderCategoryFilter();
  renderSyncBanner();
  renderProductTable();
}

function renderSyncBanner(result) {
  const el = document.getElementById('sync-banner');
  if (!el) return;
  const s = State.status;
  if (result) {
    el.className = 'sync-banner ok';
    el.innerHTML = `✅ Synced <b>${result.items}</b> item(s) from <b>${result.products}</b> product(s) on key
      <b>${esc(result.keyName || result.keyHint)}</b>${result.plan ? ` (${esc(result.plan)} plan)` : ''}.
      ${result.items ? 'Set a price for new items before selling them.' : esc(result.message || 'No products are linked to this key.')}`;
    return;
  }
  if (s && !s.envKeySet) {
    el.className = 'sync-banner warn';
    el.innerHTML = 'No API key yet. Add <code>INVENTA_API_KEY</code> to your <code>.env</code> file and restart the server. See the <a href="#apikey">API Key</a> page.';
    return;
  }
  const last = State.products.reduce((m, p) => (p.synced_at && p.synced_at > m ? p.synced_at : m), '');
  el.className = 'sync-banner';
  el.innerHTML = last ? `Last synced ${esc(formatDate(last))}. Sync again to pick up products added to or removed from your key.`
                      : 'Press <b>Sync from API</b> to load the products linked to your API key.';
}

function renderCategoryFilter() {
  const sel = document.getElementById('product-category-filter');
  if (!sel) return;
  const current = sel.value;
  const cats = [...new Set(State.products.map(p => p.category).filter(Boolean))].sort();
  sel.innerHTML = '<option value="">All Categories</option>' + cats.map(c => `<option>${esc(c)}</option>`).join('');
  sel.value = cats.includes(current) ? current : '';
}

function filterProducts() {
  renderProductTable();
}

function stockBadge(p) {
  if (!(p.price > 0))            return ['badge-blue',    'Needs price'];
  if (p.stock === 0)             return ['badge-danger',  'Out of Stock'];
  if (p.stock <= p.threshold)    return ['badge-warning', 'Low Stock'];
  return ['badge-success', 'In Stock'];
}

function renderProductTable() {
  const q   = (document.getElementById('product-search')?.value || '').toLowerCase();
  const cat = (document.getElementById('product-category-filter')?.value || '');

  const list = State.products.filter(p => {
    const hay = [p.name, p.variant, p.sku, p.category, p.segment].join(' ').toLowerCase();
    return hay.includes(q) && (!cat || p.category === cat);
  });

  const countEl = document.getElementById('product-count');
  if (countEl) countEl.textContent = list.length + ' item' + (list.length !== 1 ? 's' : '');

  const tbody = document.getElementById('product-table-body');
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="8">${State.products.length ? 'No products match your search.' : 'No products yet. Press “Sync from API”.'}</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(p => {
    const [badgeClass, badgeLabel] = stockBadge(p);
    return `
      <tr>
        <td>${p.image_url ? `<img class="thumb" src="${esc(p.image_url)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : ''}</td>
        <td><b>${esc(p.name)}</b>${p.variant ? `<div class="sub">${esc(p.variant)}</div>` : ''}</td>
        <td class="mono">${esc(p.sku || '—')}</td>
        <td>${p.category ? `<span class="badge badge-gray">${esc(p.category)}</span>` : '—'}</td>
        <td>${p.price > 0 ? peso(p.price) : '<span style="color:var(--text-xs)">—</span>'}</td>
        <td><span style="font-weight:700; color:${p.stock === 0 ? 'var(--danger)' : p.stock <= p.threshold ? 'var(--warning)' : 'var(--text)'}">${p.stock}</span></td>
        <td><span class="badge ${badgeClass}">${badgeLabel}</span></td>
        <td><button class="btn btn-warning btn-sm" data-id="${esc(p.id)}" onclick="openProductModal(this.dataset.id)">✏️ Price &amp; stock</button></td>
      </tr>`;
  }).join('');
}

async function syncProducts() {
  const btn = document.getElementById('sync-btn');
  btn.disabled = true;
  btn.textContent = 'Syncing…';
  try {
    const result = await State.sync();
    renderCategoryFilter();
    renderProductTable();
    renderSyncBanner(result);
    showToast(`Synced ${result.items} item(s) from your API key.`, 'success');
  } catch (err) {
    const el = document.getElementById('sync-banner');
    if (el) {
      el.className = 'sync-banner bad';
      el.innerHTML = `❌ ${esc(err.message)}${err.data?.hint ? `<br><small>${esc(err.data.hint)}</small>` : ''}`;
    }
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '⟳ Sync from API';
  }
}

// ── Price & Stock Modal ────────────────────────────────────
function openProductModal(id) {
  const p = State.products.find(x => x.id === id);
  if (!p) return;
  _editingId = id;
  document.getElementById('p-name').textContent = productLabel(p);
  document.getElementById('p-meta').textContent = [p.sku && 'SKU ' + p.sku, p.category, p.segment].filter(Boolean).join(' · ');
  document.getElementById('p-price').value     = p.price || '';
  document.getElementById('p-stock').value     = p.stock;
  document.getElementById('p-threshold').value = p.threshold;
  document.getElementById('product-modal').classList.add('open');
  setTimeout(() => document.getElementById('p-price').focus(), 80);
}

function closeProductModal() {
  document.getElementById('product-modal')?.classList.remove('open');
  _editingId = null;
}

async function saveProduct() {
  if (!_editingId) return;
  const price     = parseFloat(document.getElementById('p-price').value);
  const stock     = Number(document.getElementById('p-stock').value);
  const threshold = Number(document.getElementById('p-threshold').value || 5);

  if (isNaN(price) || price < 0)                     { showToast('Enter a valid price.', 'error'); return; }
  if (!Number.isInteger(stock) || stock < 0)         { showToast('Enter a whole-number stock quantity.', 'error'); return; }
  if (!Number.isInteger(threshold) || threshold < 0) { showToast('Enter a whole-number threshold.', 'error'); return; }

  const btn = document.getElementById('p-save');
  btn.disabled = true;
  try {
    await State.updateProduct(_editingId, { price, stock, threshold });
    showToast('Saved!', 'success');
    closeProductModal();
    renderProductTable();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.getElementById('product-modal')?.classList.contains('open')) {
    saveProduct();
  }
});
