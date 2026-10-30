// GET /api/status — what is configured (never the secret values themselves).
import { route } from './_lib/http.js';
import { config, keyHint } from './_lib/config.js';
import { store } from './_lib/store.js';

export default route({
  GET: () => {
    const c = config();
    return {
      inventaUrl: c.inventaUrl,
      envKeySet: Boolean(c.inventaKey),
      envKeyHint: keyHint(c.inventaKey),
      storage: store().kind,               // "supabase" or "local-file"
      supabaseUrl: c.supabaseUrl || null,
      onVercel: Boolean(process.env.VERCEL),
    };
  },
});
