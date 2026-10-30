// POST /api/sync — loads every product the API key returns into the POS.
// Prices and stock you set in the POS are kept; products the key no longer
// returns are hidden from the POS.
import { route } from './_lib/http.js';
import { keyHint } from './_lib/config.js';
import { resolveKey } from './_lib/key.js';
import { fetchFullCatalog, toPosItems } from './_lib/inventa.js';
import { store } from './_lib/store.js';

export default route({
  POST: async () => {
    const { key, source } = resolveKey();
    const catalog = await fetchFullCatalog(key);
    const items = toPosItems(catalog.products);
    await store().syncProducts(items);
    return {
      ok: true, source, keyHint: keyHint(key),
      keyName: catalog.meta.keyName ?? null, plan: catalog.meta.plan ?? null,
      products: catalog.products.length, items: items.length, pages: catalog.pages,
      message: catalog.message,
    };
  },
});
