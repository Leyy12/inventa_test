// GET /api/transactions?store=grocery&limit=500 — newest first
import { route } from './_lib/http.js';
import { store } from './_lib/store.js';
import { resolveStore } from './_lib/key.js';

export default route({
  GET: async req => {
    const url = new URL(req.url, 'http://local');
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit'), 10) || 500, 1), 1000);
    return { transactions: await store().listTransactions(resolveStore(req).id, limit) };
  },
});
