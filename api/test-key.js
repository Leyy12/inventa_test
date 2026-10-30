// POST /api/test-key?store=grocery  { search? }
// Calls InventaAPI's catalog with that store's key from .env and reports
// whether it works and which products it returns. Nothing is saved to the POS.
import { route, readJson, HttpError } from './_lib/http.js';
import { keyHint } from './_lib/config.js';
import { resolveStore, resolveKey } from './_lib/key.js';
import { fetchCatalogPage, toPosItems } from './_lib/inventa.js';
import { store } from './_lib/store.js';

export default route({
  POST: async req => {
    const body = await readJson(req);
    const shop = resolveStore(req);
    const key = resolveKey(shop);
    const source = 'env';
    const search = typeof body.search === 'string' ? body.search.trim().slice(0, 100) : '';

    const log = { key_hint: `${shop.id}: ${keyHint(key)}`, search: search || null };
    try {
      const { body: data, latencyMs, statusCode } = await fetchCatalogPage(key, { search });
      const meta = data.meta || {};
      const products = data.products || [];
      await store().logKeyTest({ ...log, status_code: statusCode, ok: true, latency_ms: latencyMs,
        product_count: products.length, product_total: meta.total ?? products.length, plan: meta.plan ?? null, key_name: meta.keyName ?? null });
      return {
        ok: true, store: shop.id, source, keyHint: keyHint(key), statusCode, latencyMs,
        keyName: meta.keyName ?? null, plan: meta.plan ?? null,
        total: meta.total ?? products.length, count: products.length,
        pagination: meta.pagination || null, quota: meta.quota || null,
        message: data.message || null,
        products, items: toPosItems(products, shop.id),
      };
    } catch (err) {
      if (!(err instanceof HttpError)) throw err;
      await store().logKeyTest({ ...log, status_code: err.extra?.statusCode ?? err.status, ok: false,
        latency_ms: err.extra?.latencyMs ?? null, error: err.message });
      throw new HttpError(err.status, err.message, { ...err.extra, ok: false, source, keyHint: keyHint(key) });
    }
  },
});
