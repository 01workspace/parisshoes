import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const styles = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));

test('desktop header action links stay aligned to the right edge', () => {
  const desktop = styles.slice(styles.lastIndexOf('/* Desktop masthead alignment repair */'));
  assert.match(desktop, /\.header \.actions\s*\{[^}]*justify-self:\s*end\s*!important/s);
  assert.match(desktop, /\.header \.actions\s*\{[^}]*justify-content:\s*flex-end\s*!important/s);
});

test('store homepage uses the real in-store photograph and not the old product carousel', () => {
  assert.ok(html.includes('/resources/paris-shoes-store.webp'));
  assert.ok(html.includes('/resources/paris-shoes-shelves.webp'));
  assert.equal(html.includes('id="shoeSlider"'), false);
});

test('store homepage uses a responsive two-column desktop hero and compact mobile layout', () => {
  const storeStyles = styles.slice(styles.lastIndexOf('/* Paris Shoes local-store preview */'));
  assert.match(storeStyles, /\.store-hero\s*\{[^}]*grid-template-columns:\.88fr 1\.12fr/);
  assert.match(storeStyles, /@media\(max-width:800px\)/);
  assert.match(storeStyles, /@media\(max-width:560px\)/);
});

const headerMarkup = html.slice(html.indexOf('function header()'), html.indexOf('function footer()'));

test('masthead has three useful shop links and one direct call action', () => {
  const navStart = headerMarkup.indexOf('<nav class="nav ');
  const navEnd = headerMarkup.indexOf('</nav>', navStart);
  const nav = headerMarkup.slice(navStart, navEnd);
  const actionsStart = headerMarkup.indexOf('<div class="actions">');
  const actionsEnd = headerMarkup.indexOf('</div>', actionsStart);
  const actions = headerMarkup.slice(actionsStart, actionsEnd);
  const navLabels = ['Shop', 'Help', 'Contact'];
  assert.equal(nav.split('<a href=').length - 1, 3);
  assert.ok(navLabels.every(label => nav.includes('>' + label + '<')));
  assert.equal(actions.split('<a ').length - 1, 1);
  assert.ok(actions.includes('Call the store'));
  assert.equal(headerMarkup.includes('Our approach'), false);
});

test('symmetric masthead layout keeps logo between aligned navigation and call action', () => {
  const masthead = styles.slice(styles.lastIndexOf('/* Symmetric desktop header layout */'));
  assert.ok(masthead.includes('grid-template-columns: minmax(0, 1fr) 224px minmax(0, 1fr) !important;'));
  assert.ok(masthead.includes('.header .nav {'));
  assert.ok(masthead.includes('justify-self: start !important;'));
  assert.ok(masthead.includes('justify-content: flex-start !important;'));
  assert.ok(masthead.includes('.header .actions {'));
  assert.ok(masthead.includes('justify-self: end !important;'));
  assert.ok(masthead.includes('justify-content: flex-end !important;'));
});
