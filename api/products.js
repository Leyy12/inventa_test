// GET   /api/products                              — POS products (synced from the API key)
// PATCH /api/products { id, price, stock, threshold } — set selling price and stock
import { route, readJson, HttpError } from './_lib/http.js';
import { store } from './_lib/store.js';

function number(value, name, { integer = false } = {}) {
  const n = Number(value);
  if (value === '' || value === null || !Number.isFinite(n) || n < 0 || (integer && !Number.isInteger(n))) {
    throw new HttpError(400, `Enter a valid ${name}.`);
  }
  return n;
}

export default route({
  GET: async () => ({ products: await store().listProducts() }),
  PATCH: async req => {
    const body = await readJson(req);
    if (typeof body.id !== 'string' || !body.id) throw new HttpError(400, 'Missing product id.');
    const product = await store().updateProduct(body.id, {
      price: number(body.price, 'price'),
      stock: number(body.stock, 'stock quantity', { integer: true }),
      threshold: number(body.threshold ?? 5, 'low-stock threshold', { integer: true }),
    });
    return { product };
  },
});
