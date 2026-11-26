import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeAdminData, normalizeProductDraft, parseStockQuantity } from '../src/admin-logic.js';

test('summarises catalogue and inventory without inventing revenue', () => {
  const result = summarizeAdminData({
    products: [
      { is_active: true, badge: 'DEMO · FEATURED', product_variants: [{ stock_quantity: 0 }, { stock_quantity: 3 }] },
      { is_active: false, badge: 'NEW', product_variants: [{ stock_quantity: 9 }] },
    ],
    messages: [{ id: 1 }], subscribers: [{ id: 2 }, { id: 3 }],
  });
  assert.equal(result.totalProducts, 2);
  assert.equal(result.activeProducts, 1);
  assert.equal(result.draftProducts, 1);
  assert.equal(result.totalVariants, 3);
  assert.equal(result.totalUnits, 12);
  assert.equal(result.lowStockVariants, 1);
  assert.equal(result.outOfStockVariants, 1);
  assert.equal(result.demoProducts, 1);
  assert.equal(result.messageCount, 1);
  assert.equal(result.subscriberCount, 2);
  assert.equal('revenue' in result, false);
});

test('normalises a product draft and deduplicates size labels', () => {
  const result = normalizeProductDraft({
    name: '  Metro Runner  ', audience: 'men', category: 'Running', price: '2490',
    sizes: '40, 41, 41, 42', imageUrls: '/shoe-front.webp\nhttps://images.example.com/side.jpg',
    is_active: true, is_featured: true,
  });
  assert.equal(result.name, 'Metro Runner');
  assert.equal(result.slug, 'metro-runner');
  assert.equal(result.price, 2490);
  assert.equal(result.currency, 'BDT');
  assert.deepEqual(result.sizes, ['40', '41', '42']);
  assert.deepEqual(result.imageUrls, ['/shoe-front.webp', 'https://images.example.com/side.jpg']);
  assert.equal(result.is_active, true);
  assert.equal(result.is_featured, true);
});

test('rejects unsafe image URLs, excessive galleries and invalid product values', () => {
  assert.throws(() => normalizeProductDraft({ name:'Shoe', audience:'men', category:'Sneakers', price:100, imageUrls:'javascript:alert(1)' }), /HTTPS or local path/i);
  assert.throws(() => normalizeProductDraft({ name:'Shoe', audience:'men', category:'Sneakers', price:-1 }), /valid BDT price/i);
  assert.throws(() => normalizeProductDraft({ name:'Shoe', audience:'men', category:'Sneakers', price:100, imageUrls:Array(9).fill('/shoe.webp') }), /at most 8/i);
});

test('validates inventory as a bounded whole number', () => {
  assert.equal(parseStockQuantity('0'), 0);
  assert.equal(parseStockQuantity('250'), 250);
  assert.throws(() => parseStockQuantity('-1'), /whole number/i);
  assert.throws(() => parseStockQuantity('1.5'), /whole number/i);
  assert.throws(() => parseStockQuantity('100001'), /whole number/i);
});
