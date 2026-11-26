-- Product presentation fields, data validation, timestamps and image storage.
alter table public.products
  add column if not exists colorway text not null default '',
  add column if not exists badge text not null default '';

-- The baseline already has a unique constraint on (product_id, size); this
-- temporary index is removed by the next migration to avoid a duplicate.
create unique index if not exists product_variants_product_size_uidx
  on public.product_variants (product_id, size);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'product_images_position_nonnegative'
      and conrelid = 'public.product_images'::regclass
  ) then
    alter table public.product_images
      add constraint product_images_position_nonnegative check ("position" >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'contact_messages_subject_length'
      and conrelid = 'public.contact_messages'::regclass
  ) then
    alter table public.contact_messages
      add constraint contact_messages_subject_length check (char_length(subject) <= 180);
  end if;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

drop trigger if exists product_variants_set_updated_at on public.product_variants;
create trigger product_variants_set_updated_at
before update on public.product_variants
for each row execute function public.set_updated_at();

alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_variants enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.contact_messages enable row level security;

revoke all privileges on table
  public.products,
  public.product_images,
  public.product_variants,
  public.newsletter_subscribers,
  public.contact_messages
from anon, authenticated;

grant usage on schema public to anon, authenticated;
grant select on table
  public.products,
  public.product_images,
  public.product_variants
to anon, authenticated;
grant insert on table
  public.newsletter_subscribers,
  public.contact_messages
to anon, authenticated;

grant all privileges on table
  public.products,
  public.product_images,
  public.product_variants,
  public.newsletter_subscribers,
  public.contact_messages
to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
