/* ============================================================
   APIKEY.JS  –  Test each store's InventaAPI key (from .env)
   ============================================================ */

function loadApiKey() {
  const s = State.status;
  if (s) document.getElementById('key-endpoint').textContent = s.inventaUrl.replace(/^https?:\/\//, '') + '/daas/v1/catalog';
  renderStoreKeys();
  renderEnvSnippet();
  renderServerConfig();
  document.getElementById('key-search')?.addEventListener('keydown', e => { if (e.key === 'Enter') testKey(State.store); });
}

function renderStoreKeys() {
  const el = document.getElementById('store-keys');
  if (!el || !State.status) return;
  el.innerHTML = State.status.stores.map(st => `
    <div class="store-key ${st.id === State.store ? 'current' : ''}">
      <span class="store-key-icon">${esc(st.icon)}</span>
      <div class="store-key-info">
        <b>${esc(st.label)}</b>
        ${st.keySet ? `<span class="badge badge-success">key found · <span class="mono">${esc(st.keyHint)}</span></span>`
                    : '<span class="badge badge-warning">no key yet</span>'}
        <div class="env">${esc(st.env)}</div>
      </div>
      <button class="btn btn-primary btn-sm" data-store="${esc(st.id)}" onclick="testKey(this.dataset.store)" ${st.keySet ? '' : 'disabled'}>▶ Test</button>
    </div>`).join('');
}

async function recheckKey() {
  try {
    State.status = await api('status');
    renderConnection();
    loadApiKey();
    const found = State.status.stores.filter(s => s.keySet).map(s => s.label);
    showToast(found.length ? `Keys found: ${found.join(', ')}.` : 'No keys yet. Did you save .env and restart the server?',
      found.length ? 'success' : 'error');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderEnvSnippet() {
  const el = document.getElementById('env-snippet');
  if (!el) return;
  const url = State.status?.inventaUrl || 'https://inventaapi.shop';
  el.textContent = 'INVENTA_API_KEY_GROCERY=paste-grocery-key-here\n'
    + 'INVENTA_API_KEY_PHARMACY=paste-pharmacy-key-here\n'
    + 'INVENTA_API_KEY_HARDWARE=paste-hardware-key-here\n'
    + `INVENTA_API_URL=${url}`;
}

function renderServerConfig() {
  const el = document.getElementById('server-config');
  const s = State.status;
  if (!el || !s) return;
  const row = (label, ok, text) =>
    `<div class="cfg-row"><span>${esc(label)}</span><span class="badge ${ok ? 'badge-success' : 'badge-warning'}">${esc(text)}</span></div>`;
  el.innerHTML = `
    <p class="help-text" style="margin:14px 0 6px;"><b>This server right now</b></p>
    ${s.stores.map(st => row(st.env, st.keySet, st.keySet ? 'set · ' + st.keyHint : 'not set')).join('')}
    ${row('INVENTA_API_URL', true, s.inventaUrl)}
    ${row('Storage', s.storage === 'supabase', s.storage === 'supabase' ? 'Supabase' : 'local file (no Supabase)')}
  `;
}

async function copyEnv() {
  const text = document.getElementById('env-snippet').textContent;
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copied. Paste it into your .env file.', 'success');
  } catch {
    showToast('Copy failed — select the text and copy it manually.', 'error');
  }
}

async function testKey(storeId) {
  const st = State.status?.stores.find(s => s.id === storeId);
  if (!st?.keySet) return;
  const btn = document.querySelector(`.store-key button[data-store="${storeId}"]`);
  const out = document.getElementById('key-result');
  const search = document.getElementById('key-search').value.trim();

  if (btn) { btn.disabled = true; btn.textContent = 'Testing…'; }
  out.innerHTML = '';
  document.getElementById('key-products-card').style.display = 'none';

  try {
    const r = await api('test-key', { method: 'POST', body: { search }, store: storeId });
    const quota = r.quota ? `${r.quota.used ?? '?'} / ${r.quota.limit ?? '∞'}` : '—';
    out.innerHTML = `
      <div class="result-box ok">
        <div class="result-title">✅ ${esc(st.label)} key works</div>
        <div class="result-grid">
          <div><span>Key</span><b>${esc(r.keyName || '—')}</b></div>
          <div><span>Plan</span><b>${esc(r.plan || '—')}</b></div>
          <div><span>Products</span><b>${r.total}</b></div>
          <div><span>Response</span><b>${r.statusCode} · ${r.latencyMs} ms</b></div>
          <div><span>${r.quota?.unit === 'products' ? 'Variants used this month' : 'Requests used'}</span><b>${esc(quota)}</b></div>
          <div><span>Tested</span><b class="mono">${esc(r.keyHint)}</b></div>
        </div>
        ${r.message ? `<p class="result-note">${esc(r.message)}</p>` : ''}
        ${r.quotaMessage ? `<p class="result-note">⚠️ ${esc(r.quotaMessage)}</p>` : ''}
        ${r.pagination?.hasNextPage ? `<p class="result-note">Showing page 1 of ${r.pagination.totalPages}. Sync loads every page.</p>` : ''}
      </div>`;
    renderKeyProducts(st, r.items, r.total);
  } catch (err) {
    const d = err.data || {};
    out.innerHTML = `
      <div class="result-box bad">
        <div class="result-title">❌ ${esc(st.label)}: ${esc(err.message)}</div>
        ${d.hint ? `<p class="result-note">${esc(d.hint)}</p>` : ''}
        <p class="result-note mono">${d.code ? esc(d.code) + ' · ' : ''}HTTP ${esc(d.statusCode ?? err.status ?? '?')}${d.latencyMs != null ? ' · ' + d.latencyMs + ' ms' : ''}</p>
      </div>`;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '▶ Test'; }
  }
}

function renderKeyProducts(st, items, total) {
  const card = document.getElementById('key-products-card');
  const body = document.getElementById('key-products-body');
  card.style.display = '';
  document.getElementById('key-products-title').textContent = `Products on the ${st.label} key`;
  document.getElementById('key-products-count').textContent =
    `${items.length} item${items.length !== 1 ? 's' : ''} (variants) · ${total} product${total !== 1 ? 's' : ''}`;
  if (items.length === 0) {
    body.innerHTML = '<tr class="empty-row"><td colspan="7">No products are linked to this key. Add products to it on inventaapi.shop.</td></tr>';
    return;
  }
  body.innerHTML = items.map(p => `
    <tr>
      <td>${p.image_url ? `<img class="thumb" src="${esc(p.image_url)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : ''}</td>
      <td><b>${esc(p.name)}</b></td>
      <td>${esc(p.variant || '—')}</td>
      <td class="mono">${esc(p.sku || '—')}</td>
      <td>${p.category ? `<span class="badge badge-gray">${esc(p.category)}</span>` : '—'}</td>
      <td>${esc(p.segment || '—')}</td>
      <td class="mono small">${esc(p.product_id)}</td>
    </tr>`).join('');
}
