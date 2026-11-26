import test from 'node:test';
import assert from 'node:assert/strict';
import { createStoreApi, normalizeProduct } from '../src/store-api.js';

function response(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

test('normalizes database product, ordered gallery images, and in-stock variants', () => {
  const product = normalizeProduct({
    id: 'product-uuid', slug: 'metro-runner', name: 'Metro Runner', description: 'Daily miles',
    category: 'Running', price: '2450.00', currency: 'BDT', colorway: 'Stone / Ink', badge: 'NEW',
    product_images: [
      { id: 'img-2', image_url: '/two.jpg', alt_text: 'Side', position: 2 },
      { id: 'img-1', image_url: '/one.jpg', alt_text: 'Front', position: 1 },
      { id: 'img-bad', image_url: 'javascript:alert(1)', alt_text: 'unsafe', position: 0 },
    ],
    product_variants: [
      { id: 'v1', size: '42', sku: 'MR-42', stock_quantity: 2, is_available: true },
      { id: 'v2', size: '43', sku: 'MR-43', stock_quantity: 0, is_available: false },
    ],
  });
  assert.equal(product.id, 'product-uuid');
  assert.equal(product.p, 2450);
  assert.equal(product.i, '/one.jpg');
  assert.deepEqual(product.images.map(image => image.url), ['/one.jpg', '/two.jpg']);
  assert.deepEqual(product.variants.map(variant => variant.available), [true, false]);
});

test('fetches active products with related images and stock using the publishable key', async () => {
  let request;
  const api = createStoreApi({
    supabaseUrl: 'https://paris.example.supabase.co',
    publishableKey: 'sb_publishable_test',
    fetchImpl: async (url, options) => { request = { url, options }; return response([]); },
  });
  assert.deepEqual(await api.getProducts(), []);
  assert.match(request.url, /products\?select=/);
  assert.match(request.url, /product_images/);
  assert.match(request.url, /product_variants/);
  assert.equal(request.options.headers.apikey, 'sb_publishable_test');
  assert.equal(request.options.headers.Authorization, 'Bearer sb_publishable_test');
});

test('normalizes and inserts newsletter emails; duplicate signups are idempotent', async () => {
  let inserted;
  const api = createStoreApi({
    supabaseUrl: 'https://paris.example.supabase.co', publishableKey: 'sb_publishable_test',
    fetchImpl: async (_url, options) => { inserted = JSON.parse(options.body); return response(null, 201); },
  });
  assert.deepEqual(await api.subscribeNewsletter('  SHOPPER@EXAMPLE.COM '), { alreadySubscribed: false });
  assert.deepEqual(inserted, { email: 'shopper@example.com' });

  const duplicateApi = createStoreApi({
    supabaseUrl: 'https://paris.example.supabase.co', publishableKey: 'sb_publishable_test',
    fetchImpl: async () => response({ code: '23505', message: 'duplicate key' }, 409),
  });
  assert.deepEqual(await duplicateApi.subscribeNewsletter('shopper@example.com'), { alreadySubscribed: true });
});

test('rejects malformed newsletter addresses before making a request', async () => {
  let called = false;
  const api = createStoreApi({ supabaseUrl: 'https://paris.example.supabase.co', publishableKey: 'sb_publishable_test', fetchImpl: async () => { called = true; return response({}); } });
  await assert.rejects(() => api.subscribeNewsletter('not-an-email'), /valid email/i);
  assert.equal(called, false);
});

test('validates and inserts bounded contact messages', async () => {
  let inserted;
  const api = createStoreApi({
    supabaseUrl: 'https://paris.example.supabase.co', publishableKey: 'sb_publishable_test',
    fetchImpl: async (_url, options) => { inserted = JSON.parse(options.body); return response(null, 201); },
  });
  await api.sendContactMessage({ name: '  Paris Shopper ', email: ' USER@EXAMPLE.COM ', subject: 'Fit', message: '  Need size guidance. ' });
  assert.deepEqual(inserted, { name: 'Paris Shopper', email: 'user@example.com', subject: 'Fit', message: 'Need size guidance.' });
  await assert.rejects(() => api.sendContactMessage({ name: 'x', email: 'bad', message: 'hello' }), /valid name and email/i);
});
