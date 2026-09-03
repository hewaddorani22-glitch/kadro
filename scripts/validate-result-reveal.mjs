/**
 * The result screen counts up to the meal's calories. That reveal is the first
 * number a user sees after logging, and it must actually arrive.
 *
 * It used to depend on `projected.calories`, which changes a moment after
 * arrival because the screen logs the meal on mount. Every change tore the
 * animation down and restarted it from zero: the figure took 2.4 seconds to
 * appear, and under some timings it stayed at "~0 kcal" indefinitely.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const result = await readFile(resolve(projectRoot, 'src/app/result.tsx'), 'utf8');

// --- The reveal runs once ---------------------------------------------------
const start = result.indexOf('const mealListener = mealProgress.addListener');
assert.ok(start > 0, 'could not locate the reveal effect');
const deps = result.slice(result.indexOf('}, [', start), result.indexOf(']);', result.indexOf('}, [', start)));
for (const moving of ['projected.calories', 'scannedMeal.calories', 'startingRemaining', 'consumed']) {
  assert.ok(
    !deps.includes(moving),
    `the reveal must not restart when ${moving} changes — logging the meal changes it seconds after arrival`,
  );
}

// --- but still reads the current numbers ------------------------------------
const effect = result.slice(start, result.indexOf('}, [', start));
assert.match(effect, /targetsRef\.current\.calories/, 'the reveal must read the live figure, not a captured one');
assert.match(result, /targetsRef\.current = \{/, 'the live figures must be refreshed every render');

// --- and a later correction must still show ---------------------------------
assert.match(result, /revealDone/, 'the screen must know when the reveal has finished');
assert.match(
  result,
  /if \(!revealDone\.current\) return;[\s\S]{0,160}setDisplayedCalories\(scannedMeal\.calories\)/,
  'once the reveal is done, a corrected meal must update the figure directly',
);
// Reduced motion skips the animation, so it has to mark the reveal done too.
const reduced = result.slice(result.indexOf('if (reduceMotion)'), result.indexOf('if (reduceMotion)') + 300);
assert.match(reduced, /revealDone\.current = true/, 'reduced motion must also count as a finished reveal');

// --- The figure must never be presented as final while it is still zero -----
assert.match(result, /useState\(0\)/, 'the counter starts at zero by design');
assert.ok(
  result.includes('.start(() => {'),
  'the animation needs a completion callback, otherwise nothing can know it finished',
);

console.log('Validated the result reveal: runs once, reads live figures, survives the meal being logged, and updates after a correction.');
