import test from 'node:test';
import assert from 'node:assert/strict';
import { excludeDemoProducts } from '../src/shop-profile.js';

test('hides products marked as demo in the badge', () => {
  const products = [
    { id: 'real-1', tag: 'NEW' },
    { id: 'demo-1', tag: 'DEMO · FEATURED' },
  ];
  assert.deepEqual(excludeDemoProducts(products).map(product => product.id), ['real-1']);
});

test('hides demo records even when the demo marker is in the description', () => {
  const products = [
    { id: 'demo-2', tag: '', d: 'Demo catalogue item; replace this sample with an actual product.' },
    { id: 'real-2', tag: 'BESTSELLER', d: 'Black leather-look formal shoe.' },
  ];
  assert.deepEqual(excludeDemoProducts(products).map(product => product.id), ['real-2']);
});

test('returns an empty array for invalid catalogue input', () => {
  assert.deepEqual(excludeDemoProducts(null), []);
  assert.deepEqual(excludeDemoProducts({}), []);
});
