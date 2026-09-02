/**
 * Guards the bilingual surface.
 *
 * TypeScript already forces en.ts to carry every key of de.ts, because en is
 * typed as `typeof de`. What it cannot see is a German sentence sitting in a
 * screen instead of the dictionary, or German left behind inside the English
 * dictionary — both ship a half-translated app to an English store front.
 */
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];

async function walk(dir, extension) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...await walk(full, extension));
    else if (entry.name.endsWith(extension)) found.push(full);
  }
  return found;
}

// Umlauts alone are not enough — "Monatlich" and "Dein Tagesstand" have none.
// These function words are frequent in our own copy and are not English.
const germanWords = /\b(?:aber|auch|dein|deine|deinen|deiner|dich|dir|ein|eine|einen|für|ist|jederzeit|kannst|keine|mahlzeit|mahlzeiten|mit|monatlich|nicht|noch|nur|oder|sich|sind|über|und|von|werden|wird|wurde)\b/i;

// --- No German text outside the dictionaries -------------------------------
// Services count too. Checking only the screens is what let a German push
// notification, German billing lines and German error alerts survive the
// translation: none of them live in a .tsx file.
const dictionaryFiles = /src\/i18n\//;
const germanContent = /src\/(data|services)\/(germanMeals|mockNutrition|catalog)/;
const sources = [
  ...await walk(resolve(projectRoot, 'src/app'), '.tsx'),
  ...await walk(resolve(projectRoot, 'src/components'), '.tsx'),
  ...await walk(resolve(projectRoot, 'src/services'), '.ts'),
  ...await walk(resolve(projectRoot, 'src/context'), '.tsx'),
  ...await walk(resolve(projectRoot, 'src/utils'), '.ts'),
  ...await walk(resolve(projectRoot, 'src/constants'), '.ts'),
].filter((file) => {
  const rel = relative(projectRoot, file);
  // The German meal catalogue is data, not interface copy: the dish names are
  // the reference entries we credit, and translating them breaks the lookup.
  return !dictionaryFiles.test(rel) && !germanContent.test(rel);
});
for (const file of sources) {
  const source = await readFile(file, 'utf8');
  const offending = source.split('\n').flatMap((line, index) => {
    const withoutComments = line.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, '');
    // Only quoted strings ship to the user; a German identifier or a comment
    // is a style question, not a translation bug.
    const values = [...withoutComments.matchAll(/'((?:[^'\\]|\\.)*)'|`([^`]*)`/g)]
      .map((match) => match[1] ?? match[2])
      .join(' ');
    // Umlauts alone miss plenty: "Dein Tag ist aufgestellt" has none.
    const german = /[äöüßÄÖÜ]/.test(values) || germanWords.test(values);
    return german ? [`${relative(projectRoot, file)}:${index + 1}`] : [];
  });
  if (offending.length) {
    failures.push(`German text outside the dictionaries at ${offending.join(', ')}`);
  }
}

// --- No German left inside the English dictionaries ------------------------
// Proper nouns stay German on purpose: they are the names of the sources we
// are licensed to credit, and translating them would break the attribution.
const allowedGerman = [
  'Bundeslebensmittelschlüssel',
  'Deutsche Nährstoffdatenbank',
  'Max Rubner-Institut',
  'Altenessener Str.',
];
for (const file of ['src/i18n/en.ts', 'src/i18n/legal.en.ts']) {
  const source = await readFile(resolve(projectRoot, file), 'utf8');
  source.split('\n').forEach((line, index) => {
    let stripped = line.replace(/\/\/.*$/, '').replace(/^\s*[*/].*$/, '');
    for (const term of allowedGerman) stripped = stripped.replaceAll(term, '');
    // Only the quoted values matter; identifiers like `mit` cannot occur there.
    const values = [...stripped.matchAll(/'((?:[^'\\]|\\.)*)'|`([^`]*)`/g)]
      .map((match) => match[1] ?? match[2])
      .join(' ');
    const reason = /[äöüßÄÖÜ]/.test(values) ? 'German characters'
      : germanWords.test(values) ? `German word "${values.match(germanWords)[0]}"`
      : null;
    if (reason) {
      failures.push(`untranslated ${reason} in ${file}:${index + 1} — ${line.trim().slice(0, 80)}`);
    }
  });
}

// --- Both dictionaries must expose the same shape --------------------------
const [de, en] = await Promise.all([
  readFile(resolve(projectRoot, 'src/i18n/de.ts'), 'utf8'),
  readFile(resolve(projectRoot, 'src/i18n/en.ts'), 'utf8'),
]);
const keysOf = (source) => new Set(
  [...source.matchAll(/^\s{4}([A-Za-z0-9_]+):/gm)].map((match) => match[1]),
);
const deKeys = keysOf(de);
const enKeys = keysOf(en);
for (const key of deKeys) if (!enKeys.has(key)) failures.push(`en.ts is missing key ${key}`);
for (const key of enKeys) if (!deKeys.has(key)) failures.push(`de.ts is missing key ${key}`);

// --- English must be the default ------------------------------------------
// The traffic is international; a device with an unknown locale has to land in
// English, not in German.
const detection = await readFile(resolve(projectRoot, 'src/i18n/index.ts'), 'utf8');
if (!/return tag === 'de' \? 'de' : 'en'/.test(detection)) {
  failures.push('deviceLanguage() must fall back to English for any non-German locale');
}

if (failures.length) {
  throw new Error(`i18n validation failed:\n- ${failures.join('\n- ')}`);
}
console.log(`Validated ${sources.length} source files and both dictionaries: no stray German, matching keys, English default.`);
