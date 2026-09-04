/**
 * Checks getkandro.com the way a reviewer or a crawler would: every internal
 * link has to resolve to a file that exists, and the German and English
 * versions of a page have to point at each other.
 *
 * The site has no build step, so nothing else would catch a nav entry that
 * points one directory too high — and /privacy and /support are mandatory
 * fields in App Store Connect.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const siteRoot = resolve(projectRoot, 'site');
const failures = [];

async function htmlFiles(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...await htmlFiles(full));
    else if (entry.name.endsWith('.html')) found.push(full);
  }
  return found;
}

const exists = async (path) => stat(path).then(() => true, () => false);

function relativeLuminance(hex) {
  const channels = hex.slice(1).match(/.{2}/g).map((value) => Number.parseInt(value, 16) / 255);
  const linear = channels.map((value) => value <= 0.04045
    ? value / 12.92
    : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(foreground, background) {
  const light = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const dark = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (light + 0.05) / (dark + 0.05);
}

const pages = await htmlFiles(siteRoot);

for (const page of pages) {
  const rel = relative(projectRoot, page);
  const html = await readFile(page, 'utf8');

  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const target = match[1];
    if (/^(https?:|mailto:|tel:|#|data:)/.test(target)) continue;
    // A query or a fragment is not part of the path. The language switch links
    // to "en/?lang=en", which is a perfectly good link the checker called a
    // missing file.
    const path = target.split(/[?#]/)[0];
    if (!path) continue;
    const resolved = resolve(dirname(page), path);
    const candidate = path.endsWith('/') || !path.split('/').pop().includes('.')
      ? join(resolved, 'index.html')
      : resolved;
    if (!await exists(candidate)) {
      failures.push(`${rel}: link "${target}" resolves to a file that does not exist`);
    }
  }

  // Every page must declare a canonical URL; a duplicate canonical across two
  // language versions is what makes Google drop one of them.
  const canonical = html.match(/rel="canonical" href="([^"]+)"/)?.[1];
  if (!canonical) failures.push(`${rel}: missing canonical URL`);

  const alternates = [...html.matchAll(/rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)]
    .map((m) => [m[1], m[2]]);
  const isTranslated = /\/(privacy|terms|sources|support|unsubscribe)\/index\.html$/.test(rel) || /site\/(en\/)?index\.html$/.test(rel);
  if (isTranslated) {
    const langs = alternates.map(([lang]) => lang);
    for (const required of ['de', 'en', 'x-default']) {
      if (!langs.includes(required)) failures.push(`${rel}: missing hreflang="${required}"`);
    }
    const self = alternates.find(([lang]) => lang === (rel.includes('site/en/') ? 'en' : 'de'));
    if (self && canonical && self[1] !== canonical) {
      failures.push(`${rel}: hreflang self-reference ${self[1]} does not match canonical ${canonical}`);
    }
  }

  const lang = html.match(/<html lang="([^"]+)"/)?.[1];
  const expected = rel.includes('site/en/') ? 'en' : 'de';
  if (lang !== expected) failures.push(`${rel}: <html lang> is "${lang}", expected "${expected}"`);
}

// App Store Connect requires these URLs to be reachable, in both languages for
// the audience the app actually ships to.
for (const required of ['privacy', 'terms', 'sources', 'support', 'unsubscribe', 'impressum']) {
  if (!await exists(join(siteRoot, required, 'index.html'))) failures.push(`missing page /${required}`);
}
for (const required of ['privacy', 'terms', 'sources', 'support', 'unsubscribe']) {
  if (!await exists(join(siteRoot, 'en', required, 'index.html'))) failures.push(`missing page /en/${required}`);
}

const [styles, imprint, sourcesDe, sourcesEn] = await Promise.all([
  readFile(join(siteRoot, 'styles.css'), 'utf8'),
  readFile(join(siteRoot, 'impressum', 'index.html'), 'utf8'),
  readFile(join(siteRoot, 'sources', 'index.html'), 'utf8'),
  readFile(join(siteRoot, 'en', 'sources', 'index.html'), 'utf8'),
]);

if (/ec\.europa\.eu\/consumers\/odr|Online-Streitbeilegungsplattform/i.test(imprint)) {
  failures.push('site/impressum/index.html: contains the discontinued EU ODR platform claim');
}
if (!/body:not\(\.landing\) main \{[^}]*overflow-wrap:\s*anywhere/.test(styles)) {
  failures.push('site/styles.css: legal pages can overflow on narrow screens');
}

const canvas = styles.match(/--canvas:\s*(#[a-f0-9]{6})/i)?.[1];
const microcopy = styles.match(/\.microcopy\s*\{[^}]*color:\s*(#[a-f0-9]{6})/i)?.[1];
if (!canvas || !microcopy || contrastRatio(microcopy, canvas) < 4.5) {
  failures.push('site/styles.css: hero microcopy does not reach WCAG AA text contrast on the canvas');
}

if (!sourcesDe.includes('Datenbank- und Durchschnittswerte')
    || !sourcesDe.includes('Portion bleiben Schätzungen')) {
  failures.push('site/sources/index.html: reference values and estimated matching/portions are not clearly separated');
}
if (!sourcesEn.includes('database and average values')
    || !sourcesEn.includes('portion remain estimates')) {
  failures.push('site/en/sources/index.html: reference values and estimated matching/portions are not clearly separated');
}

if (failures.length) {
  throw new Error(`Website validation failed:\n- ${failures.join('\n- ')}`);
}
console.log(`Validated ${pages.length} pages: internal links, canonicals, hreflang pairs and the App Store required URLs.`);
