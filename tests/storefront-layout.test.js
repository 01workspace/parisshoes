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
