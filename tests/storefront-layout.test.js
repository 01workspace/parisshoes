import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

test('desktop header actions stay aligned to the far right of the masthead', () => {
  const desktopRules = css.slice(css.lastIndexOf('/* Desktop masthead alignment repair */'));
  assert.match(desktopRules, /\.header \.actions\s*\{[^}]*justify-self:\s*end\s*!important/s);
  assert.match(desktopRules, /\.header \.actions\s*\{[^}]*justify-content:\s*flex-end\s*!important/s);
});

test('campaign status sits below the CTA instead of overlapping it', () => {
  const desktopRules = css.slice(css.lastIndexOf('/* Desktop masthead alignment repair */'));
  assert.match(desktopRules, /\.campaign-copy \.campaign-note\s*\{[^}]*position:\s*static\s*!important/s);
  assert.match(desktopRules, /\.campaign-copy \.campaign-note\s*\{[^}]*margin-top:/s);
});

test('desktop hero and section spacing use a tighter viewport-aware rhythm', () => {
  const desktopRules = css.slice(css.lastIndexOf('/* Desktop masthead alignment repair */'));
  assert.match(desktopRules, /\.campaign-hero\s*\{[^}]*min-height:\s*clamp\(/s);
  assert.match(desktopRules, /--space-section:\s*clamp\(/);
  assert.match(desktopRules, /\.campaign-copy p\s*\{[^}]*line-height:/s);
});
