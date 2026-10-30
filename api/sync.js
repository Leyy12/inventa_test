// POST /api/sync?store=grocery — loads every product the store's API key returns.
// Prices and stock set in the POS are kept; products the key no longer returns
// are hidden from that store.
import { route } from './_lib/http.js';
import { keyHint } from './_lib/config.js';
import { resolveStore, resolveKey } from './_lib/key.js';
import { fetchFullCatalog, toPosItems } from './_lib/inventa.js';
import { store } from './_lib/store.js';

export default route({
  POST: async req => {
    const shop = resolveStore(req);
    const key = resolveKey(shop);
    const catalog = await fetchFullCatalog(key, { segment: shop.segment });
    const items = toPosItems(catalog.products, shop.id);
    await store().syncProducts(shop.id, items);
    return {
      ok: true, store: shop.id, keyHint: keyHint(key),
      keyName: catalog.meta.keyName ?? null, plan: catalog.meta.plan ?? null,
      products: catalog.products.length, items: items.length, pages: catalog.pages,
      message: catalog.message,
    };
  },
});
