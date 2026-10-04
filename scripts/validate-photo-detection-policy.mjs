import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import { validateDetection } from '../supabase/functions/_shared/detection.mjs';
import { classifyDetection } from '../supabase/functions/_shared/nutrition.mjs';

/**
 * Evaluate captured model output against a separately established image label.
 * This cannot establish the label from pixels or measure portion accuracy.
 * In particular, a schema-valid shape with invented grams is NOT a photo pass.
 */
export function assertPhotoOutcome(detection, expectation, label = expectation) {
  validateDetection(detection);
  const classification = classifyDetection(detection, 'photo');
  if (expectation === 'no-food') {
    assert.equal(detection.items.length, 0, `${label}: non-food must not acquire ingredients or portions`);
    assert.equal(detection.dishCount, 0, `${label}: non-food must not become a meal`);
    assert.equal(detection.clarity, 'unclear', `${label}: no identifiable meal`);
    assert.equal(classification?.body.code, 'unclear_image', `${label}: use the existing recoverable photo error`);
  } else if (expectation === 'single-meal') {
    assert.ok(detection.items.length > 0, `${label}: visible food must remain usable`);
    assert.equal(detection.dishCount, 1, `${label}: one intended meal`);
    assert.equal(classification, null, `${label}: no blanket image rejection`);
  } else if (expectation === 'multiple-meals') {
    assert.ok(detection.dishCount > 1, `${label}: preserve ambiguous separate meals`);
    assert.equal(classification?.body.code, 'multiple_dishes', `${label}: do not silently pick or combine meals`);
  } else {
    throw new Error(`Unsupported photo expectation: ${expectation}`);
  }
}

function validateContract() {
  const empty = { title: 'No identifiable food', clarity: 'unclear', dishCount: 0, confidence: 'medium', items: [] };
  assertPhotoOutcome(empty, 'no-food');

  const meal = {
    title: 'Cooked rice', clarity: 'clear', dishCount: 1, confidence: 'medium',
    items: [{
      name: 'Cooked rice', searchTermEn: 'rice cooked', referenceKey: 'other',
      estimatedGrams: 150, estimatedGramsLow: 100, estimatedGramsHigh: 200,
      preparation: 'boiled', hiddenCaloriesRisk: 'low', confidence: 'medium',
      optional: false, pieceCount: null, pieceLabel: null,
    }],
  };
  assertPhotoOutcome(meal, 'single-meal');
  assertPhotoOutcome({ ...meal, dishCount: 2 }, 'multiple-meals');

  // The reported geometric image was schema-valid and passed classification.
  // A known non-food label must still make the evidence check fail; these
  // synthetic values test the checker, not the model's ability to see shapes.
  const fabricated = { ...meal, title: 'Geometric shape', items: [{ ...meal.items[0], name: 'Green square', searchTermEn: 'green square shape' }] };
  assert.throws(() => assertPhotoOutcome(fabricated, 'no-food'), /non-food must not acquire ingredients/);
  assert.throws(() => assertPhotoOutcome(empty, 'single-meal'), /visible food must remain usable/);
  assert.throws(() => assertPhotoOutcome({ ...meal, dishCount: 2 }, 'single-meal'), /one intended meal/);
  console.log('Validated photo-output contract and evidence-checker rejection cases; no vision inference performed.');
}

function validateReport(args) {
  let reportPath;
  const expectations = [];
  for (let index = 0; index < args.length; index++) {
    const option = args[index];
    const value = args[++index];
    assert.ok(value && !value.startsWith('--'), `Missing value for ${option}`);
    if (option === '--report') {
      assert.equal(reportPath, undefined, 'Supply one report');
      reportPath = value;
    } else {
      assert.ok(['--no-food', '--single-meal', '--multiple-meals'].includes(option), `Unknown option: ${option}`);
      expectations.push({ id: value, expectation: option.slice(2) });
    }
  }
  if (!args.length) return;
  assert.ok(reportPath && expectations.length, 'Use --report FILE and one or more --no-food/--single-meal/--multiple-meals CASE_ID labels');
  const report = JSON.parse(readFileSync(reportPath, 'utf8'));
  assert.ok(Array.isArray(report.cases), 'Expected report.cases with captured raw detections');
  for (const { id, expectation } of expectations) {
    const matching = report.cases.filter(entry => entry.id === id);
    assert.equal(matching.length, 1, `${id}: exactly one captured case is required`);
    const captured = matching[0];
    assert.equal(captured.status, 200, `${id}: model transport must have succeeded`);
    assert.ok(captured.raw, `${id}: evaluate captured raw output, not an edited substitute`);
    assertPhotoOutcome(captured.raw, expectation, id);
  }
  console.log(`Validated ${expectations.length} labelled captured photo outcomes; no assertion of weighed portions or universal accuracy.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  validateContract();
  validateReport(process.argv.slice(2));
}
