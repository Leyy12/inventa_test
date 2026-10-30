-- QuickPOS tables for inventa_test. Everything is prefixed with pos_ so it never
-- touches InventaAPI's own tables in the same Supabase project.
--
-- The browser never talks to Supabase directly. The POS server functions use the
-- publishable key, which may only READ these tables; every write goes through the
-- SECURITY DEFINER functions below, which validate their input.

create table if not exists public.pos_products (
  id          text primary key,              -- "<inventa product id>::<variant key>"
  product_id  text not null,                 -- InventaAPI product id
  sku         text,
  name        text not null,
  variant     text,                          -- flavor / size label shown after the name
  category    text,
  segment     text,
  image_url   text,
  price       numeric(12,2) not null default 0 check (price >= 0),
  stock       integer not null default 0 check (stock >= 0),
  threshold   integer not null default 5 check (threshold >= 0),
  active      boolean not null default true, -- false = no longer returned by the API key
  synced_at   timestamptz,
  updated_at  timestamptz not null default now()
);

create table if not exists public.pos_transactions (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  items       jsonb not null,                -- [{id, name, price, qty}]
  subtotal    numeric(12,2) not null,
  discount    numeric(12,2) not null default 0,
  total       numeric(12,2) not null,
  cash        numeric(12,2) not null,
  change      numeric(12,2) not null,
  status      text not null default 'Paid'
);

create index if not exists pos_transactions_created_at_idx on public.pos_transactions (created_at desc);

alter table public.pos_products     enable row level security;
alter table public.pos_transactions enable row level security;

revoke insert, update, delete, truncate on public.pos_products, public.pos_transactions from anon, authenticated;
grant select on public.pos_products, public.pos_transactions to anon, authenticated;

drop policy if exists pos_products_read on public.pos_products;
create policy pos_products_read on public.pos_products for select to anon, authenticated using (true);
drop policy if exists pos_transactions_read on public.pos_transactions;
create policy pos_transactions_read on public.pos_transactions for select to anon, authenticated using (true);

-- Sync: upsert what the API key returned (catalog fields only; price/stock stay
-- as set in the POS) and hide every product the key no longer returns.
create or replace function public.pos_sync_products(p_items jsonb)
returns integer
language plpgsql security definer set search_path = public
as $$
declare n integer;
begin
  if jsonb_typeof(p_items) <> 'array' then raise exception 'items must be an array'; end if;
  if jsonb_array_length(p_items) > 5000 then raise exception 'too many items'; end if;

  insert into pos_products as p (id, product_id, sku, name, variant, category, segment, image_url, active, synced_at, updated_at)
  select left(i->>'id', 300), left(i->>'product_id', 200), left(i->>'sku', 120), left(i->>'name', 300),
         left(i->>'variant', 200), left(i->>'category', 120), left(i->>'segment', 120), left(i->>'image_url', 1000),
         true, now(), now()
  from jsonb_array_elements(p_items) i
  where coalesce(i->>'id', '') <> '' and coalesce(i->>'name', '') <> ''
  on conflict (id) do update set
    product_id = excluded.product_id, sku = excluded.sku, name = excluded.name, variant = excluded.variant,
    category = excluded.category, segment = excluded.segment, image_url = excluded.image_url,
    active = true, synced_at = now(), updated_at = now();
  get diagnostics n = row_count;

  update pos_products set active = false, updated_at = now()
  where active and id not in (select i->>'id' from jsonb_array_elements(p_items) i where i->>'id' is not null);

  return n;
end $$;

-- Set the selling price, stock and low-stock threshold of one product.
create or replace function public.pos_update_product(p_id text, p_price numeric, p_stock integer, p_threshold integer)
returns public.pos_products
language plpgsql security definer set search_path = public
as $$
declare r pos_products;
begin
  if p_price is null or p_price < 0 or p_price > 10000000 then raise exception 'invalid price'; end if;
  if p_stock is null or p_stock < 0 or p_stock > 10000000 then raise exception 'invalid stock'; end if;
  if p_threshold is null or p_threshold < 0 or p_threshold > 10000000 then raise exception 'invalid threshold'; end if;
  update pos_products set price = round(p_price, 2), stock = p_stock, threshold = p_threshold, updated_at = now()
  where id = p_id returning * into r;
  if r.id is null then raise exception 'product not found'; end if;
  return r;
end $$;

-- Checkout: prices come from the database (never from the browser), stock is
-- checked and deducted in the same transaction.
create or replace function public.pos_checkout(p_items jsonb, p_discount numeric, p_cash numeric)
returns public.pos_transactions
language plpgsql security definer set search_path = public
as $$
declare
  line jsonb; prod pos_products; qty integer;
  lines jsonb := '[]'::jsonb; v_subtotal numeric := 0; v_discount numeric; v_total numeric; v_cash numeric;
  r pos_transactions;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Cart is empty.'; end if;
  if jsonb_array_length(p_items) > 200 then raise exception 'Too many cart lines.'; end if;

  for line in select * from jsonb_array_elements(p_items) loop
    qty := (line->>'qty')::integer;
    if qty is null or qty < 1 or qty > 100000 then raise exception 'Invalid quantity.'; end if;
    select * into prod from pos_products where id = line->>'id' and active for update;
    if prod.id is null then raise exception 'A product in the cart is no longer available.'; end if;
    if prod.stock < qty then raise exception 'Not enough stock for %.', prod.name; end if;
    update pos_products set stock = stock - qty, updated_at = now() where id = prod.id;
    v_subtotal := v_subtotal + prod.price * qty;
    lines := lines || jsonb_build_object('id', prod.id, 'name', prod.name || coalesce(' – ' || prod.variant, ''),
                                         'sku', prod.sku, 'price', prod.price, 'qty', qty);
  end loop;

  v_discount := least(greatest(coalesce(p_discount, 0), 0), v_subtotal);
  v_total := v_subtotal - v_discount;
  v_cash := coalesce(p_cash, 0);
  if v_cash = 0 then v_cash := v_total; end if;          -- exact amount when cash is left blank
  if v_cash < v_total then raise exception 'Cash is less than total.'; end if;

  insert into pos_transactions (items, subtotal, discount, total, cash, change)
  values (lines, round(v_subtotal, 2), round(v_discount, 2), round(v_total, 2), round(v_cash, 2), round(v_cash - v_total, 2))
  returning * into r;
  return r;
end $$;

-- API key test log (table created earlier for the key tester).
create table if not exists public.test_web_runs (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  key_hint text, search text, status_code integer, ok boolean, latency_ms integer,
  product_count integer, product_total integer, plan text, key_name text, error text
);
alter table public.test_web_runs enable row level security;

create or replace function public.pos_log_key_test(p jsonb)
returns void
language sql security definer set search_path = public
as $$
  insert into test_web_runs (key_hint, search, status_code, ok, latency_ms, product_count, product_total, plan, key_name, error)
  values (left(p->>'key_hint', 40), left(p->>'search', 200), (p->>'status_code')::integer, (p->>'ok')::boolean,
          (p->>'latency_ms')::integer, (p->>'product_count')::integer, (p->>'product_total')::integer,
          left(p->>'plan', 40), left(p->>'key_name', 200), left(p->>'error', 500));
$$;

revoke all on function public.pos_sync_products(jsonb), public.pos_update_product(text, numeric, integer, integer),
  public.pos_checkout(jsonb, numeric, numeric), public.pos_log_key_test(jsonb) from public;
grant execute on function public.pos_sync_products(jsonb), public.pos_update_product(text, numeric, integer, integer),
  public.pos_checkout(jsonb, numeric, numeric), public.pos_log_key_test(jsonb) to anon, authenticated, service_role;
