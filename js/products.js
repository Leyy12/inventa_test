/* ============================================================
   PRODUCTS.JS  –  Product management (CRUD)
   ============================================================ */

let _editingId  = null;
let _deletingId = null;

// ── Load ───────────────────────────────────────────────────
function loadProducts() {
  renderProductTable();
}

// ── Filter & Render Table ──────────────────────────────────
function filterProducts() {
  renderProductTable();
}

function renderProductTable() {
  const q   = (document.getElementById('product-search')?.value  || '').toLowerCase();
  const cat = (document.getElementById('product-category-filter')?.value || '');

  let list = State.products.filter(p => {
    const matchQ   = p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
    const matchCat = !cat || p.category === cat;
    return matchQ && matchCat;
  });

  const countEl = document.getElementById('product-count');
  if (countEl) countEl.textContent = list.length + ' product' + (list.length !== 1 ? 's' : '');

  const tbody = document.getElementById('product-table-body');
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="7">No products found.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map((p, i) => {
    let badgeClass = 'badge-success', badgeLabel = 'In Stock';
    if (p.stock === 0)               { badgeClass = 'badge-danger';  badgeLabel = 'Out of Stock'; }
    else if (p.stock <= p.threshold) { badgeClass = 'badge-warning'; badgeLabel = 'Low Stock'; }

    return `
      <tr>
        <td>${i + 1}</td>
        <td><b>${p.name}</b></td>
        <td><span class="badge badge-gray">${p.category}</span></td>
        <td>${peso(p.price)}</td>
        <td>
          <span style="font-weight:700; color:${p.stock === 0 ? 'var(--danger)' : p.stock <= p.threshold ? 'var(--warning)' : 'var(--text)'}">
            ${p.stock}
          </span>
        </td>
        <td><span class="badge ${badgeClass}">${badgeLabel}</span></td>
        <td>
          <div class="action-btns">
            <button class="btn btn-warning btn-sm" onclick="openProductModal('${p.id}')">✏️ Edit</button>
            <button class="btn btn-danger  btn-sm" onclick="openDeleteModal('${p.id}')">🗑️ Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// ── Product Modal ──────────────────────────────────────────
function openProductModal(id = null) {
  _editingId = id;
  const title = document.getElementById('product-modal-title');
  title.textContent = id ? 'Edit Product' : 'Add Product';

  if (id) {
    const p = State.products.find(x => x.id === id);
    if (!p) return;
    document.getElementById('p-name').value      = p.name;
    document.getElementById('p-category').value  = p.category;
    document.getElementById('p-price').value     = p.price;
    document.getElementById('p-stock').value     = p.stock;
    document.getElementById('p-threshold').value = p.threshold;
  } else {
    document.getElementById('p-name').value      = '';
    document.getElementById('p-category').value  = 'Beverages';
    document.getElementById('p-price').value     = '';
    document.getElementById('p-stock').value     = '';
    document.getElementById('p-threshold').value = '5';
  }

  document.getElementById('product-modal').classList.add('open');
  setTimeout(() => document.getElementById('p-name').focus(), 80);
}

function closeProductModal() {
  document.getElementById('product-modal')?.classList.remove('open');
  _editingId = null;
}

function saveProduct() {
  const name      = document.getElementById('p-name').value.trim();
  const category  = document.getElementById('p-category').value;
  const price     = parseFloat(document.getElementById('p-price').value);
  const stock     = parseInt(document.getElementById('p-stock').value);
  const threshold = parseInt(document.getElementById('p-threshold').value) || 5;

  if (!name)                      { showToast('Product name is required.',    'error'); return; }
  if (isNaN(price) || price < 0)  { showToast('Enter a valid price.',         'error'); return; }
  if (isNaN(stock) || stock < 0)  { showToast('Enter a valid stock quantity.','error'); return; }

  if (_editingId) {
    State.updateProduct(_editingId, { name, category, price, stock, threshold });
    showToast('Product updated!', 'success');
  } else {
    State.addProduct({ id: genId(), name, category, price, stock, threshold });
    showToast('Product added!', 'success');
  }

  closeProductModal();
  renderProductTable();
}

// ── Delete Modal ───────────────────────────────────────────
function openDeleteModal(id) {
  _deletingId = id;
  const p = State.products.find(x => x.id === id);
  const nameEl = document.getElementById('delete-product-name');
  if (nameEl && p) nameEl.textContent = '"' + p.name + '"';
  document.getElementById('delete-modal').classList.add('open');
}

function closeDeleteModal() {
  document.getElementById('delete-modal')?.classList.remove('open');
  _deletingId = null;
}

function confirmDelete() {
  if (!_deletingId) return;
  State.deleteProduct(_deletingId);
  closeDeleteModal();
  renderProductTable();
  showToast('Product deleted.', '');
}

// Allow Enter key in modal to save
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.getElementById('product-modal')?.classList.contains('open')) {
    saveProduct();
  }
});
