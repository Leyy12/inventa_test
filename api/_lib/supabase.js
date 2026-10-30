// Minimal Supabase REST client (PostgREST) — no SDK needed.
import { config } from './config.js';
import { HttpError } from './http.js';

export function supabaseConfigured() {
  const { supabaseUrl, supabaseKey } = config();
  return Boolean(supabaseUrl && supabaseKey);
}

async function request(path, { method = 'GET', body } = {}) {
  const { supabaseUrl, supabaseKey } = config();
  if (!supabaseUrl || !supabaseKey) {
    throw new HttpError(503, 'Supabase is not configured. Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in .env.');
  }
  const headers = { apikey: supabaseKey, 'Content-Type': 'application/json' };
  // Legacy JWT keys also go in Authorization; new sb_* keys only need the apikey header.
  if (supabaseKey.startsWith('eyJ')) headers.Authorization = `Bearer ${supabaseKey}`;

  let res;
  try {
    res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new HttpError(502, 'Could not reach Supabase.');
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    // Errors raised by our pos_* functions are written for people; pass them through.
    const message = data?.message || `Supabase error (${res.status}).`;
    throw new HttpError(res.status >= 500 ? 502 : 400, message);
  }
  return data;
}

export const db = {
  select: (table, query = '') => request(`${table}?${query}`),
  rpc: (fn, args) => request(`rpc/${fn}`, { method: 'POST', body: args }),
};
