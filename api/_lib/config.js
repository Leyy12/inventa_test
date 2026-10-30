// Reads settings from environment variables (.env locally, Project Settings on Vercel).
// Secrets never leave the server: /api/status only reports whether they are set.

// One InventaAPI key (Pro Max) covers all three stores; each store sells only its
// segment's products. Older per-store keys still work when INVENTA_API_KEY is not set.
export const STORES = [
  { id: 'grocery',  label: 'Grocery',  icon: '🛒', segment: 'Grocery',  env: 'INVENTA_API_KEY_GROCERY' },
  { id: 'pharmacy', label: 'Pharmacy', icon: '💊', segment: 'Pharmacy', env: 'INVENTA_API_KEY_PHARMACY' },
  { id: 'hardware', label: 'Hardware', icon: '🔧', segment: 'Hardware', env: 'INVENTA_API_KEY_HARDWARE' },
];

export function config() {
  const env = process.env;
  return {
    inventaUrl: (env.INVENTA_API_URL || env.INVENTA_API_BASE_URL || 'https://inventaapi.shop').replace(/\/+$/, ''),
    supabaseUrl: (env.SUPABASE_URL || '').replace(/\/+$/, ''),
    // A secret key works too, but the publishable key is enough: the POS tables only
    // accept writes through the validated pos_* database functions.
    supabaseKey: (env.SUPABASE_SECRET_KEY || env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || '').trim(),
  };
}

export function storeKey(storeId) {
  const store = STORES.find(s => s.id === storeId);
  if (!store) return '';
  return (process.env.INVENTA_API_KEY || process.env[store.env] || '').trim();
}

// Which .env line a store's key comes from (shown on the API Key page).
export function storeKeySource(storeId) {
  const store = STORES.find(s => s.id === storeId);
  if ((process.env.INVENTA_API_KEY || '').trim()) return 'INVENTA_API_KEY';
  return store && (process.env[store.env] || '').trim() ? store.env : 'INVENTA_API_KEY';
}

// "abcdef…wxyz" — enough to recognise a key without revealing it.
export function keyHint(key) {
  if (!key) return null;
  return key.length <= 10 ? '••••' : `${key.slice(0, 6)}…${key.slice(-4)}`;
}
