import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=process.argv[2] ?? fileURLToPath(new URL('../',import.meta.url));
// This disclosure must be in the subscription terms in both languages, while
// the separate functional-data disclosure stays in privacy.
for (const [language, clause, dataClause] of [
 ['de', 'Bei einem begrenzten Test unter geeigneten neuen Nutzern', 'Für den begrenzten Zugangstest speichert Supabase'],
 ['en', 'A limited test among eligible new users aged 18', 'For the limited access test, Supabase']
]) {
 const source=readFileSync(resolve(root,`src/i18n/legal.${language}.ts`),'utf8');
 const privacy=source.slice(source.indexOf('  privacy: {'),source.indexOf('  terms: {'));
 const terms=source.slice(source.indexOf('  terms: {'),source.indexOf('  sources: {'));
 assert.ok(terms.includes(clause),`${language}: access/introductory-offer disclosure missing from terms`);
 assert.ok(!privacy.includes(clause),`${language}: commercial access disclosure misplaced in privacy`);
 assert.ok(privacy.includes(dataClause),`${language}: functional access-data disclosure missing from privacy`);
 // Owner decision 04.10.2026 (evening): open to new adult installs, no linked account needed.
 assert.match(privacy, language === 'de' ? /ein verknüpftes Konto ist nicht erforderlich/ : /a linked account is not required/);
 assert.match(privacy, language === 'de' ? /neue Installationen von Erwachsenen ohne bisherige Nutzung/ : /new installs by adults with no prior use/);
 assert.match(privacy, language === 'de' ? /standardmäßig ausgeschalteten Einwilligung/ : /separate, default-off consent/);

}
console.log('PASS: bilingual access/trial terms and separate functional-data privacy disclosure.');
