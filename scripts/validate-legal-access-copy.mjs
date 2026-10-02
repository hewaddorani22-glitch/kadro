import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=process.argv[2] ?? fileURLToPath(new URL('../',import.meta.url));
// This disclosure must be in the subscription terms in both languages, while
// the separate functional-data disclosure stays in privacy.
for (const [language, clause, dataClause] of [
 ['de', 'Bei einem begrenzten Test unter freiwillig verknüpften', 'Für den begrenzten Zugangstest speichert Supabase'],
 ['en', 'A limited test among eligible new adults aged 18', 'For the limited access test, Supabase']
]) {
 const source=readFileSync(resolve(root,`src/i18n/legal.${language}.ts`),'utf8');
 const privacy=source.slice(source.indexOf('  privacy: {'),source.indexOf('  terms: {'));
 const terms=source.slice(source.indexOf('  terms: {'),source.indexOf('  sources: {'));
 assert.ok(terms.includes(clause),`${language}: access/introductory-offer disclosure missing from terms`);
 assert.ok(!privacy.includes(clause),`${language}: commercial access disclosure misplaced in privacy`);
 assert.ok(privacy.includes(dataClause),`${language}: functional access-data disclosure missing from privacy`);
}
console.log('PASS: bilingual access/trial terms and separate functional-data privacy disclosure.');
