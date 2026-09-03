#!/usr/bin/env node
/**
 * The build animation is only honest if its timing lands on the arithmetic.
 *
 * The figure climbs through the real intermediate values, so it has to reach
 * each one exactly as that step is announced and finish on the number the very
 * next screen shows. A drift here turns a calculation back into theatre — the
 * thing the animation replaced.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => readFileSync(resolve(projectRoot, relative), 'utf8');

const source = read('src/components/PlanBuilder.tsx')
  .replace(/^import[^;]+;$/gm, '')
  // Everything below the exported helpers is React, which this does not run.
  .slice(0, undefined)
  .replace(/export function PlanBuilder[\s\S]*$/, '');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
});
const { frameAt, BUILDING_MS } = await import(`data:text/javascript;charset=utf-8,${encodeURIComponent(outputText)}`);

// --- The chain is walked in order, and finishes ----------------------------
const kcal = (value) => ({ value, unit: 'kcal' });
const values = [kcal(1830), kcal(2520), kcal(1970), { value: 155, unit: 'g' }];
assert.equal(frameAt(0, values).value, 0, 'the count starts from nothing, so it is visibly a count');
assert.equal(frameAt(1, values).value, values.at(-1).value, 'the animation must end on the final target');
assert.equal(frameAt(1, values).settled, values.length, 'every value must be marked done at the end');
assert.equal(frameAt(2, values).value, values.at(-1).value, 'overrunning must not run past the end');
assert.equal(frameAt(-1, values).value, 0);

// Each value is reached exactly, at the end of its own slot.
for (const [index, step] of values.entries()) {
  const endOfSlot = (index + 1) / values.length;
  assert.equal(frameAt(endOfSlot - 1e-6, values).value, step.value,
    `value ${index} never actually reaches ${step.value}`);
  assert.equal(frameAt(endOfSlot - 1e-6, values).index, index, 'the caption is on the wrong step');
}

// The count only ever moves forward through a rising chain, and back through a
// falling one: it must never jump past a value and come back.
// A change of unit restarts the count rather than dragging the old figure down.
{
  const atSwitch = frameAt(3 / 4 + 1e-6, values);
  assert.equal(atSwitch.index, 3, 'the last step should be the protein one');
  assert.ok(atSwitch.value < 100, `the protein count started at ${atSwitch.value}, not from zero`);
}

for (const chain of [
  values,
  [kcal(1189), kcal(1427), kcal(877), kcal(1300), { value: 90, unit: 'g' }],
  [kcal(1830), kcal(2520), { value: 135, unit: 'g' }],
]) {
  let previousIndex = 0;
  for (let progress = 0; progress <= 1; progress += 0.005) {
    const frame = frameAt(progress, chain);
    assert.ok(frame.index >= previousIndex, 'the announced step went backwards');
    assert.ok(frame.index < chain.length, 'the step index ran past the chain');
    assert.ok(Number.isFinite(frame.value) && frame.value >= 0, 'the figure left the numbers behind');
    const previous = chain[frame.index - 1];
    const from = !previous || previous.unit !== chain[frame.index].unit ? 0 : previous.value;
    const bounds = [from, chain[frame.index].value].sort((a, b) => a - b);
    assert.ok(frame.value >= bounds[0] - 1 && frame.value <= bounds[1] + 1,
      `the figure showed ${frame.value}, outside the step it is animating`);
    previousIndex = frame.index;
  }
}

assert.deepEqual(frameAt(0.5, []), { index: 0, value: 0, settled: 0 }, 'an empty chain must not crash the screen');

// --- The screen waits for the animation ------------------------------------
const onboarding = read('src/app/onboarding.tsx');
assert.match(onboarding, /BUILDING_MS \+ 450/,
  'the step advances before the last figure is readable');
assert.ok(BUILDING_MS >= 2500 && BUILDING_MS <= 5000, `${BUILDING_MS} ms is not a believable amount of work`);

// --- Feedback where a finger expects it ------------------------------------
const stepper = onboarding.slice(onboarding.indexOf('const apply = useCallback'), onboarding.indexOf('const stop = useCallback'));
assert.match(stepper, /Haptics\.selectionAsync\(\)/,
  'a held stepper runs through twenty values in silence');
assert.ok(stepper.indexOf('if (next === latest.current) return;') < stepper.indexOf('Haptics'),
  'holding at a bound must not keep buzzing when nothing changes');
assert.match(onboarding, /step !== 'plan'\) return;\s*\n\s*void Haptics\.notificationAsync/,
  'the plan arrives without any feedback that it did');
assert.match(read('src/components/PlanBuilder.tsx'), /Haptics\.impactAsync/,
  'the figures land without a tick');

// Every place in the onboarding where a finger does something.
for (const [label, pattern] of [
  ['skipping a step', /const skipStep = \(\) => \{\s*\n\s*void Haptics\.selectionAsync\(\);/],
  ['choosing an answer', /const selectAndAdvance = [^;]*?\{\s*\n\s*void Haptics\.selectionAsync\(\);/s],
  ['going back', /const goBack = \(\) => \{\s*\n\s*void Haptics\.selectionAsync\(\);/],
  ['switching units', /onChange\(system\);/],
  ['accepting consent', /NotificationFeedbackType\.Success/],
  ['consent failing', /NotificationFeedbackType\.Error/],
]) {
  assert.match(onboarding, pattern, `${label} gives no feedback`);
}

console.log('Plan builder: the count reaches every value and ends on the target, and the taps are felt.');
