/* ============================================================
   APIKEY.JS  –  Test an InventaAPI key and show its products
   ============================================================ */

function loadApiKey() {
  const s = State.status;
  const input = document.getElementById('key-input');
  if (input) input.value = pastedKey();
  if (s) document.getElementById('key-endpoint').textContent = s.inventaUrl.replace(/^https?:\/\//, '') + '/daas/v1/catalog';
  renderEnvSnippet();
  renderServerConfig();
  input?.addEventListener('input', renderEnvSnippet);
  input?.addEventListener('keydown', e => { if (e.key === 'Enter') testKey(); });
  document.getElementById('key-search')?.addEventListener('keydown', e => { if (e.key === 'Enter') testKey(); });
}

function renderEnvSnippet() {
  const el = document.getElementById('env-snippet');
  if (!el) return;
  const key = document.getElementById('key-input')?.value.trim();
  const url = State.status?.inventaUrl || 'https://inventaapi.shop';
  el.textContent = `INVENTA_API_KEY=${key || 'paste-your-inventa-api-key-here'}\nINVENTA_API_URL=${url}`;
}

function renderServerConfig() {
  const el = document.getElementById('server-config');
  const s = State.status;
  if (!el || !s) return;
  const row = (label, ok, text) =>
    `<div class="cfg-row"><span>${label}</span><span class="badge ${ok ? 'badge-success' : 'badge-warning'}">${esc(text)}</span></div>`;
  el.innerHTML = `
    <p class="help-text" style="margin:14px 0 6px;"><b>This server right now</b></p>
    ${row('INVENTA_API_KEY', s.envKeySet, s.envKeySet ? 'set · ' + s.envKeyHint : 'not set')}
    ${row('INVENTA_API_URL', true, s.inventaUrl)}
    ${row('Storage', s.storage === 'supabase', s.storage === 'supabase' ? 'Supabase' : 'local file (no Supabase)')}
  `;
}

function toggleKeyVisibility() {
  const input = document.getElementById('key-input');
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  document.getElementById('key-eye').textContent = show ? 'Hide' : 'Show';
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

function usePastedKey() {
  const key = document.getElementById('key-input').value.trim();
  if (State.status?.envKeySet) {
    showToast('This server already uses the key from .env. Change .env to switch keys.', 'error');
    return;
  }
  setPastedKey(key);
  renderConnection();
  showToast(key ? 'Key saved for this tab. Go to Products → Sync from API.' : 'Pasted key cleared.', 'success');
}

async function testKey() {
  const btn = document.getElementById('key-test-btn');
  const out = document.getElementById('key-result');
  const key = document.getElementById('key-input').value.trim();
  const search = document.getElementById('key-search').value.trim();

  if (!key && !State.status?.envKeySet) {
    showToast('Paste an API key first.', 'error');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Testing…';
  out.innerHTML = '';
  document.getElementById('key-products-card').style.display = 'none';

  try {
    const r = await api('test-key', { method: 'POST', body: { key, search } });
    const quota = r.quota ? `${r.quota.used ?? '?'} / ${r.quota.limit ?? '∞'}` : '—';
    out.innerHTML = `
      <div class="result-box ok">
        <div class="result-title">✅ Key works</div>
        <div class="result-grid">
          <div><span>Key</span><b>${esc(r.keyName || '—')}</b></div>
          <div><span>Plan</span><b>${esc(r.plan || '—')}</b></div>
          <div><span>Products</span><b>${r.total}</b></div>
          <div><span>Response</span><b>${r.statusCode} · ${r.latencyMs} ms</b></div>
          <div><span>Requests used</span><b>${esc(quota)}</b></div>
          <div><span>Tested</span><b>${r.source === 'env' ? '.env key' : 'pasted key'} ${esc(r.keyHint)}</b></div>
        </div>
        ${r.message ? `<p class="result-note">${esc(r.message)}</p>` : ''}
        ${r.pagination?.hasNextPage ? `<p class="result-note">Showing page 1 of ${r.pagination.totalPages}. Sync loads every page.</p>` : ''}
      </div>`;
    renderKeyProducts(r.items, r.total);
  } catch (err) {
    const d = err.data || {};
    out.innerHTML = `
      <div class="result-box bad">
        <div class="result-title">❌ ${esc(err.message)}</div>
        ${d.hint ? `<p class="result-note">${esc(d.hint)}</p>` : ''}
        <p class="result-note mono">${d.code ? esc(d.code) + ' · ' : ''}HTTP ${esc(d.statusCode ?? err.status ?? '?')}${d.latencyMs != null ? ' · ' + d.latencyMs + ' ms' : ''}</p>
      </div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = '▶ Test key';
  }
}

function renderKeyProducts(items, total) {
  const card = document.getElementById('key-products-card');
  const body = document.getElementById('key-products-body');
  card.style.display = '';
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
