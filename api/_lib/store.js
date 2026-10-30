// Where POS data lives: Supabase when configured, otherwise a local JSON file
// (handy for trying the POS before Supabase is set up; not for production).
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { db, supabaseConfigured } from './supabase.js';
import { HttpError } from './http.js';

const num = v => (v === null || v === undefined ? v : Number(v));
const normProduct = p => ({ ...p, price: num(p.price), stock: num(p.stock), threshold: num(p.threshold) });
const normTxn = t => ({ ...t, subtotal: num(t.subtotal), discount: num(t.discount), total: num(t.total), cash: num(t.cash), change: num(t.change) });

const supabaseStore = {
  kind: 'supabase',
  async listProducts() {
    return (await db.select('pos_products', 'select=*&active=is.true&order=name.asc,variant.asc')).map(normProduct);
  },
  async syncProducts(items) { return db.rpc('pos_sync_products', { p_items: items }); },
  async updateProduct(id, { price, stock, threshold }) {
    return normProduct(await db.rpc('pos_update_product', { p_id: id, p_price: price, p_stock: stock, p_threshold: threshold }));
  },
  async checkout(items, discount, cash) {
    return normTxn(await db.rpc('pos_checkout', { p_items: items, p_discount: discount, p_cash: cash }));
  },
  async listTransactions(limit) {
    return (await db.select('pos_transactions', `select=*&order=created_at.desc&limit=${limit}`)).map(normTxn);
  },
  async logKeyTest(row) {
    try { await db.rpc('pos_log_key_test', { p: row }); } catch (err) { console.warn('[log] key test not saved:', err.message); }
  },
};

// ── Local file fallback ────────────────────────────────────
const FILE = process.env.VERCEL
  ? path.join(os.tmpdir(), 'quickpos.json')
  : path.join(process.cwd(), '.data', 'quickpos.json');

function load() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch { return { products: [], transactions: [], nextId: 1 }; }
}
function save(data) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}
const round2 = n => Math.round(n * 100) / 100;

const fileStore = {
  kind: 'local-file',
  async listProducts() {
    return load().products.filter(p => p.active)
      .sort((a, b) => a.name.localeCompare(b.name) || String(a.variant || '').localeCompare(String(b.variant || '')));
  },
  async syncProducts(items) {
    const data = load();
    const byId = new Map(data.products.map(p => [p.id, p]));
    const now = new Date().toISOString();
    for (const p of data.products) p.active = false;
    for (const item of items) {
      const prev = byId.get(item.id);
      const row = { price: 0, stock: 0, threshold: 5, ...prev, ...item, active: true, synced_at: now, updated_at: now };
      if (prev) Object.assign(prev, row); else data.products.push(row);
    }
    save(data);
    return items.length;
  },
  async updateProduct(id, { price, stock, threshold }) {
    const data = load();
    const p = data.products.find(x => x.id === id);
    if (!p) throw new HttpError(404, 'product not found');
    Object.assign(p, { price: round2(price), stock, threshold, updated_at: new Date().toISOString() });
    save(data);
    return p;
  },
  async checkout(items, discount, cash) {
    const data = load();
    const lines = [];
    let subtotal = 0;
    for (const line of items) {
      const p = data.products.find(x => x.id === line.id && x.active);
      if (!p) throw new HttpError(400, 'A product in the cart is no longer available.');
      if (p.stock < line.qty) throw new HttpError(400, `Not enough stock for ${p.name}.`);
      subtotal += p.price * line.qty;
      lines.push({ p, qty: line.qty });
    }
    const disc = Math.min(Math.max(discount || 0, 0), subtotal);
    const total = subtotal - disc;
    const paid = cash > 0 ? cash : total;
    if (paid < total) throw new HttpError(400, 'Cash is less than total.');
    for (const { p, qty } of lines) p.stock -= qty;
    const txn = {
      id: data.nextId++, created_at: new Date().toISOString(), status: 'Paid',
      items: lines.map(({ p, qty }) => ({ id: p.id, name: p.name + (p.variant ? ` – ${p.variant}` : ''), sku: p.sku, price: p.price, qty })),
      subtotal: round2(subtotal), discount: round2(disc), total: round2(total), cash: round2(paid), change: round2(paid - total),
    };
    data.transactions.unshift(txn);
    save(data);
    return txn;
  },
  async listTransactions(limit) { return load().transactions.slice(0, limit); },
  async logKeyTest() {},
};

export function store() {
  return supabaseConfigured() ? supabaseStore : fileStore;
}
