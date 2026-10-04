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
import ts from 'typescript';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const result = await readFile(resolve(projectRoot, 'src/app/result.tsx'), 'utf8');

// Execute the shipped arithmetic, including new meals, saved revisions,
// unrelated meals and an edited meal crossing the daily budget boundary.
const nutritionSource = await readFile(resolve(projectRoot, 'src/services/mockNutrition.ts'), 'utf8');
const ast = ts.createSourceFile('mockNutrition.ts', nutritionSource, ts.ScriptTarget.Latest, true);
const arithmetic = ast.statements.filter(node => ts.isFunctionDeclaration(node) && ['sumMeals','getRemaining','projectMealForDay'].includes(node.name?.text)).map(node => node.getText(ast).replace(/^export /, '')).join('\n');
const emitted = ts.transpileModule(arithmetic, {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const project = new Function(`${emitted}; return projectMealForDay;`)();
const targets = {calories:2420, protein:125, carbs:335, fat:65};
const original = {id:'current', calories:579, protein:32, carbs:76, fat:19};
const edited = {id:'current', calories:554, protein:31, carbs:88, fat:9};
const unrelated = {id:'other', calories:400, protein:20, carbs:40, fat:10};
assert.equal(project(targets, [], original).remaining.calories, 1841);
assert.equal(project(targets, [original], original).remaining.calories, 1841, 'saved meal is not counted twice');
assert.deepEqual(project(targets, [original], edited).remaining, {calories:1866,protein:94,carbs:247,fat:56}, 'native 579 -> 554 kcal correction updates every remaining value immediately');
assert.equal(project(targets, [original, unrelated], edited).remaining.calories, 1466);
assert.equal(project(targets, [edited, unrelated], edited).remaining.calories, 1466, 'projection stays stable after persistence catches up');
assert.equal(project(targets, [original, unrelated], edited).before.calories, 2020);
const large = {...edited, calories:2500};
assert.equal(project(targets, [original, unrelated], large).consumed.calories, 2900);
assert.equal(project(targets, [original, unrelated], large).remaining.calories, 0);
assert.doesNotMatch(result, /savedOnArrival\.current \|\| isCurrentScanLogged/, 'a confirmed edit must be persisted on arrival too');

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
