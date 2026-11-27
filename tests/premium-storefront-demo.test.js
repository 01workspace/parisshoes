import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const styles = source.slice(source.indexOf('<style>'), source.indexOf('</style>'));
const homeStart = source.indexOf('function home()');
const homeEnd = source.indexOf('function shop()', homeStart);
const homeSource = source.slice(homeStart, homeEnd);
const cardStart = source.indexOf('function card(p)');
const cardEnd = source.indexOf('function home()', cardStart);
const cardSource = source.slice(cardStart, cardEnd);
const productStart = source.indexOf('function product(id)');
const productEnd = source.indexOf('function relatedProducts', productStart);
const productSource = source.slice(productStart, productEnd);

test('homepage presents the real Mirpur store rather than placeholder sneaker campaigns', () => {
  assert.ok(homeSource.includes('store-hero'));
  assert.ok(homeSource.includes('Find your'));
  assert.ok(homeSource.includes('/resources/paris-shoes-store.webp'));
  assert.ok(homeSource.includes('Muktijoddha Haque Plaza'));
  assert.ok(homeSource.includes('store-story'));
  assert.ok(homeSource.includes('store-catalogue-note'));
  assert.ok(!homeSource.includes('Everyday 01'));
  assert.ok(!homeSource.includes('Move<br><em>your way.'));
});

test('homepage exposes direct call and map directions using the shop listing details', () => {
  assert.ok(homeSource.includes('tel:01624373655'));
  assert.ok(homeSource.includes('https://maps.app.goo.gl/FhxgFSoy5Dx8enNU9'));
  assert.ok(homeSource.includes('Check before visiting'));
});

test('product cards retain a clear media and product-information hierarchy', () => {
  assert.ok(cardSource.includes('product-card'));
  assert.ok(cardSource.includes('product-media'));
  assert.ok(cardSource.includes('product-card-meta'));
  assert.ok(cardSource.includes('product-price'));
  assert.ok(cardSource.includes('data-quick-view'));
  assert.ok(cardSource.includes('data-save'));
});

test('product detail keeps gallery, stock-aware sizes, add-to-bag and useful purchase guidance', () => {
  assert.ok(productSource.includes('detail-image-stage'));
  assert.ok(productSource.includes('detail-purchase'));
  assert.ok(productSource.includes('detail-assurance'));
  assert.ok(productSource.includes('data-size=\"'));
  assert.ok(productSource.includes('id="add"'));
  assert.ok(productSource.includes('Cash on Delivery'));
});

test('storefront styles adapt store photos and contact blocks to smaller screens', () => {
  const storeStyles = styles.slice(styles.lastIndexOf('/* Paris Shoes local-store preview */'));
  assert.match(storeStyles, /\.store-hero\s*\{[^}]*grid-template-columns:/);
  assert.match(storeStyles, /\.store-story\s*\{[^}]*grid-template-columns:/);
  assert.match(storeStyles, /\.store-details\s*\{[^}]*grid-template-columns:/);
  assert.match(storeStyles, /@media\(max-width:560px\)/);
});
