#!/usr/bin/env node
/**
 * Sending a reader to the wrong language is the cheapest way to lose them, and
 * sending them back and forth is worse than either language would have been.
 *
 * This does not read the redirect and hope: it lifts the script out of the
 * shipped page and runs it against invented browsers, because the only claim
 * worth making about language detection is one that was actually executed.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const scriptOf = (page, marker) => {
  const html = read(page);
  const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
  const block = blocks.find((body) => body.includes(marker));
  assert.ok(block, `${page}: the language script is gone`);
  return new vm.Script(block);
};

const root = scriptOf('site/index.html', 'kandro-lang');
const english = scriptOf('site/en/index.html', 'kandro-lang');

/** One visit. Returns where the reader ended up and what was remembered. */
function visit(script, { languages, stored, search = '', hash = '', storageThrows = false }) {
  let went = null;
  const store = new Map();
  if (stored) store.set('kandro-lang', stored);
  const context = {
    navigator: { languages, language: languages && languages[0] },
    location: {
      search,
      hash,
      replace: (target) => { went = target; },
    },
    localStorage: {
      getItem: (key) => {
        if (storageThrows) throw new Error('blocked');
        return store.has(key) ? store.get(key) : null;
      },
      setItem: (key, value) => {
        if (storageThrows) throw new Error('blocked');
        store.set(key, value);
      },
    },
    URLSearchParams,
  };
  vm.createContext(context);
  script.runInContext(context);
  return { went, remembered: store.get('kandro-lang') ?? null };
}

// --- What the device says --------------------------------------------------
for (const languages of [['de'], ['de-DE'], ['de-DE', 'en-US'], ['de-AT'], ['de-CH', 'fr']]) {
  assert.equal(visit(root, { languages }).went, null,
    `a browser asking for ${languages[0]} was moved off the German page`);
}
for (const languages of [['en'], ['en-US', 'de'], ['en-GB'], ['fr-FR'], ['tr'], ['pt-BR', 'en']]) {
  assert.equal(visit(root, { languages }).went, 'en/',
    `a browser asking for ${languages[0]} was left on the German page`);
}

// A device that says nothing at all keeps the page it is already on.
assert.equal(visit(root, { languages: [] }).went, null);
assert.equal(visit(root, { languages: [''] }).went, null);
assert.equal(visit(root, { languages: undefined }).went, null);
// "de" must be a language, not a prefix: "den" is not German.
assert.equal(visit(root, { languages: ['den'] }).went, 'en/', 'a made-up code beginning with de counted as German');

// --- A choice outlives what the device says --------------------------------
assert.equal(visit(root, { languages: ['en-US'], stored: 'de' }).went, null,
  'someone who chose German is sent to English by their phone anyway');
assert.equal(visit(root, { languages: ['de-DE'], stored: 'en' }).went, 'en/',
  'someone who chose English is dragged back to German by their phone');

// --- The switch itself -----------------------------------------------------
// The English page links back as ?lang=de; that click has to stick, or the
// reader bounces straight back on their next visit.
const chose = visit(root, { languages: ['en-US'], search: '?lang=de' });
assert.equal(chose.went, null, 'clicking "Deutsch" bounced straight back to English');
assert.equal(chose.remembered, 'de', 'the choice was not remembered');

const wantsEnglish = visit(root, { languages: ['de-DE'], search: '?lang=en' });
assert.equal(wantsEnglish.went, 'en/', '?lang=en did not reach the English page');
assert.equal(wantsEnglish.remembered, 'en');

// The English page never redirects — a page that sends you back is a page you
// cannot stay on — but it does remember.
assert.equal(visit(english, { languages: ['de-DE'], search: '?lang=en' }).went, null,
  'the English page redirects, which is half a loop');
assert.equal(visit(english, { languages: ['de-DE'], search: '?lang=en' }).remembered, 'en');
assert.equal(visit(english, { languages: ['en-US'] }).went, null);

// --- Nothing is lost on the way --------------------------------------------
assert.equal(visit(root, { languages: ['en'], hash: '#waitlist' }).went, 'en/#waitlist',
  'the anchor someone followed was dropped on the way');
assert.equal(visit(root, { languages: ['en'], search: '?ref=reddit' }).went, 'en/?ref=reddit',
  'the campaign the visit came from was dropped, so it cannot be counted');

// --- A browser that refuses to remember ------------------------------------
assert.doesNotThrow(() => visit(root, { languages: ['en'], storageThrows: true }),
  'private mode breaks the page instead of the feature');
assert.equal(visit(root, { languages: ['en'], storageThrows: true }).went, 'en/',
  'a private window turns off language detection entirely, so everyone gets German');
assert.equal(visit(root, { languages: ['de-DE'], storageThrows: true }).went, null);
assert.doesNotThrow(() => visit(root, { languages: ['de'], search: '?lang=en', storageThrows: true }),
  'a choice that cannot be remembered must still be acted on');
assert.equal(visit(root, { languages: ['de'], search: '?lang=en', storageThrows: true }).went, 'en/');

// --- The switch is always reachable ----------------------------------------
for (const [page, expected] of [['site/index.html', 'en/?lang=en'], ['site/en/index.html', '../?lang=de']]) {
  const html = read(page);
  assert.ok(html.includes(`class="lang" href="${expected}"`),
    `${page}: the language switch no longer states the choice, so it cannot be remembered`);
}

console.log('Language routing: the device decides once, an explicit choice always wins, and nothing loops.');
