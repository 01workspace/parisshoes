import test from 'node:test';
import assert from 'node:assert/strict';
import { filterCatalog, getRecentlyViewed } from '../src/storefront-ux.js';

const products = [
  { id: 'm1', audience: 'men', t: 'Running', n: 'Metro Runner', c: 'Black / Silver', p: 2450, variants: [{ size: '40', available: true }, { size: '41', available: false }] },
  { id: 'w1', audience: 'women', t: 'Sneakers', n: 'Cloud Court', c: 'White', p: 3200, variants: [{ size: '38', available: true }] },
  { id: 'k1', audience: 'kids', t: 'School Shoes', n: 'Little Scholar', c: 'Navy', p: 1800, variants: [{ size: '32', available: true }] },
];

test('filters products by colour, size availability, stock and price range together', () => {
  assert.deepEqual(
    filterCatalog(products, { color: 'silver', size: '40', inStock: true, minPrice: 2000, maxPrice: 2600 }).map(p => p.id),
    ['m1'],
  );
  assert.deepEqual(filterCatalog(products, { size: '41' }), []);
  assert.deepEqual(filterCatalog(products, { maxPrice: 2000 }).map(p => p.id), ['k1']);
});

test('keeps recently viewed ids unique, newest first, and within the requested limit', () => {
  assert.deepEqual(getRecentlyViewed('w1', ['m1', 'w1', 'k1', 'm1'], 3), ['w1', 'm1', 'k1']);
  assert.deepEqual(getRecentlyViewed('', ['m1', 'm1', 'k1'], 2), ['m1', 'k1']);
});
