#!/usr/bin/env node
/**
 * Today lists four meal slots, always all four, each with its own "+".
 *
 * Before this the day was a flat list and the app guessed the slot from the
 * clock, so a late breakfast was filed as dinner with no way to say otherwise.
 * The guess is still the fallback; what must not regress is that a stated slot
 * beats it, and that a stated slot does not leak into the next scan.
 */
import { readFileSync } from 'node:fs';

const problems = [];
const today = readFileSync(new URL('../src/app/(tabs)/today.tsx', import.meta.url), 'utf8');
const context = readFileSync(new URL('../src/context/AppContext.tsx', import.meta.url), 'utf8');
const dictionaries = {
  de: readFileSync(new URL('../src/i18n/de.ts', import.meta.url), 'utf8'),
  en: readFileSync(new URL('../src/i18n/en.ts', import.meta.url), 'utf8'),
};

if (!/\['Breakfast', 'Lunch', 'Dinner', 'Snack'\] as const/.test(today)) {
  problems.push('today.tsx: the four slots are no longer rendered as a fixed set');
}
if (!/onPress=\{\(\) => startScan\(slot\.type\)\}/.test(today)) {
  problems.push('today.tsx: the per-slot add button does not pass its slot');
}
if (!/if \(slot\) setPlannedMealType\(slot\);/.test(today)) {
  problems.push('today.tsx: startScan does not record the chosen slot');
}
// resetScan clears the choice, so setting it first would be setting nothing.
const startScan = today.slice(today.indexOf('const startScan'), today.indexOf('const slots'));
if (startScan.indexOf('resetScan()') > startScan.indexOf('setPlannedMealType')) {
  problems.push('today.tsx: the slot is set before resetScan, which clears it again');
}
for (const [language, source] of Object.entries(dictionaries)) {
  if (!/addTo: \(slot: string\)/.test(source)) {
    problems.push(`${language}: the per-slot add button has no accessible label`);
  }
}

// A stated slot must win over the clock in both logging paths.
const guess = /hour < 11 \? 'Breakfast' : hour < 15 \? 'Lunch' : hour < 21 \? 'Dinner' : 'Snack'/;
for (const [label, slice] of [
  ['logScannedMeal', context.slice(context.indexOf('const logScannedMeal'), context.indexOf('const logPlannedMeal'))],
  ['logPlannedMeal', context.slice(context.indexOf('const logPlannedMeal'), context.indexOf('const repeatMeals'))],
  ['logRepeatMeal', context.slice(context.indexOf('const logRepeatMeal'), context.indexOf('const deleteLoggedMeal'))],
]) {
  if (!/plannedMealTypeRef\.current/.test(slice)) {
    problems.push(`AppContext: ${label} ignores the slot the user chose`);
  }
}
if (!guess.test(context)) {
  problems.push('AppContext: the clock fallback is gone, so an unstated slot has no answer');
}
const reset = context.slice(context.indexOf('const resetScan'), context.indexOf('const resetScan') + 900);
if (!/plannedMealTypeRef\.current = null;/.test(reset)) {
  problems.push('AppContext: resetScan leaves the old slot behind, so the next scan inherits it');
}

if (problems.length) {
  console.error('Meal-slot check failed:');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log('Meal slots: four on Today, each logging into itself, the clock only as fallback.');
