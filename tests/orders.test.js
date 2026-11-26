import test from 'node:test';
import assert from 'node:assert/strict';
import { createStoreApi } from '../src/store-api.js';

const validOrder = {
  customer: {
    name: 'Ayesha Rahman',
    email: 'ayesha@example.com',
    phone: '01712345678',
    address: 'House 12, Road 4, Dhanmondi',
    district: 'Dhaka',
    city: 'Dhaka',
    postal_code: '1209',
    notes: 'Please call before delivery',
  },
  items: [{
    product_id: '11111111-1111-4111-8111-111111111111',
    variant_id: '22222222-2222-4222-8222-222222222222',
    quantity: 2,
  }],
  payment_method: 'cod',
};

test('placeOrder sends validated guest details and item IDs to the atomic order RPC', async () => {
  let request;
  const api = createStoreApi({
    supabaseUrl: 'https://paris.example.supabase.co',
    publishableKey: 'sb_publishable_test',
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, status: 200, json: async () => ({ order_number: 'PS-261126-AB12CD34', total: 4900, status: 'pending' }) };
    },
  });
  const result = await api.placeOrder(validOrder, {
    idempotencyKey: '33333333-3333-4333-8333-333333333333',
    accessToken: '44444444-4444-4444-8444-444444444444',
  });
  assert.match(request.url, /rpc\/place_order$/);
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.headers.apikey, 'sb_publishable_test');
  const body = JSON.parse(request.options.body);
  assert.equal(body.p_payload.customer.phone, '01712345678');
  assert.equal(body.p_payload.payment_method, 'cod');
  assert.equal(body.p_payload.items[0].quantity, 2);
  assert.equal(body.p_idempotency_key, '33333333-3333-4333-8333-333333333333');
  assert.equal(body.p_access_token, '44444444-4444-4444-8444-444444444444');
  assert.equal(result.order_number, 'PS-261126-AB12CD34');
});

test('placeOrder rejects malformed customer details and unsafe quantities before network access', async () => {
  let called = false;
  const api = createStoreApi({
    supabaseUrl: 'https://paris.example.supabase.co',
    publishableKey: 'sb_publishable_test',
    fetchImpl: async () => { called = true; return { ok: true, status: 200, json: async () => ({}) }; },
  });
  await assert.rejects(() => api.placeOrder({ ...validOrder, customer: { ...validOrder.customer, phone: '12345' } }), /Bangladesh mobile/i);
  await assert.rejects(() => api.placeOrder({ ...validOrder, items: [{ ...validOrder.items[0], quantity: 99 }] }), /quantity/i);
  await assert.rejects(() => api.placeOrder({ ...validOrder, payment_method: 'card' }), /Cash on Delivery/i);
  assert.equal(called, false);
});
