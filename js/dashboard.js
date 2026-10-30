/* ============================================================
   DASHBOARD.JS  –  Dashboard page logic
   ============================================================ */

function loadDashboard() {
  const today = new Date().toDateString();

  const todayTxns  = State.transactions.filter(t => new Date(t.ts).toDateString() === today);
  const todaySales = todayTxns.reduce((s, t) => s + t.total, 0);
  const todayItems = todayTxns.reduce((s, t) => s + t.items.reduce((a, i) => a + i.qty, 0), 0);
  const lowStock   = State.products.filter(p => p.stock > 0 && p.stock <= p.threshold).length;
  const outStock   = State.products.filter(p => p.stock === 0).length;

  // Stat cards
  document.getElementById('dash-sales').textContent      = peso(todaySales);
  document.getElementById('dash-txn-count').textContent  = todayTxns.length + ' transaction' + (todayTxns.length !== 1 ? 's' : '') + ' today';
  document.getElementById('dash-products').textContent   = State.products.length;
  document.getElementById('dash-low-stock').textContent  = lowStock + ' low · ' + outStock + ' out';
  document.getElementById('dash-items').textContent      = todayItems;
  document.getElementById('dash-all-txn').textContent    = State.transactions.length;

  // Recent transactions (last 8, newest first)
  const recentBody = document.getElementById('dash-recent-body');
  const recent = [...State.transactions].reverse().slice(0, 8);

  if (recent.length === 0) {
    recentBody.innerHTML = '<tr class="empty-row"><td colspan="5">No transactions yet</td></tr>';
  } else {
    recentBody.innerHTML = recent.map((t, i) => `
      <tr>
        <td><b>#${(State.transactions.length - i).toString().padStart(4, '0')}</b></td>
        <td>${formatDate(t.ts)}</td>
        <td>${t.items.reduce((a, x) => a + x.qty, 0)} item(s)</td>
        <td>${peso(t.total)}</td>
        <td>
          <span class="badge ${t.status === 'Paid' ? 'badge-success' : 'badge-danger'}">
            ${t.status}
          </span>
        </td>
      </tr>
    `).join('');
  }

  // Top products by qty sold
  const salesMap = {};
  State.transactions.forEach(t =>
    t.items.forEach(i => {
      if (!salesMap[i.name]) salesMap[i.name] = { qty: 0, rev: 0 };
      salesMap[i.name].qty += i.qty;
      salesMap[i.name].rev += i.qty * i.price;
    })
  );

  const topList  = document.getElementById('dash-top-products');
  const topItems = Object.entries(salesMap)
    .sort((a, b) => b[1].qty - a[1].qty)
    .slice(0, 6);

  if (topItems.length === 0) {
    topList.innerHTML = '<li style="justify-content:center; color:var(--text-xs); padding:28px 0;">No data yet</li>';
  } else {
    topList.innerHTML = topItems.map(([name, d], i) => `
      <li>
        <span class="top-p-rank">${i + 1}</span>
        <span class="top-p-name">${name}</span>
        <span class="top-p-qty">${d.qty} sold</span>
        <span class="top-p-rev">${peso(d.rev)}</span>
      </li>
    `).join('');
  }
}
