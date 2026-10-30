// POST /api/checkout { items: [{id, qty}], discount, cash }
// Prices are taken from the database, not from the browser.
import { route, readJson, HttpError } from './_lib/http.js';
import { store } from './_lib/store.js';

export default route({
  POST: async req => {
    const body = await readJson(req);
    if (!Array.isArray(body.items) || body.items.length === 0) throw new HttpError(400, 'Cart is empty.');
    const items = body.items.map(i => ({ id: String(i.id || ''), qty: Number(i.qty) }));
    if (items.some(i => !i.id || !Number.isInteger(i.qty) || i.qty < 1)) throw new HttpError(400, 'Invalid cart.');
    const discount = Math.max(0, Number(body.discount) || 0);
    const cash = Math.max(0, Number(body.cash) || 0);
    return { transaction: await store().checkout(items, discount, cash) };
  },
});
