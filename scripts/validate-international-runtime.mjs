import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
function moduleWith(source, bindings) {
  const js = ts.transpileModule(source.replace(/^import[\s\S]*?from [^;]+;\n/gm, ''), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  new Function('exports', ...Object.keys(bindings), js)(exports, ...Object.values(bindings));
  return exports;
}
let locales = [], stored = null;
const i18n = moduleWith(read('src/i18n/index.ts'), {
  getLocales: () => locales, de: {}, en: {},
  AsyncStorage: { getItem: async () => stored, setItem: async (_, value) => { stored = value; } },
});
const cases = [
  [['de-DE'], 'de'], [['en-DE'], 'en'], [['en-US'], 'en'],
  [['en-GB'], 'en'], [['en-SG'], 'en'], [['zh-SG','en-SG'], 'en'],
  [['pt-BR'], 'en'], [['pt-BR','de-DE'], 'de'], [['pt-BR','en-US','de-DE'], 'en'],
  [['ar-SA'], 'en'], [['ar-SA','de-DE'], 'de'], [[], 'en'],
];
for (const [tags, expected] of cases) {
  locales = tags.map(languageTag => ({languageTag, languageCode: languageTag.split('-')[0]}));
  assert.equal(i18n.deviceLanguage(), expected, `preferred languages ${tags}`);
}
locales = [{languageCode:'zh', languageTag:'zh-Hans-SG', regionCode:null}];
assert.equal(i18n.deviceRegion(), 'SG', 'script subtags must not be mistaken for countries');
locales = [{languageCode:'de', languageTag:'de-US', regionCode:'US'}];
assert.equal(i18n.deviceLanguage(), 'de');
assert.equal(i18n.deviceRegion(), 'US');
stored = 'en';
assert.equal(await i18n.loadLanguage(), 'en', 'persisted app choice overrides preferred languages');
await i18n.saveLanguage('de');
locales = [{languageCode:'pt', languageTag:'pt-BR', regionCode:'BR'}];
assert.equal(await i18n.loadLanguage(), 'de', 'choice survives new device locale');

const decimal = moduleWith(read('src/utils/decimalInput.ts'), {});
for (const text of ['75,5','75.5',' 75.5 ']) assert.equal(decimal.parseDecimalInput(text,1,5000),75.5);
for (const text of ['1.234,5','1,234.5','1 234,5','７５.５','','0','-1','Infinity','NaN','5001','75.55']) {
  assert.equal(decimal.parseDecimalInput(text,1,5000),null, `ambiguous/invalid amount ${text}`);
}
const dates = moduleWith(read('src/utils/date.ts'), {});
const oldTZ = process.env.TZ;
for (const zone of ['Europe/Berlin','America/New_York','America/Los_Angeles','Europe/London','Asia/Singapore','America/Sao_Paulo','America/Manaus']) {
  process.env.TZ=zone;
  for(const [stamp,expected] of [['2028-02-29T23:59:59','2028-02-29'],['2028-03-01T00:00:00','2028-03-01'],['2026-12-31T23:59:59','2026-12-31'],['2027-01-01T00:00:00','2027-01-01'],['2026-03-29T12:00:00','2026-03-29'],['2026-11-01T12:00:00','2026-11-01']]) {
    assert.equal(dates.localDateKey(new Date(stamp)),expected,`${zone} ${stamp}`);
  }
}
if(oldTZ===undefined) delete process.env.TZ; else process.env.TZ=oldTZ;
console.log('PASS: actual locale selection/persisted override, script-region parsing, strict decimal input and 42 local-date cases. UNIT only; no storefront or physical-location claim.');
