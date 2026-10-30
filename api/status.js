// GET /api/status — what is configured (never the secret values themselves).
import { route } from './_lib/http.js';
import { config, keyHint, STORES, storeKey } from './_lib/config.js';
import { store } from './_lib/store.js';

export default route({
  GET: () => {
    const c = config();
    return {
      inventaUrl: c.inventaUrl,
      stores: STORES.map(s => {
        const key = storeKey(s.id);
        return { id: s.id, label: s.label, icon: s.icon, env: s.env, keySet: Boolean(key), keyHint: keyHint(key) };
      }),
      storage: store().kind,               // "supabase" or "local-file"
      supabaseUrl: c.supabaseUrl || null,
      onVercel: Boolean(process.env.VERCEL),
    };
  },
});
