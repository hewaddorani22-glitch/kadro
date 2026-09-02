/**
 * Body measurements are stored in centimetres and kilograms and only displayed
 * in something else. The app used to ask everyone for centimetres at
 * onboarding step five, which is a wall for the US and UK traffic it is aimed
 * at, and it forced a German decimal comma on every reader.
 *
 * The invariant that matters most: switching units must never move a target.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => readFile(resolve(projectRoot, relative), 'utf8');

/** Loads units.ts without its runtime dependency on the i18n provider. */
const source = (await read('src/utils/units.ts')).replace(
  /^import[^;]+;$/gm,
  '',
).replace(
  'export type UnitSystem',
  "const getLocale = () => 'en-GB';\nconst deviceRegion = () => undefined;\nexport type UnitSystem",
);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const units = await import(`data:text/javascript;charset=utf-8,${encodeURIComponent(outputText)}`);

// --- Conversions must round-trip -------------------------------------------
for (let cm = 130; cm <= 220; cm += 1) {
  const back = units.totalInchesToCm(units.cmToTotalInches(cm));
  assert.ok(Math.abs(back - cm) <= 1, `height ${cm} cm round-tripped to ${back} cm`);
}
for (let kg = 40; kg <= 200; kg += 0.5) {
  const back = units.poundsToKg(units.kgToPounds(kg));
  assert.ok(Math.abs(back - kg) < 1e-9, `weight ${kg} kg round-tripped to ${back} kg`);
}

// --- Known values, checked against the real conversion ---------------------
assert.equal(units.formatHeight(180, 'metric'), '180 cm');
assert.equal(units.formatHeight(180, 'us'), '5′ 11″');
assert.equal(units.formatHeight(180, 'uk'), '5′ 11″');
assert.equal(units.formatWeight(84, 'metric', 'en-GB'), '84.0 kg');
assert.equal(units.formatWeight(84, 'us', 'en-GB'), '185.2 lb');
assert.equal(units.formatWeight(84, 'uk', 'en-GB'), '13 st 3 lb');

// Stone must roll over rather than print fourteen pounds.
for (let kg = 25; kg <= 400; kg += 0.1) {
  const text = units.formatWeight(kg, 'uk', 'en-GB');
  const pounds = Number(text.match(/(\d+) lb/)[1]);
  assert.ok(pounds < 14, `${kg.toFixed(1)} kg printed "${text}"`);
  const parts = units.kgToStoneParts(kg);
  assert.ok(parts.pounds < 14, `${kg.toFixed(1)} kg split into ${parts.stone} st ${parts.pounds} lb`);
}

// --- The decimal separator follows the language ----------------------------
assert.equal(units.formatWeight(84.2, 'metric', 'de-DE'), '84,2 kg');
assert.equal(units.formatWeight(84.2, 'metric', 'en-GB'), '84.2 kg');

// --- Locale defaults --------------------------------------------------------
// The default follows the device REGION, never the app language: en-GB is the
// tag English uses, so reading the language handed Americans stone and pounds.
assert.equal(units.defaultUnitSystem('US'), 'us');
assert.equal(units.defaultUnitSystem('GB'), 'uk');
assert.equal(units.defaultUnitSystem('DE'), 'metric');
assert.equal(units.defaultUnitSystem(undefined), 'metric', 'an unknown region must default to metric');
// Everywhere else weighs in kilograms, including English-speaking countries.
for (const region of ['AU', 'IE', 'CA', 'NZ', 'FR', 'ES', 'IN']) {
  assert.equal(units.defaultUnitSystem(region), 'metric', `${region} must default to metric`);
}
const unitsSource = await read('src/utils/units.ts');
assert.ok(unitsSource.includes('deviceRegion'), 'the unit default must read the device region');
assert.ok(
  !/defaultUnitSystem\(region = getLocale/.test(unitsSource),
  'the unit default must not be derived from the app language tag',
);

// --- Input parsing ----------------------------------------------------------
assert.equal(units.parseWeightInput('84,2', 'metric'), 84.2, 'a comma must parse like a dot');
assert.equal(units.parseWeightInput('185.2', 'us'), 84, 'pounds must come back as kilograms');
assert.equal(units.parseWeightInput('abc', 'metric'), null);
assert.equal(units.parseWeightInput('0', 'metric'), null);
assert.equal(units.parseWeightInput('900', 'metric'), null, 'an implausible weight must be rejected');
// 13 st 3 lb is 185 lb, which is 83.9 kg — the display rounds to whole pounds,
// so a round trip through stone is accurate to a tenth of a kilogram, not exact.
assert.equal(units.parseStoneInput('13', '3'), 83.9, 'stone and pounds must come back as kilograms');
assert.ok(Math.abs(units.parseStoneInput('13', '3') - 84) <= 0.15, 'the stone round trip must stay within 150 g');
assert.equal(units.parseStoneInput('13', '14'), null, 'fourteen pounds is another stone, not a valid entry');
assert.equal(units.parseStoneInput('13', '-1'), null);

// --- Weekly rate ------------------------------------------------------------
assert.equal(units.formatWeeklyRate(0.5, 'metric', 'en-GB'), '0.5 kg');
assert.equal(units.formatWeeklyRate(0.5, 'us', 'en-GB'), '1 lb');
assert.equal(units.formatWeeklyRate(0.25, 'us', 'en-GB'), '0.5 lb');

// --- Switching units must not move a target --------------------------------
// This is the whole reason storage stays metric.
const personalization = await read('src/services/personalization.ts');
const calculation = personalization.slice(
  personalization.indexOf('export function calculateDailyTargets'),
);
const calculationBody = calculation.slice(0, calculation.indexOf('\n}\n') + 2);
assert.ok(calculationBody.includes('calculateDailyTargets'), 'could not locate the target calculation');
assert.ok(
  !/unitSystem/.test(calculationBody),
  'the target calculation must not read the unit system — units are display only',
);
assert.ok(
  /weightKg|heightCm/.test(calculationBody),
  'the target calculation must work from the stored metric values',
);
const context = await read('src/context/AppContext.tsx');
const setter = context.slice(context.indexOf('const setUnitSystem'), context.indexOf('const addWeightEntry'));
assert.ok(setter.includes('unitSystem'), 'setUnitSystem must write the unit system');
assert.ok(!/heightCm|weightKg\s*[:=]/.test(setter), 'changing units must not rewrite the stored measurements');

// --- No screen may hardcode a unit or a decimal comma any more -------------
for (const file of ['src/app/onboarding.tsx', 'src/app/(tabs)/progress.tsx', 'src/app/(tabs)/profile.tsx']) {
  const screen = await read(file);
  assert.ok(!screen.includes("replace('.', ',')"), `${file}: still forces a German decimal comma`);
}

// A decimal comma can also be written straight into a literal, which is how
// "0,7×" survived on the confirm screen long after the rest was translated.
for (const file of [
  'src/app/confirm.tsx',
  'src/app/(tabs)/progress.tsx',
  'src/app/(tabs)/today.tsx',
  'src/components/MealDetailSheet.tsx',
]) {
  const screen = await read(file);
  const offending = screen.split('\n').flatMap((line, index) => {
    const values = [...line.matchAll(/'((?:[^'\\]|\\.)*)'|`([^`]*)`/g)]
      .map((m) => m[1] ?? m[2])
      // rgba(255,255,255,0.58) is a colour, not a number a reader ever sees.
      .map((value) => value.replace(/rgba?\([^)]*\)/g, ' '))
      .join(' ');
    return /\d,\d/.test(values) ? [`${file}:${index + 1}`] : [];
  });
  assert.deepEqual(offending, [], `a hardcoded decimal comma ships to English readers at ${offending.join(', ')}`);
}
const onboarding = await read('src/app/onboarding.tsx');
assert.ok(onboarding.includes('UnitToggle'), 'onboarding must let the user pick their units');
assert.ok(onboarding.includes('usesMetricHeight'), 'the height step must respect the chosen units');
assert.ok(onboarding.includes('usesMetricWeight'), 'the weight step must respect the chosen units');

// --- The database has to keep it -------------------------------------------
const migration = await read('supabase/migrations/20260902140000_add_unit_system.sql');
assert.match(migration, /add column if not exists unit_system/, 'the column must be added idempotently');
assert.match(migration, /check \(unit_system in \('metric', 'us', 'uk'\)\)/, 'the column must be constrained');
const cloud = await read('src/services/cloudRepository.ts');
assert.ok(cloud.includes('unit_system'), 'the unit system must sync to the cloud');
assert.ok(cloud.includes('isUnitSystem('), 'a row written before the column existed must not break the profile');

console.log('Validated unit conversions, stone rollover, locale defaults, input parsing, and that switching units cannot move a target.');
