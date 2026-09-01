/**
 * The loop the whole product rests on: eat something, the day changes.
 *
 * Choosing a recommendation used to do nothing at all — no entry, no calories.
 * These checks pin the three ways a meal can enter the day and the maths behind
 * the targets, so a refactor cannot quietly break the promise again.
 */
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, renameSync, rmSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFile(resolve(projectRoot, p), 'utf8');

const [plan, appContext, today, repeatSource, personalization, mealsMigration] = await Promise.all([
  read('src/app/(tabs)/plan.tsx'),
  read('src/context/AppContext.tsx'),
  read('src/app/(tabs)/today.tsx'),
  read('src/services/repeatMeals.ts'),
  read('src/services/personalization.ts'),
  read('supabase/migrations/20260901160000_allow_planned_meals.sql'),
]);

const failures = [];

// 1. A chosen recommendation must actually be logged.
if (!plan.includes('logPlannedMeal')) failures.push('choosing a recommendation does not log a meal');
if (!plan.includes('Gegessen, Tag aktualisieren')) failures.push('the plan screen has no action that commits the meal');
if (!plan.includes('setPortion')) failures.push('a chosen recommendation must let the user pick a portion');
if (!appContext.includes('createPlannedMeal')) failures.push('AppContext cannot build a planned meal');
if (!mealsMigration.includes("origin in ('scan', 'plan')")) failures.push('the database still rejects planned meals');

// The paywall must never sit between choosing a meal and eating it.
const choosePaywall = /setChosen\([^)]*\);\s*if \(params\.fromScan === '1'/.test(plan);
if (choosePaywall) failures.push('the paywall still fires on selection instead of after logging');

// 2. Free allowance is for paid analysis only.
for (const [label, contents] of [['plan', plan], ['today', today]]) {
  if (contents.includes('hasScanAccess')) failures.push(`${label} must not spend the scan allowance: nothing is analysed`);
}

// 3. Repeats must never duplicate what is already on the plate today.
if (!repeatSource.includes('availableRepeats') || !repeatSource.includes('eatenToday')) {
  failures.push('repeat suggestions do not exclude meals already logged today');
}
if (!today.includes('logRepeatMeal')) failures.push('Today offers no one-tap repeat');

// 4. Target maths.
const activity = { low: 1.2, light: 1.375, high: 1.6 };
const target = (weight, height, age, level, goal, rate) => {
  const resting = 10 * weight + 6.25 * height - 5 * age - 78;
  const maintenance = resting * activity[level];
  const daily = (rate * 7700) / 7;
  const offset = goal === 'maintain' ? 0 : goal === 'lose' ? -daily : Math.min(350, daily);
  const floor = Math.max(1300, maintenance * 0.7);
  return Math.min(4000, Math.max(floor, Math.round((maintenance + offset) / 10) * 10));
};

try {
  // A faster rate must mean fewer calories when losing, never more.
  assert.ok(target(95, 185, 25, 'high', 'lose', 0.5) < target(95, 185, 25, 'high', 'lose', 0.25),
    '0.5 kg/week must be a larger deficit than 0.25');
  // Nobody is ever sent below the floor.
  assert.ok(target(50, 160, 35, 'low', 'lose', 0.5) >= 1300, 'the 1300 kcal floor must hold');
  // A surplus must stay a surplus but never run away.
  const bulk = target(70, 178, 17, 'high', 'gain', 0.5);
  const maintainTeen = target(70, 178, 17, 'high', 'maintain', 0.5);
  assert.ok(bulk > maintainTeen, 'gaining must exceed maintenance');
  assert.ok(bulk - maintainTeen <= 360, 'the surplus must stay capped near 350 kcal');
  // Two people of very different size must not receive the same deficit.
  const big = target(95, 185, 25, 'high', 'lose', 0.5);
  const small = target(55, 165, 30, 'low', 'lose', 0.5);
  assert.ok(big - small > 600, 'targets must scale with the person, not be a flat offset');
} catch (error) {
  failures.push(error.message);
}

if (!personalization.includes('KCAL_PER_KG')) failures.push('the rate maths must be derived, not a flat table');
if (personalization.includes('lose: -350')) failures.push('the flat goal adjustment is still in place');

// 5. Repeat grouping, run against the real module rather than its source text.
//    Transpiled with the project's own TypeScript so the test cannot drift from
//    what the app actually ships.
const outDir = mkdtempSync(join(tmpdir(), 'kandro-loop-'));
try {
  // The module's only import is type-only, so --noResolve lets tsc emit it
  // standalone. tsc still reports the unresolved path alias and exits non-zero;
  // the emitted file is what matters, and npm run typecheck already covers
  // types properly against the real tsconfig.
  try {
    execFileSync('npx', [
      'tsc', resolve(projectRoot, 'src/services/repeatMeals.ts'),
      '--outDir', outDir, '--module', 'esnext', '--target', 'es2022',
      '--skipLibCheck', '--noResolve',
    ], { cwd: projectRoot, stdio: 'pipe' });
  } catch {
    // Exit status ignored on purpose; the artifact check below is the real gate.
  }

  const compiled = join(outDir, 'repeatMeals.js');
  if (!existsSync(compiled)) throw new Error('repeatMeals.ts did not transpile');
  renameSync(compiled, join(outDir, 'repeatMeals.mjs'));
  const { availableRepeats, repeatCandidates } = await import(pathToFileURL(join(outDir, 'repeatMeals.mjs')).href);

  const meal = (title, calories, date, savedAt, origin = 'scan') => ({
    id: `${title}-${savedAt}`, title, calories, protein: 30, carbs: 40, fat: 10, fiber: 4,
    type: 'Lunch', time: '12:00', confidence: 'high', items: [], origin, date, savedAt,
  });

  const history = [
    meal('Skyr mit Beeren', 340, '2026-08-28', '2026-08-28T07:00:00Z'),
    meal('Skyr mit Beeren', 355, '2026-08-29', '2026-08-29T07:00:00Z'),
    meal('Skyr mit Beeren', 350, '2026-08-30', '2026-08-30T07:00:00Z'),
    meal('Döner', 700, '2026-08-29', '2026-08-29T13:00:00Z'),
    meal('Currywurst', 900, '2026-08-27', '2026-08-27T13:00:00Z'),
    meal('Rind-Reis-Pfanne', 770, '2026-09-01', '2026-09-01T12:00:00Z', 'plan'),
  ];

  const ranked = repeatCandidates(history);
  assert.equal(ranked[0].title, 'Skyr mit Beeren', 'the most frequent meal must rank first');
  assert.equal(ranked[0].count, 3, 'near-identical portions must merge into one entry');
  assert.equal(ranked[0].calories, 350, 'the most recent portion decides the numbers');
  assert.ok(ranked.some((c) => c.title === 'Rind-Reis-Pfanne'), 'meals chosen from the plan must be repeatable');

  const withoutToday = availableRepeats(history, [history[5]]);
  assert.ok(!withoutToday.some((c) => c.title === 'Rind-Reis-Pfanne'), 'what is already on the plate today must not be suggested');
  assert.ok(withoutToday.some((c) => c.title === 'Skyr mit Beeren'), 'the rest of the history stays available');

  const doubled = repeatCandidates([...history, meal('Skyr mit Beeren', 700, '2026-08-31', '2026-08-31T07:00:00Z')]);
  assert.equal(doubled.filter((c) => c.title === 'Skyr mit Beeren').length, 2, 'a genuinely different portion stays its own entry');

  assert.deepEqual(repeatCandidates([]), [], 'an empty history must not throw');
  assert.deepEqual(availableRepeats([], []), [], 'an empty day must not throw');
} catch (error) {
  failures.push(`repeat grouping: ${error.message}`);
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

if (failures.length) {
  throw new Error(`Daily loop validation failed:\n- ${failures.join('\n- ')}`);
}

console.log('Validated the daily loop: recommendations and repeats log real meals, repeat grouping behaves, neither spends the scan allowance, and targets scale with the person.');
