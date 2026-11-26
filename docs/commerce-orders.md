# Paris Shoes commerce orders

## Current checkout capability

The storefront now submits real guest orders using Cash on Delivery through the Supabase place_order RPC. The browser sends customer contact and delivery details plus product and size variant IDs; it never sends a trusted price. PostgreSQL reads the active product price, locks the requested stock rows, checks availability, reserves stock, writes an order and immutable line-item snapshots, and returns an order reference.

The order RPC is idempotent. The client retains a random idempotency key and order access token for a pending retry. Repeating the same request returns the existing order; reusing the key with different details is rejected.

## Order data and access

- orders: customer delivery details, COD payment state, order state, subtotal, delivery fee and total.
- order_items: product name, slug, size, SKU and unit-price snapshots at order time.
- order_events: automatic order-created and status-change history.
- All three tables have RLS enabled. Anonymous users have no direct table read access. Only authorised Paris Shoes owner accounts can read order data and update orders.
- The public place_order RPC is intentionally callable by anonymous shoppers. It is a narrowly scoped SECURITY DEFINER operation with a fixed empty search path, strict input validation, server-side pricing, row locks, and idempotency protection. It does not expose order records.

## Admin workflow

Open /admin/, sign in as an authorised owner and choose Orders. Owners can review the customer, phone, address, line items and order amount; set a courier fee; update the order status; and see status changes recorded in the event history.

Cancelling an order before dispatch (pending, confirmed or processing) restores its reserved stock exactly once. Cancelling after shipment does not automatically restock; returned parcels require inspection and a deliberate inventory adjustment.

## Payment and delivery limitations

- Cash on Delivery is the only enabled payment method.
- No card, bKash, Nagad or SSLCOMMERZ payment integration is active yet.
- Courier booking and tracking are not connected yet.
- The delivery fee defaults to BDT 0 until an owner enters the courier charge in the order dashboard. The storefront tells customers the final COD amount will be confirmed before dispatch.
- Do not advertise the checkout as supporting online payment or automatic courier fulfilment until those providers have been configured and tested.

## Verification

The order RPC was tested in rolled-back database transactions for order creation, server-calculated totals, stock reservation, idempotent retries, order-item snapshots, cancellation restock and event history. No test orders were retained and the test stock quantity was restored. The Vercel preview build passed all 15 Node tests and built both storefront and admin assets.
