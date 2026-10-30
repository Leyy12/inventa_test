# QuickPOS · InventaAPI test POS

A point-of-sale app for testing **InventaAPI** keys from [inventaapi.shop](https://inventaapi.shop). It has three stores (**Grocery**, **Pharmacy**, **Hardware**) that share **one** InventaAPI key (Pro Max). Each store gets only its segment's products and keeps its own prices, stock and sales. Switch stores with the selector at the top.

- **API Key page**: tests the key from your `.env` file for each store and shows whether it works (key name, plan, products used this month, response time) and the exact products linked to it. If it fails, the page explains why: wrong or revoked key, quota used up, and so on.
- **Products**: press **Sync from API** to load every product on the key (all pages, one item per variant). Then set a selling price and stock for each item. InventaAPI does not send prices, so the POS keeps them.
- **Cashier / Transactions / Dashboard**: sell, print receipts, export CSV. Prices and stock are checked on the server, not in the browser.
- Data is stored in **Supabase**. The site runs on **Vercel**.

## Run it on your computer

Requires Node.js 18 or newer. Nothing to install: there are no dependencies.

```bash
npm run setup
```

This creates a `.env` file. Open it in your editor and paste your key after the `=`:

```env
INVENTA_API_KEY=your-pro-max-api-key
```

The Supabase lines are already filled in. (Older setups with `INVENTA_API_KEY_GROCERY`, `_PHARMACY` and `_HARDWARE` still work; `INVENTA_API_KEY` wins when both are set.)

```bash
npm run dev
```

Open http://localhost:3000, pick a store at the top, go to **Products → Sync from API**, set prices, and start selling.

Without the Supabase lines, data is saved to `.data/quickpos.json` instead. That's fine for a quick try.
The key is only ever read from `.env`. The website never asks for it or shows it. After changing `.env`, restart `npm run dev`.

`.env` is in `.gitignore`. Never commit it.

## Environment variables

| Name | Required | What it is |
| --- | --- | --- |
| `INVENTA_API_KEY` | yes | Your key from inventaapi.shop → Dashboard → API Keys, used by all three stores. It stays on the server and is never sent to the browser. |
| `INVENTA_API_URL` | no | Defaults to `https://inventaapi.shop`. |
| `SUPABASE_URL` | for Supabase | Supabase → Project Settings → API. |
| `SUPABASE_PUBLISHABLE_KEY` | for Supabase | The `sb_publishable_…` key. (`SUPABASE_SECRET_KEY` also works.) |

## Put your keys on Vercel

Vercel can't read the `.env` on your computer, and `.env` is never uploaded to GitHub. Upload it once:

1. Vercel → **inventa-test-pos** → **Settings** → **Environment Variables**.
2. Click **Import .env** and choose your `.env` file. Or open `.env`, copy everything, and paste it into the first **Key** box; Vercel splits it into rows.
3. Tick Production, Preview and Development, then **Save**.
4. **Deployments** → ⋯ on the latest one → **Redeploy**.

Do this again whenever you change a key.

## Supabase

The tables are in `supabase/migrations/20261030000000_pos.sql`: `pos_products`, `pos_transactions` and the key-test log `test_web_runs`. Every name starts with `pos_`, so nothing collides with InventaAPI's own tables. The publishable key can only **read** these tables. Writes go through database functions (`pos_sync_products`, `pos_update_product`, `pos_checkout`) that validate input and take prices from the database.

## How it talks to InventaAPI

```
GET {INVENTA_API_URL}/daas/v1/catalog?segment=Grocery|Pharmacy|Hardware&page=N
x-api-key: {INVENTA_API_KEY}
```

Each store asks only for its own segment. On Pro and Pro Max, every product variant the API sends counts toward the month's 15,000 for that product's segment (a product without variants counts as one). A sync uses one per variant on the key, and so does a key test.

## Files

```
index.html, pages/, js/, css/   the POS web app
api/*.js                        server functions (Vercel); api/_lib/ is shared code
dev-server.js                   local server: loads .env, serves the app and api/
supabase/migrations/            database tables and functions
```
