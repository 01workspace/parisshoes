import test from 'node:test';
import assert from 'node:assert/strict';
import { createAnalytics } from '../src/analytics.js';

test('sends supported commerce events to GA4 and Meta using provider-safe event names', () => {
  const ga = [];
  const meta = [];
  const analytics = createAnalytics({
    gtag: (...args) => ga.push(args),
    fbq: (...args) => meta.push(args),
  });

  analytics.track('view_item', { currency: 'BDT', value: 2450, items: [{ item_id: 'shoe-1', item_name: 'Metro Runner' }] });
  analytics.track('add_to_cart', { currency: 'BDT', value: 2450, items: [{ item_id: 'shoe-1', quantity: 1 }] });
  analytics.track('begin_checkout', { currency: 'BDT', value: 2450, items: [{ item_id: 'shoe-1', quantity: 1 }] });
  analytics.track('purchase', { currency: 'BDT', value: 2450, transaction_id: 'PS-TEST', items: [{ item_id: 'shoe-1', quantity: 1 }] });

  assert.deepEqual(ga.map(args => args.slice(0, 2)), [
    ['event', 'view_item'], ['event', 'add_to_cart'], ['event', 'begin_checkout'], ['event', 'purchase'],
  ]);
  assert.deepEqual(meta.map(args => args.slice(0, 2)), [
    ['track', 'ViewContent'], ['track', 'AddToCart'], ['track', 'InitiateCheckout'], ['track', 'Purchase'],
  ]);
  assert.equal(ga[3][2].transaction_id, 'PS-TEST');
  assert.equal(meta[3][2].value, 2450);
});

test('does not emit unknown events or expose customer details to analytics', () => {
  const ga = [];
  const meta = [];
  const analytics = createAnalytics({ gtag: (...args) => ga.push(args), fbq: (...args) => meta.push(args) });

  analytics.track('customer_details_submitted', { email: 'private@example.com', phone: '01700000000' });
  assert.deepEqual(ga, []);
  assert.deepEqual(meta, []);
});

test('does not throw when analytics providers are not configured', () => {
  const analytics = createAnalytics({});
  assert.doesNotThrow(() => analytics.track('page_view', { page_path: '/' }));
});

test('strips personal fields from otherwise valid commerce event payloads', () => {
  const ga = [];
  const meta = [];
  const analytics = createAnalytics({ gtag: (...args) => ga.push(args), fbq: (...args) => meta.push(args) });

  analytics.track('purchase', {
    transaction_id: 'PS-ORDER-1',
    currency: 'BDT',
    value: 2450,
    email: 'private@example.com',
    phone: '01700000000',
    items: [{ item_id: 'shoe-1', quantity: 1, email: 'private@example.com' }],
  });

  assert.equal(ga[0][2].email, undefined);
  assert.equal(ga[0][2].phone, undefined);
  assert.equal(ga[0][2].items[0].email, undefined);
  assert.equal(meta[0][2].email, undefined);
  assert.equal(meta[0][2].value, 2450);
});
