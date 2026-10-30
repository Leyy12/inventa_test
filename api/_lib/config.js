// Reads settings from environment variables (.env locally, Project Settings on Vercel).
// Secrets never leave the server: /api/status only reports whether they are set.

export function config() {
  const env = process.env;
  return {
    inventaUrl: (env.INVENTA_API_URL || env.INVENTA_API_BASE_URL || 'https://inventaapi.shop').replace(/\/+$/, ''),
    inventaKey: (env.INVENTA_API_KEY || '').trim(),
    supabaseUrl: (env.SUPABASE_URL || '').replace(/\/+$/, ''),
    // A secret key works too, but the publishable key is enough: the POS tables only
    // accept writes through the validated pos_* database functions.
    supabaseKey: (env.SUPABASE_SECRET_KEY || env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || '').trim(),
  };
}

// "abcd…wxyz" — enough to recognise a key without revealing it.
export function keyHint(key) {
  if (!key) return null;
  return key.length <= 10 ? '••••' : `${key.slice(0, 6)}…${key.slice(-4)}`;
}
