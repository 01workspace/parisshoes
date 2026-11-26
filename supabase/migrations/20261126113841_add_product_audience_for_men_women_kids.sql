alter table public.products
  add column if not exists audience text not null default 'unisex';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'products_audience_check'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_audience_check
      check (audience in ('men', 'women', 'kids', 'unisex'));
  end if;
end $$;

create index if not exists products_active_audience_category_sort_idx
  on public.products (is_active, audience, category, sort_order);
