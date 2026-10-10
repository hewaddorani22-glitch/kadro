/**
 * Offline evaluation of the description analysis pipeline.
 *
 *   node scripts/eval-analysis.mjs [--verbose] [--json] [--strict]
 *
 * Each case pairs a typical German meal description with the structured
 * output a good model answer would contain (following the current prompt).
 * The case then runs through the SHIPPED pure-JS stages: schema validation,
 * description-amount binding, BLS matching and the Edge function's own
 * resolveDetection (loaded from index.ts). USDA is treated as unavailable, so
 * the numbers show what Kandro resolves locally; anything else falls back to
 * the labelled model estimate or an unmatched row.
 *
 * It reports:
 *   - usable rate: a savable result without unmatched rows or an error
 *   - BLS match rate: share of items priced from the BLS reference database
 *   - kcal plausibility: share of meals whose total lies in a realistic range
 *
 * The expected ranges are deliberately broad sanity bounds for evaluation
 * only; they are never shown to users or used as nutrition values.
 * No network, no model call, no provider quota.
 */
import fs from 'node:fs';
import ts from 'typescript';
import * as bls from '../supabase/functions/_shared/bls-reference.mjs';
import { validateDetection } from '../supabase/functions/_shared/detection.mjs';
import { applyDescriptionAmountsTolerant } from '../supabase/functions/_shared/description-amounts.mjs';
import { canonicalFoodQuery } from '../supabase/functions/_shared/food-query.mjs';
import {
  aiEstimateFacts, analysisResultBody, buildAccuracyWarnings, buildMealItem, classifyDetection,
  forEstimateProtocol, incompleteNutritionError, ingredientCorrectionDraft, isUsableSearchTerm,
} from '../supabase/functions/_shared/nutrition.mjs';

const args = new Set(process.argv.slice(2));
globalThis.fetch = async () => { throw new Error('eval-analysis is offline'); };

function loadResolveDetection() {
  const path = new URL('../supabase/functions/nutrition/index.ts', import.meta.url);
  const source = fs.readFileSync(path, 'utf8');
  const ast = ts.createSourceFile('index.ts', source, ts.ScriptTarget.Latest, true);
  const node = ast.statements.find((n) => ts.isFunctionDeclaration(n) && n.name?.text === 'resolveDetection');
  if (!node) throw new Error('resolveDetection not found in index.ts');
  const code = ts.transpileModule(node.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const scope = {
    ...bls, canonicalFoodQuery, isUsableSearchTerm, aiEstimateFacts, analysisResultBody, buildAccuracyWarnings,
    buildMealItem, classifyDetection, incompleteNutritionError, ingredientCorrectionDraft,
    // Offline: no USDA answer for any term. The cache/network path is covered
    // by the runtime validators; this eval measures local resolution.
    resolveFacts: async () => new Map(),
  };
  return new Function(...Object.keys(scope), `${code}\nreturn resolveDetection;`)(...Object.values(scope));
}

/** One mocked model item. per100 = [kcal, protein, carbs, fat] model estimate. */
function it(name, searchTermEn, grams, per100, options = {}) {
  const spread = options.spread ?? 0.2;
  const round = (value) => Math.round(value * 10) / 10;
  return {
    name, searchTermEn, referenceKey: options.key ?? 'other',
    estimatedGrams: grams,
    estimatedGramsLow: options.exact ? grams : round(grams * (1 - spread)),
    estimatedGramsHigh: options.exact ? grams : round(grams * (1 + spread)),
    preparation: options.prep ?? 'unknown', hiddenCaloriesRisk: options.hidden ?? 'low',
    confidence: options.confidence ?? 'medium', optional: false,
    pieceCount: options.pieces ?? null, pieceLabel: options.pieces ? (options.pieceLabel ?? `1 ${name}`) : null,
    estimatedPer100g: { calories: per100[0], protein: per100[1], carbs: per100[2], fat: per100[3] },
  };
}
const meal = (title, items, confidence = 'medium') => ({ title, clarity: 'clear', dishCount: 1, confidence, items });

/** [description, mocked model answer, plausible kcal range] */
const CASES = [
  ['Döner mit allem', meal('Döner Kebab', [it('Döner Kebab', 'doner kebab in bread', 400, [200, 11, 20, 8], { key: 'doner_beef' })]), [550, 950]],
  ['Dürüm Hähnchen', meal('Dürüm mit Hähnchen', [it('Dürüm mit Hähnchen', 'chicken doner wrap', 450, [190, 11, 19, 7.5])]), [650, 1050]],
  ['2 Brezeln mit Butter', meal('Butterbrezeln', [it('Laugenbrezel', 'pretzel', 170, [270, 8, 55, 2], { pieces: 2, pieceLabel: '1 Brezel', prep: 'baked' }), it('Butter', 'butter', 20, [740, 0.7, 0.6, 83])]), [500, 750]],
  ['Mensa Schnitzel mit Pommes', meal('Schnitzel mit Pommes', [it('Schweineschnitzel paniert', 'breaded pork schnitzel fried', 180, [220, 22, 8, 11], { key: 'pork_schnitzel_breaded', prep: 'fried' }), it('Pommes frites', 'French fries', 200, [240, 3, 30, 12], { prep: 'fried', hidden: 'medium' })]), [700, 1100]],
  ['Skyr mit Beeren 250 g', meal('Skyr mit Beeren', [it('Skyr', 'skyr', 250, [63, 11, 4, 0.2]), it('Beeren', 'mixed berries raw', 80, [45, 1, 8, 0.4])]), [150, 320]],
  ['Currywurst mit Pommes', meal('Currywurst mit Pommes', [it('Currywurst mit Pommes', 'currywurst with french fries', 450, [215, 7, 17, 13], { key: 'currywurst_pommes' })]), [800, 1150]],
  ['Leberkässemmel mit Senf', meal('Leberkässemmel', [it('Leberkäse', 'bavarian meat loaf', 120, [300, 12, 1, 27], { prep: 'baked' }), it('Brötchen', 'wheat roll', 60, [280, 9, 55, 1.5]), it('Senf', 'mustard', 10, [90, 6, 6, 4])]), [450, 650]],
  ['Käsespätzle', meal('Käsespätzle', [it('Käsespätzle', 'cheese spaetzle', 400, [160, 8, 17, 6], { key: 'kaesespaetzle' })]), [500, 900]],
  ['5 Maultaschen in Brühe', meal('Maultaschen in Brühe', [it('Maultaschen', 'maultaschen pasta pockets', 325, [130, 10, 8, 6], { key: 'maultaschen_cooked', pieces: 5, pieceLabel: '1 Maultasche' }), it('Brühe', 'beef broth', 250, [5, 0.5, 0.3, 0.2])]), [350, 650]],
  ['Spaghetti Bolognese', meal('Spaghetti Bolognese', [it('Spaghetti Bolognese', 'spaghetti bolognese', 450, [165, 8, 14, 8], { key: 'pasta_bolognese' })]), [550, 950]],
  ['Pizza Margherita', meal('Pizza Margherita', [it('Pizza Margherita', 'pizza margherita', 350, [240, 8, 20, 13], { key: 'pizza_margherita' })]), [650, 1100]],
  ['Bowl mit Reis, Hähnchen, Avocado und Edamame', meal('Bowl', [
    it('Reis', 'white rice cooked', 150, [130, 2.7, 28, 0.3], { prep: 'boiled' }), it('Hähnchenbrust gegrillt', 'chicken breast grilled', 120, [150, 30, 0, 3], { prep: 'grilled' }),
    it('Avocado', 'avocado raw', 50, [160, 2, 2, 15], { prep: 'raw' }), it('Edamame', 'edamame', 50, [120, 11, 9, 5], { prep: 'boiled' }), it('Dressing', 'sesame dressing', 20, [400, 1, 10, 40], { hidden: 'high' })]), [500, 850]],
  ['Müsli mit Milch', meal('Müsli mit Milch', [it('Müsli', 'muesli', 60, [370, 10, 62, 7]), it('Milch', 'whole milk', 200, [64, 3.3, 4.8, 3.6])]), [300, 480]],
  ['Haferflocken 80 g mit 200 ml Milch', meal('Haferflocken mit Milch', [it('Haferflocken', 'oat flakes', 80, [370, 13, 59, 7], { exact: true }), it('Milch', 'whole milk', 206, [64, 3.3, 4.8, 3.6])]), [350, 500]],
  ['Ein Apfel', meal('Apfel', [it('Apfel', 'apple raw', 165, [54, 0.3, 14, 0.2], { prep: 'raw', pieces: 1, pieceLabel: '1 Apfel' })]), [60, 140]],
  ['Banane', meal('Banane', [it('Banane', 'banana raw', 120, [89, 1.1, 23, 0.3], { prep: 'raw', pieces: 1, pieceLabel: '1 Banane' })]), [70, 140]],
  ['2 Spiegeleier mit Brot', meal('Spiegeleier mit Brot', [it('Spiegeleier', 'fried eggs', 110, [200, 13, 0.5, 16], { key: 'fried_egg', prep: 'fried', pieces: 2, pieceLabel: '1 Spiegelei' }), it('Vollkornbrot', 'wholemeal bread', 50, [220, 8, 40, 2], { pieces: 1, pieceLabel: '1 Scheibe' })]), [280, 450]],
  ['Rührei aus 3 Eiern', meal('Rührei', [it('Rührei', 'scrambled eggs', 180, [200, 13, 1, 16], { key: 'scrambled_eggs', prep: 'fried' })]), [250, 450]],
  ['Gulasch mit Nudeln', meal('Gulasch mit Nudeln', [it('Rindergulasch (angenommen)', 'beef goulash', 300, [125, 13, 4, 6], { key: 'goulash_beef' }), it('Nudeln', 'egg noodles cooked', 200, [130, 5, 25, 1.5], { prep: 'boiled' })]), [500, 850]],
  ['Linsensuppe mit Würstchen', meal('Linsensuppe mit Würstchen', [it('Linsensuppe mit Würstchen', 'lentil soup with sausage', 500, [115, 6, 9, 5.5], { key: 'lentil_soup_sausage' })]), [400, 750]],
  ['Kartoffelsalat mit Bratwurst', meal('Bratwurst mit Kartoffelsalat', [it('Bratwurst mit Kartoffelsalat', 'bratwurst with potato salad', 450, [190, 6, 6.5, 15], { key: 'bratwurst_potato_salad' })]), [650, 1050]],
  ['Schweinebraten mit 2 Knödeln und Soße', meal('Schweinebraten mit Knödeln', [it('Schweinebraten', 'pork roast', 180, [200, 27, 0, 10], { prep: 'baked' }), it('Kartoffelknödel', 'potato dumplings', 160, [100, 2, 22, 0.3], { pieces: 2, pieceLabel: '1 Knödel' }), it('Bratensoße', 'gravy', 80, [60, 2, 5, 3.5], { hidden: 'high' })]), [550, 950]],
  ['Sushi 8 Stück', meal('Sushi', [it('Lachs-Sushi', 'salmon sushi', 240, [130, 7, 17, 3], { key: 'salmon_sushi', pieces: 8, pieceLabel: '1 Sushi' })]), [250, 480]],
  ['Cheeseburger mit Pommes und Cola', meal('Cheeseburger-Menü', [it('Cheeseburger', 'cheeseburger', 250, [200, 10.5, 18, 9], { key: 'cheeseburger' }), it('Pommes frites', 'French fries', 150, [240, 3, 30, 12], { prep: 'fried' }), it('Cola', 'cola', 343, [42, 0, 10.6, 0])]), [850, 1300]],
  ['Ein Glas Apfelschorle', meal('Apfelschorle', [it('Apfelschorle', 'apple juice spritzer', 250, [24, 0.1, 5.5, 0.1])]), [30, 130]],
  ['Cappuccino', meal('Cappuccino', [it('Cappuccino', 'cappuccino', 200, [40, 2.2, 3.3, 2])]), [40, 160]],
  ['Flasche Bier 0,5 l', meal('Bier', [it('Bier', 'beer', 505, [43, 0.5, 3, 0])]), [170, 270]],
  ['Gyros mit Pommes und Tzatziki', meal('Gyros mit Pommes', [it('Gyros', 'pork gyros fried', 250, [230, 24, 0.5, 14.5], { key: 'gyros', prep: 'fried' }), it('Pommes frites', 'French fries', 200, [240, 3, 30, 12], { prep: 'fried' }), it('Tzatziki', 'tzatziki', 60, [120, 4, 4, 10])]), [900, 1400]],
  ['Falafel Wrap', meal('Falafel-Wrap', [it('Falafel-Wrap', 'falafel wrap', 400, [155, 5.4, 14, 7.8], { key: 'falafel_wrap' })]), [450, 850]],
  ['Kartoffelpuffer mit Apfelmus', meal('Kartoffelpuffer mit Apfelmus', [it('Kartoffelpuffer', 'potato pancakes fried', 300, [205, 4, 18, 12.5], { key: 'potato_pancakes', prep: 'fried' }), it('Apfelmus', 'applesauce', 100, [75, 0.2, 18, 0.1])]), [550, 900]],
  ['Milchreis mit Zimt und Zucker', meal('Milchreis', [it('Milchreis mit Zimt und Zucker', 'rice pudding with cinnamon sugar', 400, [140, 5, 23, 3], { key: 'milk_rice_cinnamon' })]), [400, 750]],
  ['2 Pfannkuchen mit Nutella', meal('Pfannkuchen mit Nutella', [it('Pfannkuchen', 'pancakes', 200, [210, 8.7, 31.6, 5], { key: 'pancakes', pieces: 2, pieceLabel: '1 Pfannkuchen', prep: 'fried' }), it('Nutella', 'chocolate hazelnut spread', 30, [540, 6, 57, 31])]), [450, 750]],
  ['150 g Joghurt 3,5 % mit Honig', meal('Joghurt mit Honig', [it('Naturjoghurt 3,5 %', 'plain yogurt 3.5% fat', 150, [66, 3.5, 4.5, 3.5], { exact: true }), it('Honig', 'honey', 20, [320, 0.4, 80, 0])]), [140, 260]],
  ['Salat mit Hähnchenbrust', meal('Salat mit Hähnchen', [it('Blattsalat', 'mixed salad greens raw', 150, [18, 1.4, 2, 0.3], { prep: 'raw' }), it('Hähnchenbrust gegrillt', 'chicken breast grilled', 120, [150, 30, 0, 3], { prep: 'grilled' }), it('Dressing', 'vinaigrette dressing', 30, [300, 1, 8, 30], { hidden: 'high' })]), [250, 480]],
  ['Lachs mit Brokkoli und Kartoffeln', meal('Lachs mit Brokkoli und Kartoffeln', [it('Lachsfilet', 'salmon fillet baked', 150, [200, 22, 0, 12], { prep: 'baked' }), it('Brokkoli', 'broccoli boiled', 150, [35, 3, 4, 0.4], { prep: 'boiled' }), it('Salzkartoffeln', 'potatoes boiled', 200, [72, 2, 15.6, 0.1], { prep: 'boiled' })]), [450, 750]],
  ['Chili con Carne mit Reis', meal('Chili con Carne mit Reis', [it('Chili con Carne', 'chili con carne', 400, [158, 10, 9, 8], { key: 'chili_con_carne' }), it('Reis', 'white rice cooked', 150, [130, 2.7, 28, 0.3], { prep: 'boiled' })]), [650, 1050]],
  ['Brötchen mit Käse und Butter', meal('Käsebrötchen', [it('Brötchen', 'wheat roll', 60, [280, 9, 55, 1.5], { pieces: 1, pieceLabel: '1 Brötchen' }), it('Gouda', 'gouda cheese', 30, [356, 25, 0, 28]), it('Butter', 'butter', 10, [740, 0.7, 0.6, 83])]), [280, 450]],
  ['Croissant und Kaffee', meal('Croissant und Kaffee', [it('Croissant', 'croissant', 60, [406, 8, 46, 21], { pieces: 1, pieceLabel: '1 Croissant', prep: 'baked' }), it('Kaffee schwarz', 'coffee brewed', 200, [2, 0.1, 0, 0])]), [180, 340]],
  ['Wiener Würstchen mit Kartoffelsalat', meal('Würstchen mit Kartoffelsalat', [it('Wiener Würstchen', 'frankfurter sausage', 100, [260, 13, 1, 23], { pieces: 2, pieceLabel: '1 Würstchen' }), it('Kartoffelsalat mit Mayonnaise', 'potato salad with mayonnaise', 250, [180, 2, 12, 14], { hidden: 'high' })]), [550, 900]],
  ['Apfelstrudel mit Vanillesoße', meal('Apfelstrudel mit Vanillesoße', [it('Apfelstrudel', 'apple strudel', 180, [220, 3.3, 30, 8.6], { key: 'apple_strudel', prep: 'baked' }), it('Vanillesoße', 'vanilla sauce', 80, [110, 3, 15, 4])]), [380, 650]],
  ['Ein Berliner', meal('Berliner', [it('Berliner', 'jelly doughnut', 75, [330, 6, 44, 14], { key: 'berliner_jam', pieces: 1, pieceLabel: '1 Berliner', prep: 'fried' })]), [200, 330]],
  ['5 Fischstäbchen mit Kartoffelpüree', meal('Fischstäbchen mit Püree', [it('Fischstäbchen', 'fish fingers baked', 150, [205, 14, 16, 9], { key: 'fish_fingers_oven', pieces: 5, pieceLabel: '1 Fischstäbchen', prep: 'baked' }), it('Kartoffelpüree', 'mashed potatoes', 200, [96, 2, 13, 4])]), [400, 650]],
  ['Nudeln mit Tomatensoße und Parmesan', meal('Nudeln mit Tomatensoße', [it('Nudeln', 'pasta cooked', 250, [150, 5, 30, 1], { prep: 'boiled' }), it('Tomatensoße', 'tomato sauce', 120, [50, 1.5, 7, 1.8]), it('Parmesan', 'parmesan', 15, [390, 35, 0, 28])]), [450, 750]],
  ['Porridge mit Banane', meal('Porridge mit Banane', [it('Porridge mit Milch', 'porridge with milk', 350, [134, 6, 15, 5], { key: 'porridge_milk', prep: 'boiled' }), it('Banane', 'banana raw', 60, [89, 1.1, 23, 0.3], { prep: 'raw' })]), [400, 650]],
  ['Spätzle mit Rahmsoße', meal('Spätzle mit Rahmsoße', [it('Spätzle', 'egg noodles cooked', 250, [140, 5.5, 25, 2], { prep: 'boiled' }), it('Rahmsoße', 'cream sauce', 100, [130, 1.5, 5, 11], { hidden: 'high' })]), [420, 750]],
  ['Wasser 500 ml', meal('Wasser', [it('Wasser', 'drinking water', 500, [0, 0, 0, 0], { confidence: 'high' })]), [0, 5]],
  ['200 g Hähnchenbrust gegrillt mit 150 g Reis gekocht', meal('Hähnchen mit Reis', [it('Hähnchenbrust gegrillt', 'chicken breast grilled', 200, [150, 30, 0, 3], { prep: 'grilled', exact: true }), it('Reis gekocht', 'white rice cooked', 150, [130, 2.7, 28, 0.3], { prep: 'boiled', exact: true })]), [420, 520]],
  ['Mensa: Gemüselasagne, Salat und Pudding', meal('Mensa-Tablett', [it('Gemüselasagne', 'vegetable lasagna', 350, [120, 5, 12, 6], { prep: 'baked' }), it('Beilagensalat', 'mixed salad greens raw', 80, [18, 1.4, 2, 0.3], { prep: 'raw' }), it('Dressing', 'salad dressing', 20, [300, 1, 8, 30], { hidden: 'high' }), it('Vanillepudding', 'vanilla pudding', 125, [105, 3, 17, 3])]), [500, 850]],
];

const resolveDetection = loadResolveDetection();
const rows = [];
for (const [description, detection, [low, high]] of CASES) {
  validateDetection(structuredClone(detection));
  let result;
  try {
    const bound = applyDescriptionAmountsTolerant(forEstimateProtocol(structuredClone(detection), { estimates: 1 }), description);
    result = await resolveDetection(bound, {}, 'text', undefined, 1);
  } catch (error) {
    result = { status: 500, body: { code: error instanceof Error ? error.message : 'error' } };
  }
  const items = Array.isArray(result.body.items) ? result.body.items : [];
  const included = items.filter((entry) => entry.included);
  const kcal = included.reduce((sum, entry) => sum + entry.calories, 0);
  const sources = items.map((entry) => entry.source?.code === 'unmatched' ? 'unmatched'
    : entry.source?.provider === 'bls' ? 'bls'
      : entry.source?.referenceId === 'ai-estimate' ? 'estimate' : entry.source?.provider ?? 'none');
  const usable = result.status === 200 && items.length > 0 && !sources.includes('unmatched');
  rows.push({ description, status: result.status, code: result.body.code, usable, kcal, low, high, plausible: usable && kcal >= low && kcal <= high,
    estimatedPortion: result.body.estimatedPortion === true, sources, warnings: result.body.warnings ?? [] });
}

const itemsTotal = rows.reduce((sum, row) => sum + row.sources.length, 0);
const count = (kind) => rows.reduce((sum, row) => sum + row.sources.filter((source) => source === kind).length, 0);
const share = (value, total) => (total ? Math.round((value / total) * 1000) / 10 : 0);
const summary = {
  cases: rows.length,
  usableRate: share(rows.filter((row) => row.usable).length, rows.length),
  kcalPlausibleRate: share(rows.filter((row) => row.plausible).length, rows.length),
  items: itemsTotal,
  blsMatchRate: share(count('bls'), itemsTotal),
  modelEstimateRate: share(count('estimate'), itemsTotal),
  unmatchedRate: share(count('unmatched'), itemsTotal),
  amountFallbackCases: rows.filter((row) => row.estimatedPortion).length,
};

if (args.has('--json')) {
  console.log(JSON.stringify({ summary, rows }, null, 2));
} else {
  for (const row of rows) {
    if (!args.has('--verbose') && row.plausible) continue;
    const mark = row.plausible ? 'ok  ' : row.usable ? 'kcal' : 'FAIL';
    console.log(`${mark} ${row.description.padEnd(52)} ${String(row.kcal).padStart(5)} kcal [${row.low}-${row.high}] ${row.sources.join(',')}${row.code ? ' ' + row.code : ''}${row.estimatedPortion ? ' (portion estimated)' : ''}`);
  }
  console.log(`\n${summary.cases} cases · usable ${summary.usableRate}% · kcal plausible ${summary.kcalPlausibleRate}%`);
  console.log(`${summary.items} items · BLS ${summary.blsMatchRate}% · model estimate ${summary.modelEstimateRate}% · unmatched ${summary.unmatchedRate}% (USDA offline)`);
  console.log(`${summary.amountFallbackCases} case(s) kept the model's grams because a stated amount could not be bound safely.`);
}

if (args.has('--strict') && (summary.usableRate < 95 || summary.kcalPlausibleRate < 90)) {
  console.error('eval-analysis: below the strict thresholds (usable >= 95 %, plausible >= 90 %)');
  process.exit(1);
}
