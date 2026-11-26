# Paris Shoes backend

Paris Shoes uses a dedicated Supabase project in Mumbai (`ap-south-1`). The Vite storefront connects through the Supabase Data API using only the project's **publishable** key. The browser never receives a secret or service-role key.

## Runtime configuration

Set these Vercel environment variables for Production, Preview, and Development:

- `VITE_SUPABASE_URL` — `https://ulnknpfxeszdxrfinvrx.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY` — the Paris Shoes project's publishable key

For local development, copy `.env.example` to `.env.local` and fill the publishable key. Never put a Supabase secret/service-role key in a `VITE_` variable or commit it to Git.

## Catalogue data

The public catalogue is driven by active rows in `public.products`. Related gallery images and size/inventory rows are stored in `public.product_images` and `public.product_variants`.

1. Open the Paris Shoes project in Supabase Studio.
2. Add a product in `products` with a unique slug, name, category, price, currency, colorway, badge, description and set `is_active = true` only when it is ready to publish.
3. Upload product photos to the `product-images` Storage bucket. Copy each public object URL into `product_images.image_url`, set meaningful `alt_text`, and use `position` starting at 0. The storefront displays gallery images in position order.
4. Add one `product_variants` row per size and set `stock_quantity`. Availability is generated from stock; the storefront disables sizes without stock.
5. Use `is_featured` and `sort_order` to control homepage placement.

The current database is intentionally empty: the existing sample shoe tiles are creative placeholders, not confirmed inventory. Do not publish them as sellable products. Add the real product catalogue and images before opening product sales.

## Forms and privacy

- `newsletter_subscribers` accepts normalized email addresses only. Duplicate signups are treated as already subscribed.
- `contact_messages` stores validated support messages.
- Customers can submit these forms but cannot read submitted records.
- Public visitors can read only active products and their related gallery/variant data.
- Catalogue, inventory and image writes are not granted to anonymous or ordinary authenticated browser roles. Manage these records in Supabase Studio or a secured owner-only admin integration after customer/admin authentication is configured.

All five public tables have Row Level Security enabled. Public roles have `SELECT` only on product tables and `INSERT` only on the newsletter/contact tables. The service-role key is reserved for trusted server-side operations and must never be exposed to the storefront.

## Deliberately deferred

Payment processing, order submission/management, and customer authentication remain disabled/deferred by owner decision. The current checkout is a demo and does not collect payment or send an order. Bag and wishlist remain local to the shopper's browser.

## Database migration

The schema hardening migration is applied to the dedicated Supabase project as `paris_shoes_storefront_backend`. It adds product presentation fields, unique product-size pairs, timestamp triggers, the public product image bucket, and least-privilege grants. The remote schema has been applied directly in Supabase; a checked-in CLI migration file still needs to be generated when the Supabase CLI is available so local migration history can be reconciled.
