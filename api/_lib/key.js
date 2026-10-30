import { config } from './config.js';

// The API key lives only in the code's environment: the .env file locally, or
// Environment Variables on Vercel. The website never asks for it.
export function resolveKey() {
  const { inventaKey } = config();
  return { key: inventaKey, source: inventaKey ? 'env' : 'none' };
}
