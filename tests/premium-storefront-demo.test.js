import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const styles = source.slice(source.indexOf('<style>'), source.indexOf('</style>'));
const homeStart = source.indexOf('function home()');
const homeEnd = source.indexOf('const SHOP_CATEGORIES', homeStart);
const homeSource = source.slice(homeStart, homeEnd);
const cardStart = source.indexOf('function card(p)');
const cardEnd = source.indexOf('function home()', cardStart);
const cardSource = source.slice(cardStart, cardEnd);
const productStart = source.indexOf('function product(id)');
const productEnd = source.indexOf('function relatedProducts', productStart);
const productSource = source.slice(productStart, productEnd);

test('homepage starts with family discovery before product-led sections', () => {
  const family = homeSource.indexOf('home-categories');
  const featured = homeSource.indexOf('home-featured');
  const arrivals = homeSource.indexOf('home-new-arrivals');
  assert.ok(family >= 0 && featured > family);
  assert.ok(arrivals > featured);
  assert.ok(homeSource.includes('home-service-strip'));
});

test('homepage includes a data-driven New Arrivals section and skips it when empty', () => {
  assert.ok(homeSource.includes('const newArrivals = P'));
  assert.ok(homeSource.includes(".filter(product => String(product.tag || '').toUpperCase().includes('NEW'))"));
  assert.match(homeSource, /newArrivals\.length/);
  assert.match(homeSource, /home-new-arrivals/);
});

test('product cards use a clear premium media and product-information hierarchy', () => {
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

test('premium storefront styles adapt card grids and product details to smaller screens', () => {
  const premium = styles.slice(styles.lastIndexOf('/* Premium storefront demo refinements */'));
  assert.match(premium, /\.product-card \.product-img\s*\{[\s\S]*?aspect-ratio:\s*1\s*\/\s*1/);
  assert.match(premium, /\.detail-info\s*\{[\s\S]*?position:\s*sticky/);
  assert.match(premium, /@media\s*\(max-width:\s*900px\)/);
  assert.match(premium, /@media\s*\(max-width:\s*640px\)/);
});
