# Paris Shoes analytics setup

The storefront includes an optional analytics adapter for GA4 and Meta Pixel. Tracking remains inactive until valid measurement IDs are configured.

## Supported storefront events

- `page_view`: once per hash-route navigation, not on every component re-render.
- `view_item`: product detail route.
- `add_to_cart`: product detail and quick-view add actions.
- `begin_checkout`: checkout route when the bag contains items.
- `purchase`: only after the order RPC returns a successful order response.

Events use BDT values and product metadata only. Customer name, email, phone, address, delivery notes, and access/idempotency tokens are never sent to analytics.

## Configure GA4 and Meta Pixel

Add these Vercel **Production** and **Preview** environment variables, then redeploy:

- `VITE_GA4_MEASUREMENT_ID`: GA4 web stream ID, format `G-XXXXXXXXXX`.
- `VITE_META_PIXEL_ID`: numeric Meta Pixel ID.

Leave either value empty to keep that provider disabled. The app validates the formats before loading provider scripts. Verify events with GA4 DebugView / Realtime and Meta Events Manager Test Events.

## Meta Conversions API

Server-side Meta Conversions API is intentionally not enabled by the browser adapter. It requires a Pixel ID and a Meta Conversions API access token stored as Supabase Edge Function secrets, plus server-side event deduplication using the same event ID as the browser Pixel. Never put the access token in Vite variables or browser code. This server-side integration remains a separate setup step.

## Current limitations

- Analytics scripts are not active until IDs are configured.
- No customer personal data is sent in event payloads.
- Consent management and a published privacy/cookie notice should be reviewed before enabling advertising tracking for all visitors.
- A successful order event is emitted after the checkout RPC returns; server-side purchase reconciliation is not yet configured.
