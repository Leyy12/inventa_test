-- Three stores (grocery, pharmacy, hardware), each with its own InventaAPI key.
-- Products, stock and sales are kept per store.

alter table public.pos_products     add column if not exists store text not null default 'grocery';
alter table public.pos_transactions add column if not exists store text not null default 'grocery';

do $$ begin
  alter table public.pos_products     add constraint pos_products_store_chk     check (store in ('grocery','pharmacy','hardware'));
  alter table public.pos_transactions add constraint pos_transactions_store_chk check (store in ('grocery','pharmacy','hardware'));
exception when duplicate_object then null; end $$;

create index if not exists pos_products_store_idx on public.pos_products (store, active);
create index if not exists pos_transactions_store_idx on public.pos_transactions (store, created_at desc);

drop function if exists public.pos_sync_products(jsonb);
drop function if exists public.pos_checkout(jsonb, numeric, numeric);

-- Item ids are "<store>::<product id>::<variant>", so one product can be sold
-- by several stores with separate prices and stock.
create or replace function public.pos_sync_products(p_store text, p_items jsonb)
returns integer
language plpgsql security definer set search_path = public
as $$
declare n integer;
begin
  if p_store not in ('grocery','pharmacy','hardware') then raise exception 'Unknown store.'; end if;
  if jsonb_typeof(p_items) <> 'array' then raise exception 'items must be an array'; end if;
  if jsonb_array_length(p_items) > 5000 then raise exception 'too many items'; end if;
  if exists (select 1 from jsonb_array_elements(p_items) i where not (i->>'id' like p_store || '::%')) then
    raise exception 'Item ids must start with the store name.';
  end if;

  insert into pos_products as p (id, store, product_id, sku, name, variant, category, segment, image_url, active, synced_at, updated_at)
  select left(i->>'id', 300), p_store, left(i->>'product_id', 200), left(i->>'sku', 120), left(i->>'name', 300),
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
  where store = p_store and active
    and id not in (select i->>'id' from jsonb_array_elements(p_items) i where i->>'id' is not null);

  return n;
end $$;

create or replace function public.pos_checkout(p_store text, p_items jsonb, p_discount numeric, p_cash numeric)
returns public.pos_transactions
language plpgsql security definer set search_path = public
as $$
declare
  line jsonb; prod pos_products; qty integer;
  lines jsonb := '[]'::jsonb; v_subtotal numeric := 0; v_discount numeric; v_total numeric; v_cash numeric;
  r pos_transactions;
begin
  if p_store not in ('grocery','pharmacy','hardware') then raise exception 'Unknown store.'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Cart is empty.'; end if;
  if jsonb_array_length(p_items) > 200 then raise exception 'Too many cart lines.'; end if;

  for line in select * from jsonb_array_elements(p_items) loop
    qty := (line->>'qty')::integer;
    if qty is null or qty < 1 or qty > 100000 then raise exception 'Invalid quantity.'; end if;
    select * into prod from pos_products where id = line->>'id' and store = p_store and active for update;
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
  if v_cash = 0 then v_cash := v_total; end if;
  if v_cash < v_total then raise exception 'Cash is less than total.'; end if;

  insert into pos_transactions (store, items, subtotal, discount, total, cash, change)
  values (p_store, lines, round(v_subtotal, 2), round(v_discount, 2), round(v_total, 2), round(v_cash, 2), round(v_cash - v_total, 2))
  returning * into r;
  return r;
end $$;

revoke all on function public.pos_sync_products(text, jsonb), public.pos_checkout(text, jsonb, numeric, numeric) from public;
grant execute on function public.pos_sync_products(text, jsonb), public.pos_checkout(text, jsonb, numeric, numeric)
  to anon, authenticated, service_role;
