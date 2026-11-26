begin;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role = 'owner'),
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
revoke all on table public.admin_users from public, anon, authenticated;

create or replace function private.is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users as admin_membership
    where admin_membership.user_id = (select auth.uid())
      and admin_membership.role = 'owner'
  );
$$;
revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to anon, authenticated;

create or replace function public.admin_check()
returns boolean
language sql stable security invoker
set search_path = ''
as $$ select private.is_admin(); $$;
revoke all on function public.admin_check() from public, anon;
grant execute on function public.admin_check() to authenticated;

grant select, insert, update, delete on public.products, public.product_images, public.product_variants to authenticated;
grant select on public.contact_messages, public.newsletter_subscribers to authenticated;

create policy "Admin owners can manage products"
on public.products for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "Admin owners can manage product images"
on public.product_images for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "Admin owners can manage product variants"
on public.product_variants for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "Admin owners can read contact messages"
on public.contact_messages for select to authenticated
using ((select private.is_admin()));

create policy "Admin owners can read newsletter subscribers"
on public.newsletter_subscribers for select to authenticated
using ((select private.is_admin()));

revoke insert, update, delete on storage.objects from anon;
grant select, insert, update, delete on storage.objects to authenticated;

create policy "Admin owners can manage product image files"
on storage.objects for all to authenticated
using (bucket_id = 'product-images' and (select private.is_admin()))
with check (bucket_id = 'product-images' and (select private.is_admin()));
commit;
