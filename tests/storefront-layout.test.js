import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const styles = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));

test('desktop header action links align against the far-right grid track', () => {
  const desktop = styles.slice(styles.lastIndexOf('/* Desktop masthead alignment repair */'));
  assert.match(desktop, /\.header \.actions\s*\{[^}]*justify-self:\s*end\s*!important/s);
  assert.match(desktop, /\.header \.actions\s*\{[^}]*justify-content:\s*flex-end\s*!important/s);
});

test('hero carousel note sits in normal flow below the CTA', () => {
  const desktop = styles.slice(styles.lastIndexOf('/* Desktop masthead alignment repair */'));
  assert.match(desktop, /\.campaign-copy \.campaign-note\s*\{[^}]*position:\s*static\s*!important/s);
  assert.match(desktop, /\.campaign-copy \.campaign-note\s*\{[^}]*margin-top:/s);
});

test('desktop hero, typography and section gaps use a tighter responsive rhythm', () => {
  const desktop = styles.slice(styles.lastIndexOf('/* Desktop masthead alignment repair */'));
  assert.match(desktop, /\.campaign-hero\s*\{[^}]*min-height:\s*clamp\(/s);
  assert.match(desktop, /--space-section:\s*clamp\(/);
  assert.match(desktop, /\.campaign-copy p\s*\{[^}]*line-height:/s);
});

const headerMarkup = html.slice(html.indexOf('function header()'), html.indexOf('function footer()'));

test('desktop masthead contains exactly three navigation links and three actions', () => {
  const navStart = headerMarkup.indexOf('<nav class="nav ');
  const navEnd = headerMarkup.indexOf('</nav>', navStart);
  const nav = headerMarkup.slice(navStart, navEnd);
  const actionsStart = headerMarkup.indexOf('<div class="actions">');
  const actionsEnd = headerMarkup.indexOf('</div>', actionsStart);
  const actions = headerMarkup.slice(actionsStart, actionsEnd);
  const navLabels = ['Men', 'Women', 'Kids'];
  assert.equal(nav.split('<a href=').length - 1, 3);
  assert.ok(navLabels.every((label, index) => nav.indexOf('>' + label + '<') >= 0));
  assert.equal(actions.split('<a href=').length - 1, 3);
  assert.equal(headerMarkup.includes('Shop all'), false);
  assert.equal(headerMarkup.includes('Our approach'), false);
});

test('desktop masthead uses equal side tracks with the logo centered between edge-aligned groups', () => {
  const masthead = styles.slice(styles.lastIndexOf('/* Symmetric desktop header layout */'));
  assert.ok(masthead.includes('grid-template-columns: minmax(0, 1fr) 224px minmax(0, 1fr) !important;'));
  assert.ok(masthead.includes('.header .nav {'));
  assert.ok(masthead.includes('justify-self: start !important;'));
  assert.ok(masthead.includes('justify-content: flex-start !important;'));
  assert.ok(masthead.includes('.header .actions {'));
  assert.ok(masthead.includes('justify-self: end !important;'));
  assert.ok(masthead.includes('justify-content: flex-end !important;'));
});
