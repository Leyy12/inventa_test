// POST /api/test-key  { key?, search? }
// Calls InventaAPI's catalog with the given key (or the .env key) and reports
// whether it works and which products it returns. Nothing is saved to the POS.
import { route, readJson, HttpError } from './_lib/http.js';
import { config, keyHint } from './_lib/config.js';
import { fetchCatalogPage, toPosItems } from './_lib/inventa.js';
import { store } from './_lib/store.js';

export default route({
  POST: async req => {
    const body = await readJson(req);
    const pasted = typeof body.key === 'string' ? body.key.trim() : '';
    const key = pasted || config().inventaKey;
    const source = pasted ? 'pasted' : 'env';
    const search = typeof body.search === 'string' ? body.search.trim().slice(0, 100) : '';
    if (!key) throw new HttpError(400, 'Paste an API key, or set INVENTA_API_KEY in .env.');
    if (key.length > 300) throw new HttpError(400, 'That does not look like an API key.');

    const log = { key_hint: keyHint(key), search: search || null };
    try {
      const { body: data, latencyMs, statusCode } = await fetchCatalogPage(key, { search });
      const meta = data.meta || {};
      const products = data.products || [];
      await store().logKeyTest({ ...log, status_code: statusCode, ok: true, latency_ms: latencyMs,
        product_count: products.length, product_total: meta.total ?? products.length, plan: meta.plan ?? null, key_name: meta.keyName ?? null });
      return {
        ok: true, source, keyHint: keyHint(key), statusCode, latencyMs,
        keyName: meta.keyName ?? null, plan: meta.plan ?? null,
        total: meta.total ?? products.length, count: products.length,
        pagination: meta.pagination || null, quota: meta.quota || null,
        message: data.message || null,
        products, items: toPosItems(products),
      };
    } catch (err) {
      if (!(err instanceof HttpError)) throw err;
      await store().logKeyTest({ ...log, status_code: err.extra?.statusCode ?? err.status, ok: false,
        latency_ms: err.extra?.latencyMs ?? null, error: err.message });
      throw new HttpError(err.status, err.message, { ...err.extra, ok: false, source, keyHint: keyHint(key) });
    }
  },
});
