# QuickPOS · InventaAPI test POS

A point-of-sale app for testing an **InventaAPI** key from [inventaapi.shop](https://inventaapi.shop).

- **API Key page**: paste a key, see whether it works (key name, plan, request quota, response time) and the exact products linked to it. If it fails, the page explains why: wrong or revoked key, quota used up, and so on.
- **Products**: press **Sync from API** to load every product on the key (all pages, one item per variant). Then set a selling price and stock for each item. InventaAPI does not send prices, so the POS keeps them.
- **Cashier / Transactions / Dashboard**: sell, print receipts, export CSV. Prices and stock are checked on the server, not in the browser.
- Data is stored in **Supabase**. The site runs on **Vercel**.

## Run it on your computer

Requires Node.js 18 or newer. Nothing to install: there are no dependencies.

```bash
cp .env.example .env
```

Open `.env` in your editor and paste your key:

```env
INVENTA_API_KEY=paste-your-inventa-api-key-here
INVENTA_API_URL=https://inventaapi.shop

SUPABASE_URL=https://ztljiycedvafdqpuywkc.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

```bash
npm run dev
```

Open http://localhost:3000, go to **Products → Sync from API**, set prices, and start selling.

Without the Supabase lines, data is saved to `.data/quickpos.json` instead. That's fine for a quick try.
Without `INVENTA_API_KEY`, paste a key on the API Key page and press **Use in POS (this tab)**.

`.env` is in `.gitignore`. Never commit it.

## Environment variables

| Name | Required | What it is |
| --- | --- | --- |
| `INVENTA_API_KEY` | yes | Key from inventaapi.shop → Dashboard → API Keys. It stays on the server and is never sent to the browser. |
| `INVENTA_API_URL` | no | Defaults to `https://inventaapi.shop`. |
| `SUPABASE_URL` | for Supabase | Supabase → Project Settings → API. |
| `SUPABASE_PUBLISHABLE_KEY` | for Supabase | The `sb_publishable_…` key. (`SUPABASE_SECRET_KEY` also works.) |

## Deploy on Vercel

1. Import this repo in Vercel (Framework preset: **Other**, no build command).
2. Add the variables above under **Project → Settings → Environment Variables**.
3. Deploy. `api/*.js` become serverless functions; everything else is static.

## Supabase

The tables are in `supabase/migrations/20261030000000_pos.sql`: `pos_products`, `pos_transactions` and the key-test log `test_web_runs`. Every name starts with `pos_`, so nothing collides with InventaAPI's own tables. The publishable key can only **read** these tables. Writes go through database functions (`pos_sync_products`, `pos_update_product`, `pos_checkout`) that validate input and take prices from the database.

## How it talks to InventaAPI

```
GET {INVENTA_API_URL}/daas/v1/catalog?page=N
x-api-key: {INVENTA_API_KEY}
```

Each call counts toward the key's request quota. A sync makes one call per page (Free plans get 50 products per page), and a key test makes one call.

## Files

```
index.html, pages/, js/, css/   the POS web app
api/*.js                        server functions (Vercel); api/_lib/ is shared code
dev-server.js                   local server: loads .env, serves the app and api/
supabase/migrations/            database tables and functions
```
