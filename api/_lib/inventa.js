// Calls the InventaAPI DaaS catalog: GET {INVENTA_API_URL}/daas/v1/catalog with x-api-key.
import { config } from './config.js';
import { HttpError } from './http.js';

// Paid InventaAPI plans count product variants delivered (Pro 15,000, Pro Max 20,000
// a month, shared by its segments), so a sync uses one per variant it receives. Stop after this many pages as a safety net.
const MAX_PAGES = 20;

// Plain-language explanations for the errors InventaAPI returns.
const HINTS = {
  INVALID_API_KEY: 'The key is wrong, revoked, or was regenerated. Copy it again from inventaapi.shop → API Keys.',
  ACCOUNT_NOT_FOUND: 'The account that owns this key no longer exists.',
  PLAN_UPGRADE_REQUIRED: 'The account plan does not allow this request.',
  'Rate Limit Exceeded': 'The key used up its request allowance. Wait for the reset or upgrade the plan.',
  SERVICE_UNAVAILABLE: 'InventaAPI could not verify the key right now. Try again in a minute.',
};

export async function fetchCatalogPage(apiKey, { page = 1, search = '', segment = '' } = {}) {
  const { inventaUrl } = config();
  if (!apiKey) throw new HttpError(400, 'No API key found in .env.');

  const url = new URL(`${inventaUrl}/daas/v1/catalog`);
  if (page > 1) url.searchParams.set('page', String(page));
  if (search) url.searchParams.set('search', search);
  // Only this store's segment: a Pro Max key holds all three, and each segment has its own allowance.
  if (segment) url.searchParams.set('segment', segment);

  const started = Date.now();
  let res;
  try {
    res = await fetch(url, {
      headers: { 'x-api-key': apiKey, Accept: 'application/json' },
      signal: AbortSignal.timeout(20000),
    });
  } catch (err) {
    throw new HttpError(502, `Could not reach ${inventaUrl}. ${err.name === 'TimeoutError' ? 'The request timed out.' : 'Check INVENTA_API_URL and your internet connection.'}`,
      { statusCode: 0, latencyMs: Date.now() - started });
  }
  const latencyMs = Date.now() - started;
  let body = null;
  try { body = await res.json(); } catch { /* non-JSON error page */ }

  if (!res.ok) {
    const code = body?.error || `HTTP_${res.status}`;
    const message = body?.message || `InventaAPI answered ${res.status}.`;
    throw new HttpError(res.status === 401 || res.status === 403 || res.status === 429 ? res.status : 502,
      message, { code, hint: HINTS[code] || null, statusCode: res.status, latencyMs });
  }
  return { body, latencyMs, statusCode: res.status };
}

// Follows pagination (Free plans get 50 products per page).
export async function fetchFullCatalog(apiKey, { segment = '' } = {}) {
  const first = await fetchCatalogPage(apiKey, { segment });
  const products = [...(first.body.products || [])];
  let pagination = first.body.meta?.pagination;
  let pages = 1;
  let quotaMessage = first.body.meta?.quotaMessage || null;
  // When the monthly product allowance runs out mid-sync, keep what arrived and stop.
  while (pagination?.hasNextPage && !quotaMessage && pages < MAX_PAGES) {
    const next = await fetchCatalogPage(apiKey, { page: pagination.nextPage, segment });
    products.push(...(next.body.products || []));
    pagination = next.body.meta?.pagination;
    quotaMessage = next.body.meta?.quotaMessage || null;
    pages++;
  }
  return { meta: first.body.meta || {}, message: quotaMessage || first.body.message || null, products, pages, latencyMs: first.latencyMs };
}

function variantLabel(v) {
  return [v.flavor, v.variantName, v.size, v.dosage, v.form, v.value].filter(Boolean).join(' · ') || null;
}

// One sellable POS item per variant (or one per product when it has no variants).
export function toPosItems(products, storeId = 'grocery') {
  const items = [];
  for (const p of products) {
    const variants = Array.isArray(p.variants) && p.variants.length ? p.variants : [null];
    const multiple = variants.length > 1;
    variants.forEach((v, index) => {
      const vKey = v ? (v.sku || `${v.flavor || ''}|${v.size || ''}` || String(index)) : 'base';
      items.push({
        id: `${storeId}::${p.id}::${vKey}`,
        product_id: p.id,
        sku: v?.sku || p.sku || null,
        name: p.name,
        variant: v ? (variantLabel(v) || (multiple ? `Variant ${index + 1}` : null)) : (p.size || null),
        category: p.category || null,
        segment: p.segment || null,
        image_url: v?.image_url || p.image_url || null,
      });
    });
  }
  return items;
}
