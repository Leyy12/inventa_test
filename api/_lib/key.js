import { STORES, storeKey } from './config.js';
import { HttpError } from './http.js';

// Which store a request is for: ?store=grocery|pharmacy|hardware (default grocery).
export function resolveStore(req) {
  const url = new URL(req.url, 'http://local');
  const id = url.searchParams.get('store') || 'grocery';
  const store = STORES.find(s => s.id === id);
  if (!store) throw new HttpError(400, 'Unknown store. Use grocery, pharmacy or hardware.');
  return store;
}

// The API key lives only in the code's environment: the .env file locally, or
// Environment Variables on Vercel. The website never asks for it.
export function resolveKey(store) {
  const key = storeKey(store.id);
  if (!key) {
    throw new HttpError(400, `No API key for ${store.label}. Add ${store.env} to your .env file and restart the server.`);
  }
  return key;
}
