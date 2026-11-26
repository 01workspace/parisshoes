# Paris Shoes owner dashboard

The private dashboard is published at `/admin/` and is not linked from the customer navigation. It uses the existing Supabase project and the public publishable key together with an owner-authenticated user session. No service-role key is included in browser code.

## First owner setup

1. In the Paris Shoes Supabase project, open **Authentication → Users → Add user** and create the owner's email/password account. Keep the password private; do not send it in chat or commit it to the repository.
2. Copy the new Auth user's UUID.
3. In the Supabase SQL Editor, grant that user the owner role (replace the email with the exact email used in step 1):

```sql
insert into public.admin_users (user_id, role)
select id, 'owner'
from auth.users
where lower(email) = lower('OWNER_EMAIL_HERE')
on conflict (user_id) do update set role = 'owner';
```

4. Open `https://parisshoes.vercel.app/admin/` and sign in with that owner account. There is no public registration. Accounts without the database owner membership are rejected.

## Current dashboard

- Overview: catalogue totals, published/draft products, stock units, low-stock and zero-stock size variants, customer messages, newsletter count and audience mix.
- Products: create/edit product details, gallery URLs and uploads, publish/unpublish, feature, and add sizes. Newly added sizes start at zero stock.
- Inventory: edit stock for each product-size variant.
- Customer messages: review contact form submissions and open a reply in your email app.
- Newsletter: review subscriber records.
- Orders: intentionally disabled. The storefront checkout remains a demo and does not create order, payment or revenue records.

## Data-quality warning

The database currently contains seeded demonstration products and example stock. Products with a `DEMO` badge are flagged in the dashboard. Verify product details, images, prices and real warehouse stock before publishing or accepting sales.

## Security

The dashboard checks `public.admin_check()` after password sign-in. Membership is stored in `public.admin_users` and read through a protected database function. Product, image and variant writes and customer-record reads are restricted by Row Level Security to owner members. The browser receives only the publishable key and the signed-in user's access token. Never add a Supabase service-role key to a `VITE_*` environment variable.
