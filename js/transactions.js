/* ============================================================
   TRANSACTIONS.JS  –  Transaction history and export
   ============================================================ */

// ── Load ───────────────────────────────────────────────────
function loadTransactions() {
  renderTransactionSummary();
  renderTransactionTable();
}

// ── Summary Row ────────────────────────────────────────────
function renderTransactionSummary() {
  const txns         = State.transactions;
  const totalRev     = txns.reduce((s, t) => s + t.total,    0);
  const totalDisc    = txns.reduce((s, t) => s + t.discount, 0);

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('txn-total-rev',      peso(totalRev));
  set('txn-total-count',    txns.length);
  set('txn-total-discount', peso(totalDisc));
}

// ── Table ──────────────────────────────────────────────────
function filterTransactions() {
  renderTransactionTable();
}

function renderTransactionTable() {
  const q = (document.getElementById('txn-search')?.value || '').toLowerCase();

  const list = State.transactions
    .filter(t =>
      receiptNo(t).includes(q) ||
      formatDate(t.created_at).toLowerCase().includes(q) ||
      t.items.some(i => i.name.toLowerCase().includes(q)) ||
      peso(t.total).includes(q)
    );

  const countLabel = document.getElementById('txn-count-label');
  if (countLabel) countLabel.textContent = list.length + ' record' + (list.length !== 1 ? 's' : '');

  const tbody = document.getElementById('txn-table-body');
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="9">No transactions found.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(t => {
    return `
      <tr>
        <td><b>${receiptNo(t)}</b></td>
        <td style="white-space:nowrap;">${formatDate(t.created_at)}</td>
        <td style="font-size:12px; color:var(--text-sm); max-width:220px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
          ${esc(t.items.map(x => x.name + ' ×' + x.qty).join(', '))}
        </td>
        <td>${peso(t.subtotal)}</td>
        <td>${t.discount > 0 ? '<span style="color:var(--warning); font-weight:600;">-' + peso(t.discount) + '</span>' : '—'}</td>
        <td><b>${peso(t.total)}</b></td>
        <td>${peso(t.cash)}</td>
        <td>${peso(t.change)}</td>
        <td>
          <span class="badge ${t.status === 'Paid' ? 'badge-success' : 'badge-danger'}">
            ${esc(t.status)}
          </span>
        </td>
      </tr>
    `;
  }).join('');
}

// ── CSV Export ─────────────────────────────────────────────
function exportCSV() {
  if (State.transactions.length === 0) {
    showToast('No transactions to export.', 'error');
    return;
  }

  const headers = ['Receipt','Date','Items','Subtotal','Discount','Total','Cash','Change','Status'];
  const csvCell = v => '"' + String(v).replace(/"/g, '""') + '"';
  const rows = State.transactions.map(t => [
    receiptNo(t),
    csvCell(formatDate(t.created_at)),
    csvCell(t.items.map(x => x.name + ' x' + x.qty).join(', ')),
    t.subtotal.toFixed(2),
    t.discount.toFixed(2),
    t.total.toFixed(2),
    t.cash.toFixed(2),
    t.change.toFixed(2),
    t.status,
  ]);

  const csv     = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob    = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url     = URL.createObjectURL(blob);
  const anchor  = document.createElement('a');
  anchor.href     = url;
  anchor.download = 'transactions_' + new Date().toISOString().slice(0, 10) + '.csv';
  anchor.click();
  URL.revokeObjectURL(url);
  showToast('Exported successfully!', 'success');
}
