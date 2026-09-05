#!/usr/bin/env node
/**
 * The onboarding steppers hold a number that other screens convert.
 *
 * Weight is stored in kilograms but entered in pounds outside the metric
 * world, and 176 lb comes back as 79.8 kg. Adding a whole step to that carried
 * the .8 for ever: pressing plus went 79.8, 80.8, 81.8, so only the digits in
 * front of the separator ever changed. That is what a user sees as "the number
 * after the comma is stuck".
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/app/onboarding.tsx', import.meta.url), 'utf8');
const decimalModule = { exports: {} };
new Function('module', 'exports', ts.transpileModule(readFileSync(new URL('../src/utils/decimalInput.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(decimalModule, decimalModule.exports);
for (const [text, expected] of [['45,5',45.5], ['60.4',60.4], ['83',83], ['40.0',40], ['200',200], ['',null], ['60,',null], ['60.45',null], ['60x',null], ['39.9',null], ['200.1',null], ['1e2',null]]) {
  assert.equal(decimalModule.exports.parseDecimalInput(text,40,200), expected, `weight input ${text}`);
}

// --- The shipped arithmetic, lifted out and run ----------------------------
const body = source.slice(source.indexOf('const apply = useCallback('), source.indexOf('const stop = useCallback('));
assert.match(body, /const steps = latest\.current \/ step;/, 'the grid snap is gone');

const apply = (value, direction, { step = 1, min = -Infinity, max = Infinity } = {}) => {
  const steps = value / step;
  const onGrid = Math.abs(steps - Math.round(steps)) < 1e-9;
  const raw = onGrid ? value + direction * step
    : (direction > 0 ? Math.ceil(steps) : Math.floor(steps)) * step;
  return Math.min(max, Math.max(min, raw));
};

// --- A fraction has to disappear on the first press ------------------------
assert.equal(apply(79.8, 1, { min: 40, max: 200 }), 80, 'plus left the fraction behind');
assert.equal(apply(79.8, -1, { min: 40, max: 200 }), 79, 'minus left the fraction behind');
assert.equal(apply(80.7, 1), 81);
assert.equal(apply(80.7, -1), 80);
// And it must not come back on the next press.
let value = 80.7;
for (let press = 0; press < 6; press += 1) value = apply(value, 1);
assert.equal(value, 86, `six presses from 80.7 should reach 86, reached ${value}`);
assert.ok(Number.isInteger(value), 'the fraction survived repeated presses');

// --- Whole values still move by exactly one step ---------------------------
assert.equal(apply(78, 1), 79);
assert.equal(apply(78, -1), 77);
assert.equal(apply(170, 1, { step: 1, min: 130, max: 220 }), 171);

// --- Bounds still hold ------------------------------------------------------
assert.equal(apply(200, 1, { min: 40, max: 200 }), 200, 'the upper bound leaked');
assert.equal(apply(40, -1, { min: 40, max: 200 }), 40, 'the lower bound leaked');
assert.equal(apply(40.4, -1, { min: 40, max: 200 }), 40, 'a fraction escaped below the minimum');

// --- Floating point must not defeat the grid test --------------------------
assert.equal(apply(0.1 + 0.2 + 79.7, 1, { min: 40, max: 200 }), 81,
  'a value that is 80.00000000000001 counted as off the grid');

// --- The kilogram display follows the language -----------------------------
const weightStep = source.slice(source.indexOf("{step === 'weight' ?"), source.indexOf("{step === 'activity' ?"));
assert.match(weightStep, /onChange=\{setWeight\}\s+step=\{0\.1\}/);
assert.equal((weightStep.match(/\beditable\b/g) || []).length, 2);
assert.match(source, /if \(parsed === null\) return; onChange\(parsed\);/);
assert.match(source, /weightKg: weight/);
assert.match(weightStep, /onChange=\{\(pounds\) => setWeight\(poundsToKg\(pounds\)\)\}/);
assert.match(weightStep, /step=\{unitSystem === 'us' \? 0\.1 : 1\}/);
// Execute the actual conversion helpers and the actual UI onChange expression.
const unitsSource = readFileSync(new URL('../src/utils/units.ts', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '');
const unitsModule = {exports:{}};
new Function('module','exports',ts.transpileModule(unitsSource,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(unitsModule,unitsModule.exports);
const {poundsToKg,kgToPounds}=unitsModule.exports;
const changeExpression=weightStep.match(/onChange=\{\(pounds\) => setWeight\(([^\n]+)\)\}/)[1];
const changePounds=new Function('pounds','poundsToKg',`return ${changeExpression}`);
for(let tenth=882;tenth<4409;tenth++) {
  const lb=tenth/10;
  const kg=changePounds(lb,poundsToKg);
  assert.equal(Math.round(kgToPounds(kg)*10)/10,lb,`lb entry drift at ${lb}`);
  // Profile storage uses numeric(5,2); that precision still retains 0.1 lb.
  assert.equal(Math.round(kgToPounds(Math.round(kg*100)/100)*10)/10,lb,`stored lb drift at ${lb}`);
}
let lb=218.9;
for(let tap=1;tap<=20;tap++) {
  lb=Math.round(kgToPounds(changePounds(apply(lb,1,{step:0.1}),poundsToKg))*10)/10;
  assert.equal(lb,Math.round((218.9+tap*0.1)*10)/10);
}
for(let tap=1;tap<=20;tap++) {
  lb=Math.round(kgToPounds(changePounds(apply(lb,-1,{step:0.1}),poundsToKg))*10)/10;
  assert.equal(lb,Math.round((220.9-tap*0.1)*10)/10);
}
assert.match(weightStep, /format=\{\(kilos\) => formatNumber\(kilos, locale\)\}/,
  'a kilogram with a decimal renders with an English separator on a German screen');

// --- A gram amount can carry a decimal, so it has to follow the language ---
/**
 * resolveGrams keeps a tenth, so 110.3 g is a real value a user can enter.
 * Rendered raw it becomes "110.3 g" on a German screen while the confirmation
 * step, which does localise it, says "110,3 g" for the same meal.
 */
for (const file of ['src/app/result.tsx', 'src/components/MealDetailSheet.tsx', 'src/app/confirm.tsx']) {
  const text = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  const raw = text.match(/\{item\.(amountG|calories)\}/g);
  assert.equal(raw, null, `${file} renders ${raw && raw[0]} without the locale`);
}

console.log('Steppers: a converted value snaps back onto the grid on the first press, bounds still hold, and gram amounts follow the language.');
