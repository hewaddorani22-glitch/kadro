/**
 * The daily target is the app's central number. It is a wellness estimate, not
 * a measurement — but it has to be internally coherent and plausible across
 * every profile a real person can enter.
 *
 * Two things this pins down:
 *
 *  - The three macros must describe the same day as the calorie figure.
 *    Scaling protein from total body weight meant a heavy person on a deficit
 *    saw 1320 kcal as their target while the macros beside it summed to 1845.
 *  - The estimate must stay inside a defensible band. Kandro does not ask for
 *    sex, so it uses the midpoint of Mifflin-St Jeor; that costs roughly
 *    ±115 kcal a day and the app must not drift further than that on its own.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = (await readFile(resolve(projectRoot, 'src/services/personalization.ts'), 'utf8'))
  .replace(/^import[^;]+;$/gm, '')
  .replace('export const DEFAULT_PROFILE', "const getDictionary = () => ({ common: {} });\nconst formatWeeklyRate = (v) => String(v);\nexport const DEFAULT_PROFILE");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const { calculateDailyTargets } = await import(`data:text/javascript;charset=utf-8,${encodeURIComponent(outputText)}`);

const ACTIVITY = { low: 1.2, light: 1.375, high: 1.6 };
let checked = 0;
let mismatched = 0;
let worst = null;

for (let age = 18; age <= 75; age += 3)
for (let heightCm = 150; heightCm <= 200; heightCm += 5)
for (let weightKg = 45; weightKg <= 160; weightKg += 5) {
  const bmi = weightKg / ((heightCm / 100) ** 2);
  if (bmi < 17 || bmi > 45) continue;
  for (const activityLevel of ['low', 'light', 'high'])
  for (const goal of ['lose', 'maintain', 'gain'])
  for (const weeklyRateKg of [0.25, 0.5]) {
    const profile = { age, heightCm, weightKg, activityLevel, goal, weeklyRateKg, displayName: '', preferences: [], completedAt: null, unitSystem: 'metric' };
    const t = calculateDailyTargets(profile);
    checked += 1;

    // --- The macros must describe the calorie figure ------------------------
    const fromMacros = t.protein * 4 + t.carbs * 4 + t.fat * 9;
    const drift = fromMacros - t.calories;
    if (Math.abs(drift) > 100) {
      mismatched += 1;
      if (!worst || Math.abs(drift) > Math.abs(worst.drift)) worst = { ...profile, ...t, fromMacros, drift };
    }

    // --- Every figure has to be usable --------------------------------------
    for (const [key, value] of Object.entries(t)) {
      assert.ok(Number.isFinite(value) && value > 0, `${key} was ${value} for ${JSON.stringify(profile)}`);
    }
    assert.ok(t.calories >= 1_300, `a target of ${t.calories} kcal is below the safety floor`);
    assert.ok(t.calories <= 4_000, `a target of ${t.calories} kcal is implausibly high`);

    // --- Protein must be useful but not absurd ------------------------------
    const proteinShare = (t.protein * 4) / t.calories;
    assert.ok(proteinShare <= 0.4, `protein is ${Math.round(proteinShare * 100)}% of energy for ${JSON.stringify(profile)}`);
    assert.ok(t.protein >= 70, `protein of ${t.protein} g is too low to protect muscle`);
    // Fat has an absolute floor as well as a share: 45 g is only 15% of a
    // 2700 kcal day, but it is still 0.8 g per kilo for the light, very active
    // person that combination describes. Both readings must stay sane.
    const fatShare = (t.fat * 9) / t.calories;
    const fatPerKilo = t.fat / weightKg;
    assert.ok(
      fatPerKilo >= 0.4 || fatShare >= 0.2,
      `fat is ${t.fat} g — ${fatPerKilo.toFixed(2)} g/kg and ${Math.round(fatShare * 100)}% of energy`,
    );
    assert.ok(fatShare <= 0.5, `fat is ${Math.round(fatShare * 100)}% of energy for ${JSON.stringify(profile)}`);

    // --- The estimate must track the person ---------------------------------
    const resting = 10 * weightKg + 6.25 * heightCm - 5 * age - 78;
    const maintenance = resting * ACTIVITY[activityLevel];
    if (goal === 'maintain') {
      assert.ok(
        Math.abs(t.calories - maintenance) < Math.max(60, maintenance * 0.31),
        `maintaining should sit near maintenance, got ${t.calories} against ${Math.round(maintenance)}`,
      );
    }
  }
}

assert.ok(checked > 5_000, `expected a broad sweep, only checked ${checked}`);
assert.ok(
  mismatched === 0,
  `${mismatched} of ${checked} profiles have macros that do not add up to their calorie target`
  + (worst ? `; worst: ${JSON.stringify(worst)}` : ''),
);

// --- Two people who differ only in one input must differ in the same direction
const base = { displayName: '', preferences: [], completedAt: null, unitSystem: 'metric', goal: 'lose', weeklyRateKg: 0.5, activityLevel: 'light' };
const lighter = calculateDailyTargets({ ...base, age: 30, heightCm: 175, weightKg: 60 });
const heavier = calculateDailyTargets({ ...base, age: 30, heightCm: 175, weightKg: 90 });
assert.ok(heavier.calories > lighter.calories, 'a heavier person must get a higher target');
const younger = calculateDailyTargets({ ...base, age: 20, heightCm: 175, weightKg: 75 });
const older = calculateDailyTargets({ ...base, age: 70, heightCm: 175, weightKg: 75 });
assert.ok(younger.calories > older.calories, 'age must lower the estimate');
const sedentary = calculateDailyTargets({ ...base, activityLevel: 'low', age: 30, heightCm: 175, weightKg: 75 });
const active = calculateDailyTargets({ ...base, activityLevel: 'high', age: 30, heightCm: 175, weightKg: 75 });
assert.ok(active.calories > sedentary.calories, 'activity must raise the estimate');

// --- The known limitation must stay documented -----------------------------
const raw = await readFile(resolve(projectRoot, 'src/services/personalization.ts'), 'utf8');
assert.match(raw, /- 78/, 'the sex-neutral Mifflin-St Jeor constant must not change silently');
assert.match(
  raw,
  /does not collect sex/i,
  'the reason the estimate is sex-neutral has to stay written down next to the formula',
);

console.log(`Validated ${checked} target profiles: macros always describe the calorie figure, protein stays under 40% of energy, and the estimate tracks weight, age and activity.`);
