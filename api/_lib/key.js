import { config } from './config.js';

// The key in .env (or Vercel env vars) is the POS's key. When none is set, the key
// pasted on the API Key page is used instead; the browser sends it in the
// x-inventa-key header and keeps it only for that tab's session.
export function resolveKey(req) {
  const { inventaKey } = config();
  if (inventaKey) return { key: inventaKey, source: 'env' };
  const header = req.headers['x-inventa-key'];
  const pasted = typeof header === 'string' ? header.trim() : '';
  return { key: pasted, source: pasted ? 'pasted' : 'none' };
}
