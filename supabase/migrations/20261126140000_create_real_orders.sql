begin;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default ('PS-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  idempotency_key uuid not null unique,
  access_token_hash text not null,
  request_hash text not null,
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  shipping_address text not null,
  shipping_district text not null,
  shipping_city text not null,
  shipping_postal_code text,
  customer_note text,
  currency text not null default 'BDT' check (currency = 'BDT'),
  subtotal numeric(12,2) not null check (subtotal >= 0),
  shipping_fee numeric(12,2) not null default 0 check (shipping_fee >= 0),
  total numeric(12,2) not null check (total = subtotal + shipping_fee),
  payment_method text not null default 'cod' check (payment_method = 'cod'),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','paid','refunded')),
  order_status text not null default 'pending' check (order_status in ('pending','confirmed','processing','shipped','delivered','cancelled','returned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  product_name text not null,
  product_slug text not null,
  size text not null,
  sku text,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  quantity integer not null check (quantity between 1 and 5),
  line_total numeric(12,2) not null check (line_total = unit_price * quantity),
  created_at timestamptz not null default now()
);

create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  event_type text not null,
  from_status text,
  to_status text,
  actor_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_status_created_idx on public.orders (order_status, created_at desc);
create index if not exists order_items_order_id_idx on public.order_items (order_id);
create index if not exists order_events_order_id_idx on public.order_events (order_id, created_at desc);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_events enable row level security;

revoke all on public.orders, public.order_items, public.order_events from public, anon, authenticated;
grant select, update on public.orders to authenticated;
grant select on public.order_items, public.order_events to authenticated;

drop policy if exists "Admin owners can read orders" on public.orders;
create policy "Admin owners can read orders"
on public.orders for select to authenticated
using ((select private.is_admin()));

drop policy if exists "Admin owners can update orders" on public.orders;
create policy "Admin owners can update orders"
on public.orders for update to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

drop policy if exists "Admin owners can read order items" on public.order_items;
create policy "Admin owners can read order items"
on public.order_items for select to authenticated
using ((select private.is_admin()));

drop policy if exists "Admin owners can read order events" on public.order_events;
create policy "Admin owners can read order events"
on public.order_events for select to authenticated
using ((select private.is_admin()));

create or replace function private.log_order_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.order_events (order_id, event_type, to_status, actor_user_id)
    values (new.id, 'order_placed', new.order_status, auth.uid());
  elsif new.order_status is distinct from old.order_status then
    insert into public.order_events (order_id, event_type, from_status, to_status, actor_user_id)
    values (new.id, 'status_changed', old.order_status, new.order_status, auth.uid());
  end if;
  return new;
end;
$$;
revoke all on function private.log_order_event() from public, anon, authenticated;

drop trigger if exists orders_audit_event on public.orders;
create trigger orders_audit_event
after insert or update of order_status on public.orders
for each row execute function private.log_order_event();

alter table public.orders add column if not exists inventory_restocked_at timestamptz;

create or replace function private.restore_order_stock_on_cancel()
returns trigger
language plpgsql
security definer
set search_path = ''
as $restore$
begin
  if new.order_status = 'cancelled'
     and old.order_status in ('pending','confirmed','processing')
     and new.inventory_restocked_at is null then
    update public.product_variants as pv
    set stock_quantity = pv.stock_quantity + oi.quantity,
        updated_at = now()
    from public.order_items as oi
    where oi.order_id = new.id and oi.variant_id = pv.id;
    new.inventory_restocked_at := now();
  end if;
  return new;
end;
$restore$;
revoke all on function private.restore_order_stock_on_cancel() from public, anon, authenticated;

drop trigger if exists orders_restore_stock_on_cancel on public.orders;
create trigger orders_restore_stock_on_cancel
before update of order_status on public.orders
for each row execute function private.restore_order_stock_on_cancel();

create or replace function public.place_order(p_payload jsonb, p_idempotency_key uuid, p_access_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer jsonb;
  v_item record;
  v_product public.products%rowtype;
  v_variant public.product_variants%rowtype;
  v_existing public.orders%rowtype;
  v_order public.orders%rowtype;
  v_lines jsonb := '[]'::jsonb;
  v_subtotal numeric(12,2) := 0;
  v_name text;
  v_email text;
  v_phone text;
  v_address text;
  v_district text;
  v_city text;
  v_postal text;
  v_note text;
  v_qty integer;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' or p_idempotency_key is null or p_access_token is null then
    raise exception 'Invalid order request.' using errcode = '22023';
  end if;
  if p_payload->>'payment_method' is distinct from 'cod' then
    raise exception 'Only Cash on Delivery is currently available.' using errcode = '22023';
  end if;
  v_customer := p_payload->'customer';
  if jsonb_typeof(v_customer) <> 'object' or jsonb_typeof(p_payload->'items') <> 'array'
     or jsonb_array_length(p_payload->'items') < 1 or jsonb_array_length(p_payload->'items') > 20 then
    raise exception 'Please provide customer details and between 1 and 20 order items.' using errcode = '22023';
  end if;

  v_name := btrim(coalesce(v_customer->>'name',''));
  v_email := lower(btrim(coalesce(v_customer->>'email','')));
  v_phone := regexp_replace(coalesce(v_customer->>'phone',''), '[[:space:]-]', '', 'g');
  v_address := btrim(coalesce(v_customer->>'address',''));
  v_district := btrim(coalesce(v_customer->>'district',''));
  v_city := btrim(coalesce(v_customer->>'city',''));
  v_postal := nullif(btrim(coalesce(v_customer->>'postal_code','')), '');
  v_note := nullif(btrim(coalesce(v_customer->>'notes','')), '');

  if length(v_name) < 2 or length(v_name) > 120
     or v_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' or length(v_email) > 254
     or v_phone !~ '^(?:\+?88)?01[3-9][0-9]{8}$'
     or length(v_address) < 8 or length(v_address) > 500
     or length(v_district) < 2 or length(v_district) > 100
     or length(v_city) < 2 or length(v_city) > 100
     or (v_postal is not null and length(v_postal) > 20)
     or (v_note is not null and length(v_note) > 1000) then
    raise exception 'Please check your name, email, Bangladesh mobile number and delivery address.' using errcode = '22023';
  end if;

  select * into v_existing from public.orders where idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_hash <> md5(p_payload::text) or v_existing.access_token_hash <> md5(p_access_token::text) then
      raise exception 'This checkout request was already used with different details. Refresh checkout and try again.' using errcode = '23505';
    end if;
    return jsonb_build_object('order_number', v_existing.order_number, 'status', v_existing.order_status,
      'payment_status', v_existing.payment_status, 'subtotal', v_existing.subtotal,
      'shipping_fee', v_existing.shipping_fee, 'total', v_existing.total, 'currency', v_existing.currency);
  end if;

  for v_item in
    select x.product_id, x.variant_id, x.quantity
    from jsonb_to_recordset(p_payload->'items') as x(product_id uuid, variant_id uuid, quantity integer)
    order by x.variant_id
  loop
    v_qty := v_item.quantity;
    if v_item.product_id is null or v_item.variant_id is null or v_qty is null or v_qty < 1 or v_qty > 5 then
      raise exception 'Each item must have a valid product, size and quantity between 1 and 5.' using errcode = '22023';
    end if;
    select * into v_variant from public.product_variants
    where id = v_item.variant_id and product_id = v_item.product_id for update;
    if not found or not coalesce(v_variant.is_available, false) or v_variant.stock_quantity < v_qty then
      raise exception 'One of your selected sizes is no longer available in the requested quantity.' using errcode = 'P0001';
    end if;
    select * into v_product from public.products where id = v_item.product_id and is_active = true;
    if not found then raise exception 'One of the selected products is no longer available.' using errcode = 'P0001'; end if;

    v_subtotal := v_subtotal + (v_product.price * v_qty);
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'product_id', v_product.id, 'variant_id', v_variant.id, 'product_name', v_product.name,
      'product_slug', v_product.slug, 'size', v_variant.size, 'sku', v_variant.sku,
      'unit_price', v_product.price, 'quantity', v_qty, 'line_total', v_product.price * v_qty
    ));
    update public.product_variants
    set stock_quantity = stock_quantity - v_qty, updated_at = now()
    where id = v_variant.id;
  end loop;

  insert into public.orders (
    idempotency_key, access_token_hash, request_hash, customer_name, customer_email, customer_phone,
    shipping_address, shipping_district, shipping_city, shipping_postal_code, customer_note,
    subtotal, shipping_fee, total, payment_method, payment_status, order_status
  ) values (
    p_idempotency_key, md5(p_access_token::text), md5(p_payload::text), v_name, v_email, v_phone,
    v_address, v_district, v_city, v_postal, v_note, v_subtotal, 0, v_subtotal, 'cod', 'unpaid', 'pending'
  ) returning * into v_order;

  insert into public.order_items (order_id, product_id, variant_id, product_name, product_slug, size, sku, unit_price, quantity, line_total)
  select v_order.id, x.product_id, x.variant_id, x.product_name, x.product_slug, x.size, x.sku, x.unit_price, x.quantity, x.line_total
  from jsonb_to_recordset(v_lines) as x(product_id uuid, variant_id uuid, product_name text, product_slug text,
    size text, sku text, unit_price numeric, quantity integer, line_total numeric);

  return jsonb_build_object('order_number', v_order.order_number, 'status', v_order.order_status,
    'payment_status', v_order.payment_status, 'subtotal', v_order.subtotal,
    'shipping_fee', v_order.shipping_fee, 'total', v_order.total, 'currency', v_order.currency);
end;
$$;

revoke all on function public.place_order(jsonb, uuid, uuid) from public;
grant execute on function public.place_order(jsonb, uuid, uuid) to anon, authenticated;

commit;