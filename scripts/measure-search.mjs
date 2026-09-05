#!/usr/bin/env node
/**
 * Measures what the search actually finds, by running the gateway's own
 * pipeline against the live sources: the German catalogue first, then USDA
 * with the translated term, then Open Food Facts.
 *
 * A hit means a result a person would accept as the thing they typed. Counting
 * "any result at all" would score a query that returns banana chips for
 * "banane" as a success, which is how a search gets to feel broken while its
 * numbers look fine.
 */
import { readFileSync } from 'node:fs';

const key = readFileSync(new URL('../.env', import.meta.url), 'utf8')
  .split('\n').find((l) => l.startsWith('USDA_API_KEY='))?.slice(13).trim();

const { translateGermanQuery } = await import('../supabase/functions/_shared/german-food-terms.mjs');
const { searchBlsCatalog } = await import('../supabase/functions/_shared/bls-search.mjs');
// The gateway re-ranks what USDA returns; measuring the raw order measures a
// pipeline the app does not have. "broccoli steamed" comes back with oysters
// first and is corrected to broccoli before anyone sees it.
const { rankFoodMatches } = await import('../supabase/functions/_shared/nutrition.mjs');
const probes = JSON.parse(readFileSync(new URL('./data/search-probes.json', import.meta.url), 'utf8')).probes;

const usda = async (term) => {
  const r = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${key}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: term, pageSize: 10 }),
  });
  if (!r.ok) return [];
  const foods = (await r.json()).foods ?? [];
  return rankFoodMatches(foods, term, 10).map((f) => f.description);
};

const off = async (term) => {
  const url = `https://search.openfoodfacts.org/search?q=${encodeURIComponent(term)}&page_size=10&fields=product_name,nutriments`;
  const r = await fetch(url, { headers: { 'User-Agent': 'Kandro/1.0 (measurement)' }, signal: AbortSignal.timeout(8000) })
    .catch(() => null);
  if (!r || !r.ok) return [];
  return ((await r.json()).hits ?? [])
    .filter((h) => Number.isFinite(Number(h?.nutriments?.['energy-kcal_100g'])))
    .map((h) => h.product_name).filter(Boolean);
};

/** Does any name plausibly denote the same food? */
const matches = (names, expect, query) => {
  const wanted = expect.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const q = query.toLowerCase().replace(/[^a-zäöüß ]/g, '').split(/\s+/).filter((w) => w.length > 2);
  return names.some((name) => {
    const n = String(name).toLowerCase();
    const byExpect = wanted.length && wanted.every((w) => n.includes(w));
    const byQuery = q.length && q.every((w) => n.includes(w));
    return byExpect || byQuery;
  });
};

const rows = [];
for (const probe of probes) {
  const bls = searchBlsCatalog(probe.q, probe.lang, 10).map((m) => m.nameDe ?? m.name ?? '');
  const english = translateGermanQuery(probe.q) ?? probe.q;
  const [u, o] = await Promise.all([usda(english), off(probe.q)]);
  const names = [...bls, ...u, ...o];
  const hit = matches(names, probe.expect, probe.q);
  const via = matches(bls, probe.expect, probe.q) ? 'BLS'
    : matches(u, probe.expect, probe.q) ? 'USDA'
    : matches(o, probe.expect, probe.q) ? 'OFF' : '—';
  rows.push({ ...probe, hit, via, translated: english !== probe.q ? english : '', top: names[0] ?? '' });
  process.stdout.write(hit ? '.' : 'x');
}
process.stdout.write('\n\n');

const hits = rows.filter((r) => r.hit).length;
console.log(`Trefferquote: ${hits}/${rows.length} = ${Math.round((hits / rows.length) * 100)}%\n`);
const byVia = {};
rows.forEach((r) => { byVia[r.via] = (byVia[r.via] ?? 0) + 1; });
console.log('gefunden über:', JSON.stringify(byVia), '\n');
console.log('NICHT GEFUNDEN:');
for (const r of rows.filter((r) => !r.hit)) {
  console.log(`  ${r.q.padEnd(22)} erwartet "${r.expect}"${r.translated ? ` (übersetzt: ${r.translated})` : ''}  top: ${String(r.top).slice(0, 46)}`);
}
