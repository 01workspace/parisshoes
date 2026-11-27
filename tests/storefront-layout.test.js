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
  const nav = headerMarkup.match(/<nav class="nav[\\s\\S]*?<\\/nav>/)?.[0] || '';
  const actions = headerMarkup.match(/<div class="actions">[\\s\\S]*?<\\/div>/)?.[0] || '';
  const navLabels = [...nav.matchAll(/<a href="[^"]+">([^<]+)/g)].map(match => match[1]);
  assert.deepEqual(navLabels, ['Men', 'Women', 'Kids']);
  assert.equal((actions.match(/<a href=/g) || []).length, 3);
  assert.doesNotMatch(headerMarkup, /Shop all|Our approach/);
});

test('desktop masthead uses equal side tracks with links anchored away from the centered logo', () => {
  const masthead = styles.slice(styles.lastIndexOf('/* Symmetric desktop header layout */'));
  assert.match(masthead, /grid-template-columns:\s*minmax\\(0,\\s*1fr\\)\\s*224px\\s*minmax\\(0,\\s*1fr\\)/);
  assert.match(masthead, /\.header \.nav\s*\{[^}]*justify-self:\s*start\s*!important/s);
  assert.match(masthead, /\.header \.nav\s*\{[^}]*justify-content:\s*flex-start\s*!important/s);
  assert.match(masthead, /\.header \.actions\s*\{[^}]*justify-self:\s*end\s*!important/s);
  assert.match(masthead, /\.header \.actions\s*\{[^}]*justify-content:\s*flex-end\s*!important/s);
});
