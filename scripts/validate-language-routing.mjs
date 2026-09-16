#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const paths = { root: 'site/index.html', en: 'site/en/index.html', de: 'site/de/index.html' };
const html = Object.fromEntries(Object.entries(paths).map(([key, path]) => [key, readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')]));
const scripts = Object.fromEntries(Object.entries(html).map(([key, page]) => [key, new vm.Script([...page.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(s => s.includes('kandro-lang')))]));
function visit(page, { languages, language = languages?.[0], stored, search = '', hash = '', storageThrows = false } = {}) {
  let went = null;
  const store = new Map(stored ? [['kandro-lang', stored]] : []);
  scripts[page].runInNewContext({ navigator: { languages, language }, URLSearchParams,
    location: { search, hash, replace: value => { went = value; } },
    localStorage: {
      getItem: key => { if (storageThrows) throw Error('blocked'); return store.get(key); },
      setItem: (key, value) => { if (storageThrows) throw Error('blocked'); store.set(key, value); },
    },
  });
  return { went, remembered: store.get('kandro-lang') };
}

// Root HTML is English even when a webview disables JavaScript entirely.
assert.match(html.root, /<html lang="en">/);
assert.match(html.root, /Log your meal/);
for (const languages of [['en'], ['en-US'], ['en-DE'], ['en-GB', 'de'], ['fr-FR'], ['tr'], ['pt-BR'], ['den'], [], [''], undefined]) {
  assert.equal(visit('root', { languages }).went, null, `English fallback failed for ${languages}`);
}
for (const languages of [['de'], ['de-DE'], ['de-AT'], ['de-CH'], ['de-US', 'en']]) {
  assert.equal(visit('root', { languages }).went, 'de/', `German routing failed for ${languages}`);
}
assert.equal(visit('root', { languages: [], language: 'de-DE' }).went, 'de/');
assert.equal(visit('root', { languages: ['en'], stored: 'de' }).went, 'de/');
assert.equal(visit('root', { languages: ['de'], stored: 'en' }).went, null);
assert.equal(visit('root', { languages: ['de'], stored: 'invalid' }).went, 'de/');

// Explicit locale links do not depend on country, browser language or stale storage.
assert.equal(visit('en', { languages: ['de'], stored: 'de' }).went, null);
assert.equal(visit('de', { languages: ['en'], stored: 'en' }).went, null);
assert.equal(visit('root', { languages: ['en'], search: '?lang=de' }).went, 'de/?lang=de');
assert.equal(visit('root', { languages: ['de'], search: '?lang=en' }).went, null);
assert.equal(visit('en', { search: '?lang=de' }).went, '../de/?lang=de');
assert.equal(visit('de', { search: '?lang=en' }).went, '../en/?lang=en');
for (const page of ['root', 'en', 'de']) {
  for (const language of ['en', 'de']) {
    assert.equal(visit(page, { search: `?lang=${language}` }).remembered, language);
    assert.doesNotThrow(() => visit(page, { search: `?lang=${language}`, storageThrows: true }));
  }
}
const search = '?lang=de&utm_source=tiktok&ttclid=example';
assert.equal(visit('root', { search, hash: '#free' }).went, `de/${search}#free`);
assert.equal(visit('de', { search: '?lang=en&utm_source=tiktok', hash: '#download-help' }).went, '../en/?lang=en&utm_source=tiktok#download-help');
assert.equal(visit('root', { languages: ['de'], storageThrows: true }).went, 'de/');
assert.equal(visit('root', { languages: ['en'], storageThrows: true }).went, null);
for (const [key, target] of [['root', 'de/?lang=de'], ['en', '../de/?lang=de'], ['de', '../en/?lang=en']]) {
  assert.ok(html[key].includes(`class="lang" href="${target}"`));
  assert.match(html[key], /hreflang="x-default" href="https:\/\/getkandro.com\/en\/"/);
}
console.log('Language routing passed: static English default, German by browser language, explicit locale links, blocked storage, preserved campaigns, no loops.');
