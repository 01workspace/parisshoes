-- Paris Shoes storefront schema baseline.
-- Public visitors can read active products and submit contact/newsletter forms only.

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  category text not null default 'shoes',
  price numeric not null,
  compare_at_price numeric,
  currency text not null default 'BDT',
  is_active boolean not null default false,
  is_featured boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_price_check check (price >= 0),
  constraint products_check check (compare_at_price is null or compare_at_price >= price)
);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  image_url text not null,
  alt_text text not null default '',
  "position" integer not null default 0,
  created_at timestamptz not null default now(),
  constraint product_images_product_id_position_key unique (product_id, "position")
);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  size text not null,
  sku text unique,
  stock_quantity integer not null default 0,
  is_available boolean generated always as (stock_quantity > 0) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_variants_product_id_size_key unique (product_id, size),
  constraint product_variants_stock_quantity_check check (stock_quantity >= 0)
);

create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  subject text not null default '',
  message text not null,
  created_at timestamptz not null default now()
);

create index products_active_sort_idx
  on public.products (is_active, sort_order);
create index product_images_product_position_idx
  on public.product_images (product_id, "position");
create index product_variants_product_size_idx
  on public.product_variants (product_id, size);

alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_variants enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.contact_messages enable row level security;

create policy "Public can view active products"
  on public.products
  for select
  to anon, authenticated
  using (is_active = true);

create policy "Public can view images for active products"
  on public.product_images
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_images.product_id
        and p.is_active = true
    )
  );

create policy "Public can view variants for active products"
  on public.product_variants
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_variants.product_id
        and p.is_active = true
    )
  );

create policy "Public can subscribe to newsletter"
  on public.newsletter_subscribers
  for insert
  to anon, authenticated
  with check (
    length(email) <= 254
    and email = lower(trim(email))
    and position('@' in email) > 1
  );

create policy "Public can submit contact messages"
  on public.contact_messages
  for insert
  to anon, authenticated
  with check (
    length(trim(name)) >= 1
    and length(trim(name)) <= 120
    and length(email) >= 3
    and length(email) <= 254
    and position('@' in email) > 1
    and length(trim(message)) >= 1
    and length(trim(message)) <= 5000
  );

grant usage on schema public to anon, authenticated;
grant select on public.products, public.product_images, public.product_variants to anon, authenticated;
grant insert on public.newsletter_subscribers, public.contact_messages to anon, authenticated;
grant all privileges on public.products, public.product_images, public.product_variants,
  public.newsletter_subscribers, public.contact_messages to service_role;
