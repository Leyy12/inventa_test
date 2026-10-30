// Reads settings from environment variables (.env locally, Project Settings on Vercel).
// Secrets never leave the server: /api/status only reports whether they are set.

// Each store has its own InventaAPI key, so each store sells its own products.
export const STORES = [
  { id: 'grocery',  label: 'Grocery',  icon: '🛒', env: 'INVENTA_API_KEY_GROCERY' },
  { id: 'pharmacy', label: 'Pharmacy', icon: '💊', env: 'INVENTA_API_KEY_PHARMACY' },
  { id: 'hardware', label: 'Hardware', icon: '🔧', env: 'INVENTA_API_KEY_HARDWARE' },
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
  return store ? (process.env[store.env] || '').trim() : '';
}

// "abcdef…wxyz" — enough to recognise a key without revealing it.
export function keyHint(key) {
  if (!key) return null;
  return key.length <= 10 ? '••••' : `${key.slice(0, 6)}…${key.slice(-4)}`;
}
