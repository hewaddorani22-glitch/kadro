import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { buildMealItem, buildAccuracyWarnings, incompleteNutritionError, ingredientCorrectionDraft } from '../server/core.mjs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const compile = source => {
  const module = { exports: {} };
  new Function('module', 'exports', ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(module, module.exports);
  return module.exports;
};
const correction = compile(read('src/utils/ingredientCorrection.ts'));
const { needsIngredientCorrection, canSaveMealDraft, replaceMealIngredient } = correction;
const facts = { calories: 200, protein: 10, carbs: 30, fat: 4, provider: 'usda', referenceId: 'fixture', label: 'Fixture' };
const known = buildMealItem({ name: 'Chips', estimatedGrams: 50, confidence: 'high' }, facts, 0);
const unknown = buildMealItem({ name: 'Unmatched ingredient', estimatedGrams: 100 }, null, 1);
const detection = { title: 'Fixture mixed meal', confidence: 'high', items: [{ estimatedGrams: 50 }, { estimatedGrams: 100 }] };
const items = [known, unknown];
const inputSnapshot = JSON.stringify(items);
assert.equal(known.portions, undefined, 'the chips fixture has no countable portion');
assert.equal(needsIngredientCorrection(known), false);
assert.equal(needsIngredientCorrection(unknown), true);
assert.equal(canSaveMealDraft(items), false);
assert.equal(canSaveMealDraft(items.map(item => ({ ...item, included: true }))), false);
assert.equal(canSaveMealDraft(items.map(item => ({ ...item, included: false }))), false);
assert.equal(canSaveMealDraft([]), false);
assert.equal(canSaveMealDraft([known]), true);
assert.equal(canSaveMealDraft([{ ...known, calories: 0, protein: 10 }]), false);
for (const bad of [NaN, Infinity, -1, undefined]) assert.equal(canSaveMealDraft([{ ...known, calories: bad }]), false);

const replacement = buildMealItem({ name: 'Apple', estimatedGrams: 150, confidence: 'high' }, facts, 9);
const repaired = replaceMealIngredient(items, unknown.id, replacement);
assert.equal(repaired.length, 2);
assert.equal(repaired[0], known, 'replacing fruit must not change chips');
assert.equal(repaired[1].id, unknown.id, 'ingredient identity stays stable');
assert.equal(repaired[1].name, 'Apple');
assert.equal(repaired[1].source.code, undefined, 'unmatched marker is removed');
assert.equal(canSaveMealDraft(repaired), true);
assert.equal(JSON.stringify(items), inputSnapshot, 'no mutation of the old draft');
assert.equal(replaceMealIngredient(items, unknown.id, unknown), items);
assert.equal(replaceMealIngredient(items, unknown.id, { ...replacement, amountG: NaN }), items);
assert.deepEqual(replaceMealIngredient(items, 'stale-id', replacement), items);

// The shared protocol helper, not a hand-written mock of its decision.
for (const protocol of [undefined, null, false, true, '1', 0, 2]) {
  assert.equal(ingredientCorrectionDraft(detection, items, protocol), null, `legacy/unknown protocol ${protocol}`);
}
assert.equal(incompleteNutritionError(items).status, 422);
const draft = ingredientCorrectionDraft(detection, items, 1);
assert.equal(draft.status, 200);
assert.equal(draft.body.correctionRequired, true);
assert.equal(draft.body.items.length, 2);
assert.equal(draft.body.confidence, 'medium');
assert.equal(ingredientCorrectionDraft(detection, [known], 1), null);
assert.equal(ingredientCorrectionDraft(detection, [], 1), null);
assert.equal(ingredientCorrectionDraft(detection, [{ ...known, protein: NaN }, unknown], 1), null);

function loadFunction(path, name, dependencies) {
  const source = read(path);
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  const node = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name);
  assert.ok(node, name);
  const code = ts.transpileModule(node.getText(ast).replace(/^export /, ''), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(dependencies), `${code}\nreturn ${name};`)(...Object.values(dependencies));
}
// Execute both shipped resolvers; one missing lookup does not drop the others.
for (const path of ['server/index.mjs', 'supabase/functions/nutrition/index.ts']) {
  const resolve = loadFunction(path, 'resolveDetection', {
    classifyDetection: () => null, resolveItem: async (_, i) => items[i],
    resolveBlsFacts: () => null, canonicalFoodQuery: x => x,
    isUsableSearchTerm: () => false, resolveFacts: async () => new Map(),
    buildMealItem: (_, __, i) => items[i], incompleteNutritionError,
    ingredientCorrectionDraft, buildAccuracyWarnings,
  });
  const call = protocol => path.startsWith('server/')
    ? resolve(detection, 'text', protocol)
    : resolve(detection, {}, 'text', undefined, protocol);
  assert.equal((await call(undefined)).status, 422, `${path}: old builds must fail closed`);
  assert.deepEqual(await call(1), draft, `${path}: new builds receive the intact correction draft`);
}

class AnalysisError extends Error {}
const readResponse = loadFunction('src/services/mealAnalysis.ts', 'readAnalysisResponse', {
  needsIngredientCorrection, MealAnalysisError: AnalysisError,
  getDictionary: () => ({ errors: { noClearMeal: 'unclear', gatewayMissingNutrition: 'missing' } }),
  gatewayMessage: () => 'error', localizeResult: value => value,
});
const response = body => ({ ok: true, json: async () => body });
await assert.rejects(() => readResponse(response({ items })), AnalysisError);
assert.equal((await readResponse(response(draft.body))).items.length, 2);
await assert.rejects(() => readResponse(response({ ...draft.body, items: [{ ...known, calories: NaN }, unknown] })), AnalysisError);

// Execute the actual summing function for 1-12 ingredients, with uncountable
// chips as item zero. Counting and nutrient arithmetic must be independent.
const sum = loadFunction('src/services/mockNutrition.ts', 'nutritionFromItems', {});
for (let count = 1; count <= 12; count++) {
  const meal = Array.from({ length: count }, (_, i) => ({ ...known, id: String(i), calories: 100 + i }));
  assert.equal(sum(meal).calories, count * 100 + count * (count - 1) / 2);
  assert.equal(sum(meal.map((item, i) => i === 0 ? { ...item, included: false } : item)).calories, sum(meal).calories - 100);
}
const confirm = read('src/app/confirm.tsx');
assert.doesNotMatch(confirm, /filter\([^\n]*portions\?\.length/);
assert.match(confirm, /detectedItems\.map[\s\S]*key=\{`ingredient-/);
assert.match(confirm, /correctionRequired \? <Card[\s\S]*t\.confirm\.incompleteTotal[\s\S]*: <Card style=\{styles\.estimateCard\}/);
assert.match(confirm, /disabled=\{!canConfirm\}/);
const app = read('src/context/AppContext.tsx');
assert.match(app, /if \(!canSaveMealDraft\(detectedItems\)\) throw/);
assert.match(app, /result\.correctionRequired !== true[\s\S]*countLifetimeScanOnce/);
assert.match(app, /correctionDraftRef\.current = result\.correctionRequired === true/);
assert.match(app, /const costsAnalysis = !FREE_ANALYSIS_MODES\.has\(scanModeRef\.current\) && !correctionDraftRef\.current/);
assert.match(app, /origin: costsAnalysis \? 'scan' : 'plan'/,
  'a refunded/manual repair must not spend a credit on the next history hydration');
const guard = read('src/components/AppRouteGuard.tsx');
assert.match(guard, /segments\[0\] === 'result'[\s\S]*!canSaveMealDraft\(detectedItems\)/);
assert.match(guard, /if \(missingMealDraft \|\| incompleteResult\) return/);
assert.match(read('supabase/functions/nutrition/index.ts'), /result\.body\.correctionRequired === true\) \{\s*await refundAnalysis/);
for (const route of ['photo', 'text']) assert.ok(read('supabase/functions/nutrition/index.ts').includes(`'${route}', claimUsda, input.ingredientCorrection`));
const search = read('src/app/correct-food.tsx');
assert.match(search, /current !== generation\.current/);
assert.match(search, /useFocusEffect/);
assert.match(search, /replaceDetectedItem\(item\.id, pendingFood, grams\)/);
assert.doesNotMatch(search, /applySearchResult|startBarcodeScan|setCapturedPhoto/);
console.log('PASS: correction protocol, legacy rejection, replacement isolation, save/route guards, 1-12 ingredient sums, no silent missing values, free lookup repair.');
