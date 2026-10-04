import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {resolveBlsFacts} from '../supabase/functions/_shared/bls-reference.mjs';
import {buildAccuracyWarnings} from '../supabase/functions/_shared/nutrition.mjs';

// An optional absolute source path permits a reproducible red run against a
// preserved release candidate. This suite performs no network/model calls.
const {descriptionAmounts, applyDescriptionAmounts} = await import(process.argv[2]
  ? pathToFileURL(process.argv[2]).href
  : '../supabase/functions/_shared/description-amounts.mjs');
globalThis.fetch = async () => { throw new Error('TEST_EXTERNAL_HTTP_BLOCKED'); };
const item = (name, grams=90) => ({name, searchTermEn:name, referenceKey:'other', estimatedGrams:grams, estimatedGramsLow:grams-10, estimatedGramsHigh:grams+10, preparation:'unknown', hiddenCaloriesRisk:'low', confidence:'medium', optional:false, pieceCount:null, pieceLabel:null});
const meal = names => ({title:'Synthetic description regression', clarity:'clear', dishCount:1, confidence:'medium', items:names.map(name=>item(name))});
let passed=0, failed=0;
const test = (name, fn) => {
  try { fn(); passed++; console.log('PASS',name); }
  catch(error) { failed++; console.error('FAIL',name,error.message); }
};

for (const separator of [' mit ', ' with ', ' plus ', ' + ', '+', ',']) {
  test(`individually weighed foods separated by ${JSON.stringify(separator)}`, () => {
    const text=`100 g Reis${separator}150 g Hähnchen und 10 g Olivenöl`;
    const result=applyDescriptionAmounts(meal(['Hähnchen','Olivenöl','Reis']),text);
    assert.deepEqual(result.items.map(row=>row.estimatedGrams),[150,10,100]);
    assert.equal(result.items.length,3);
  });
}
test('decimal comma and adjacent food comma remain distinct', () => {
  const text='100,5 g Haferflocken,150 g Naturjoghurt und 50 g Banane';
  assert.deepEqual(applyDescriptionAmounts(meal(['Banane','Naturjoghurt','Haferflocken']),text).items.map(row=>row.estimatedGrams),[50,150,100.5]);
});
for (const [text, grams] of [['1/2 kg Reis',500], ['½ kg Reis',500], ['1½ kg Reis',1500], ['1 1/2 kg Reis',1500], ['3/4 lb rice',340.2], ['½ l Milch',515], ['0.125 kg rice',125], ['0,125 kg Reis',125], ['0.750 l milk',772.5], ['2 Portionen à 100 g Reis',200], ['2 portions of 100 g rice',200], ['2 servings each of 100 g oats',200], ['2 x 150 g Skyr',300]]) {
  test(`complete explicit quantity: ${text}`, () => assert.equal(descriptionAmounts(text)[0].grams,grams));
}
for (const text of ['−100 g Reis','–100 g Reis','100–150 g Reis','100 to 150 g rice','100 bis 150 g Reis','100 or 200 g rice','1e3 g oats','1..2 kg Reis','1//2 kg Reis','1/0 kg Reis','1.000 g Reis','1,000 g rice','1 000 g Reis','50% von 200 g Reis','half of 200 g rice']) {
  test(`no silent partial quantity: ${text}`, () => assert.throws(()=>descriptionAmounts(text), /amount_(?:ambiguous|out_of_range)/));
}
for (const text of ['100 g Reis und ohne 10 g Öl', '100 g rice without 10 g olive oil', '100 g rice and no 10 g olive oil']) {
  test(`explicitly excluded weight does not become an ingredient: ${text}`, () => {
    const sourceName=text.includes('Reis')?'Reis':'rice';
    const result=applyDescriptionAmounts(meal([sourceName]),text);
    assert.equal(result.items.length,1);
    assert.equal(result.items[0].estimatedGrams,100);
  });
}
for (const text of ['100g rice without 10g oil and 50g chicken','100g rice without10g oil and50g chicken','100g Reis ohne10g Öl und50g Hähnchen']) {
  test(`an exclusion leaves a following separate food intact: ${text}`, () => {
    assert.deepEqual(descriptionAmounts(text).map(row=>row.grams),[100,50]);
  });
}
test('ambiguous shared weight and unsupported density remain blocked', () => {
  for (const text of ['100 g Reis mit Hähnchen','100 g oats with milk','rice and chicken, 300 g in total','100 g Reis + Hähnchen','100 g rice or chicken']) assert.throws(()=>descriptionAmounts(text), /amount_ambiguous/);
  for (const text of ['200 ml Hafermilch', '200 ml Öl', '200 ml Milch mit Honig']) assert.throws(()=>descriptionAmounts(text), /mass_required/);
});
test('source-specific weighted identity cannot vanish; unresolved is never a made-up match', () => {
  const result=applyDescriptionAmounts(meal(['rice']), '100 g rice and 40 g zintscjenxken');
  assert.deepEqual(result.items.map(row=>[row.name,row.estimatedGrams]),[['rice',100],['zintscjenxken',40]]);
  assert.equal(result.items[1].searchTermEn,'unknown');
  assert.equal(result.items[1].referenceKey,'other');
});
test('existing counted total and milk density/fat protection remain intact', () => {
  const eggs=applyDescriptionAmounts(meal(['gekochte Eier']), '2 gekochte Eier, zusammen 110 g');
  assert.equal(eggs.items.length,1); assert.equal(eggs.items[0].estimatedGrams,110);
  const milk=applyDescriptionAmounts(meal(['Milch 1,5% Fett']), '200 ml Milch mit 1,5 % Fett').items[0];
  assert.equal(milk.estimatedGrams,206); assert.equal(milk.estimatedGramsLow,204); assert.equal(milk.estimatedGramsHigh,210); assert.equal(milk.milkVolumeEstimated,true);
  const wrong=applyDescriptionAmounts(meal(['whole milk']), '200 ml Magermilch').items;
  assert.equal(wrong.length,1); assert.equal(wrong[0].searchTermEn,'unknown');
});
test('captured Azure chicken wording binds once instead of duplicating the explicit constituent', () => {
  // Captured 2026-10-03: source names/queries and model portion ranges retained.
  const raw={...meal([]),title:'Reis mit Hähnchen und Olivenöl',items:[
    {...item('Reis gekocht',100),searchTermEn:'rice cooked',preparation:'boiled'},
    {...item('Hähnchenfleisch gebraten',150),searchTermEn:'chicken meat cooked',estimatedGramsLow:130,estimatedGramsHigh:170,preparation:'fried'},
    {...item('Olivenöl',10),searchTermEn:'olive oil',estimatedGramsLow:10,estimatedGramsHigh:10,preparation:'raw'},
  ]};
  const result=applyDescriptionAmounts(raw,'100 g Reis mit 150 g Hähnchen und 10 g Olivenöl');
  assert.equal(result.items.length,3);
  assert.deepEqual(result.items.map(row=>row.estimatedGramsLow),[100,150,10]);
  assert.equal(result.items[1].name,'Hähnchenfleisch gebraten');
  assert.equal(result.items[1].preparation,'fried');
});
test('chicken aliases retain conflicting cuts, explicit preparation and multiple-row ambiguity', () => {
  for (const [text,name,query,preparation] of [
    ['150 g Hähnchenbrust','Hähnchenkeule','chicken thigh','fried'],
    ['150 g Hähnchen','Hähnchensuppe','chicken noodle soup','boiled'],
    ['150 g raw chicken','fried chicken','chicken','fried'],
    ['150 g rohes Hähnchen','Hähnchenfleisch gebraten','chicken','fried'],
  ]) {
    const result=applyDescriptionAmounts({...meal([]),items:[{...item(name),searchTermEn:query,preparation}]},text);
    assert.equal(result.items[0].estimatedGrams,90);
    assert.equal(result.items[1].searchTermEn,'unknown');
  }
  assert.throws(()=>applyDescriptionAmounts(meal(['Hähnchenfleisch','chicken meat']),'150 g Hähnchen'),/amount_ambiguous/);
});
test('captured Azure exclusion removes the contradictory separate oil row and stale title', () => {
  const raw={...meal([]),title:'Rice with Olive Oil',items:[
    {...item('cooked rice',100),searchTermEn:'rice cooked',estimatedGramsLow:95,estimatedGramsHigh:105,preparation:'boiled'},
    {...item('olive oil',10),estimatedGramsLow:9,estimatedGramsHigh:11,preparation:'raw'},
  ]};
  const result=applyDescriptionAmounts(raw,'100 g rice without 10 g olive oil');
  assert.deepEqual(result.items.map(row=>[row.name,row.estimatedGrams]),[['cooked rice',100]]);
  assert.equal(result.title,'cooked rice');
  assert.equal(raw.items.length,2);
});
test('exclusion removal is complete identity only, with positive/duplicate ambiguity guarded', () => {
  const product=applyDescriptionAmounts(meal(['yogurt without sugar','sugar']), '100 g yogurt without sugar');
  assert.deepEqual(product.items.map(row=>row.name),['yogurt without sugar']);
  const compound=applyDescriptionAmounts({...meal(['rice']),items:[item('rice'),{...item('olive oil dressing'),searchTermEn:'olive oil'}]}, '100 g rice without 10 g olive oil');
  assert.deepEqual(compound.items.map(row=>row.name),['rice','olive oil dressing']);
  assert.throws(()=>applyDescriptionAmounts(meal(['rice','olive oil','Olivenöl']), '100 g rice without 10 g olive oil'), /amount_ambiguous/);
  assert.throws(()=>applyDescriptionAmounts(meal(['rice','olive oil']), '10 g olive oil and 100 g rice without 10 g olive oil'), /amount_ambiguous/);
  assert.throws(()=>applyDescriptionAmounts(meal(['rice','olive oil']), 'olive oil and 100 g rice without 10 g olive oil'), /amount_ambiguous/);
});
test('captured omitted olive oil recovers only its exact existing BLS identity and stated amount', () => {
  const raw={...meal([]),title:'Reis mit Hähnchen und Olivenöl',items:[
    {...item('Reis',100),searchTermEn:'rice white cooked',estimatedGramsLow:90,estimatedGramsHigh:110,preparation:'boiled'},
    {...item('Hähnchen',150),searchTermEn:'chicken breast cooked',estimatedGramsLow:130,estimatedGramsHigh:170,preparation:'grilled'},
  ]};
  const result=applyDescriptionAmounts(raw,'100 g Reis mit 150 g Hähnchen und 10 g Olivenöl');
  assert.equal(result.items.length,3);
  const oil=result.items[2];
  assert.equal(oil.name,'Olivenöl'); assert.equal(oil.estimatedGrams,10); assert.equal(oil.confidence,'medium');
  assert.equal(oil.searchTermEn,'Olive oil'); assert.equal(oil.referenceKey,'other');
  const facts=resolveBlsFacts(oil);
  assert.equal(facts.referenceId,'Q120000'); assert.equal(facts.calories,899);
  assert.equal(raw.items.length,2);
});
test('exact omission recovery never guesses generic, typo, family aliases or conflicts', () => {
  for (const name of ['zintscjenxken','milk','rice','chicken','crispy muesli','olive oil dressing']) {
    const result=applyDescriptionAmounts(meal(['banana']),`10 g ${name}`);
    assert.equal(result.items[1].searchTermEn,'unknown',name);
  }
  const conflicting=applyDescriptionAmounts(meal(['brown rice boiled']), '100 g white rice boiled');
  assert.equal(conflicting.items[1].searchTermEn,'unknown');
  assert.equal(conflicting.items[0].estimatedGrams,90);
});
test('household or approximate positive oil mention cannot be globally removed by a later exclusion', () => {
  for (const included of ['1 tbsp olive oil','some olive oil','olive oil 1 tbsp']) {
    for (const text of [`${included} and 100 g rice without 10 g olive oil`,`100 g rice without 10 g olive oil and ${included}`]) {
      assert.throws(()=>applyDescriptionAmounts(meal(['rice','olive oil']),text),/amount_ambiguous/,text);
    }
  }
});
test('pure chicken with preparation or cut stays distinct from soup; explicit soup remains usable', () => {
  const soup={...item('chicken soup'),searchTermEn:'chicken soup cooked',preparation:'boiled'};
  for (const text of ['150 g gekochtes Hähnchen','150 g Hähnchenfleisch gekocht','150 g cooked chicken breast']) {
    const result=applyDescriptionAmounts({...meal([]),items:[soup]},text);
    assert.equal(result.items[0].estimatedGrams,90,text);
    assert.equal(result.items[1].searchTermEn,'unknown',text);
  }
  const actualSoup=applyDescriptionAmounts({...meal([]),items:[soup]},'150 g cooked chicken soup');
  assert.equal(actualSoup.items.length,1); assert.equal(actualSoup.items[0].estimatedGrams,150);
});
test('food between stated count and per-piece mass preserves the full quantity', () => {
  for (const text of ['2 Portionen Reis à 100 g','2 Portionen Reis je 100 g','2 portions of rice, 100 g each']) {
    const result=applyDescriptionAmounts({...meal([]),items:[{...item('Reis'),searchTermEn:'rice',pieceCount:1,pieceLabel:'1 Portion'}]},text);
    assert.equal(result.items.length,1,text); assert.equal(result.items[0].estimatedGrams,200,text);
    assert.equal(result.items[0].pieceCount,2,text); assert.equal(result.items[0].pieceLabel,'1 Portion');
  }
});
test('each multiplies a unique counted food; total is never multiplied', () => {
  for (const [text,grams] of [['2 eggs, 60 g each',120],['2 Eier je 60 g',120],['2 eggs, 120 g in total',120]]) {
    const result=applyDescriptionAmounts({...meal([]),items:[{...item('egg'),pieceCount:1,pieceLabel:'1 egg'}]},text);
    assert.equal(result.items.length,1,text); assert.equal(result.items[0].estimatedGrams,grams,text);
    assert.equal(result.items[0].pieceCount,2,text);
  }
  const withoutUnit=applyDescriptionAmounts(meal(['egg']),'2 eggs, 60 g each').items[0];
  assert.equal(withoutUnit.estimatedGrams,120); assert.equal(withoutUnit.pieceCount,null); assert.equal(withoutUnit.pieceLabel,null);
  for (const text of ['rice and chicken, 100 g each','2 eggs and 1 roll, 60 g each','100 g each','2 Portionen à 100 g','2 eggs je 2 × 30 g']) assert.throws(()=>descriptionAmounts(text),/amount_ambiguous/,text);
});
test('ampersand separates only individually quantified foods', () => {
  const result=applyDescriptionAmounts(meal(['Hähnchen','Reis']),'100 g Reis & 150 g Hähnchen');
  assert.deepEqual(result.items.map(row=>row.estimatedGrams),[150,100]);
  for (const text of ['100 g Reis & Hähnchen','rice & chicken, 200 g in total']) assert.throws(()=>descriptionAmounts(text),/amount_ambiguous/,text);
});
test('captured weighed olive oil has no hidden-amount warning; the original detection stays untouched', () => {
  // Saved after-fix de-rice-with-chicken response: only the explicit olive oil
  // had high hidden-calorie risk, despite its stated ten-gram quantity.
  const raw={...meal([]),title:'Reis mit Hähnchen und Olivenöl',items:[
    {...item('Reis gekocht',100),searchTermEn:'rice cooked',preparation:'boiled',hiddenCaloriesRisk:'low'},
    {...item('Hähnchenfleisch gebraten',150),searchTermEn:'chicken meat cooked',estimatedGramsLow:130,estimatedGramsHigh:170,preparation:'fried',hiddenCaloriesRisk:'medium'},
    {...item('Olivenöl',10),searchTermEn:'olive oil',estimatedGramsLow:10,estimatedGramsHigh:10,preparation:'raw',hiddenCaloriesRisk:'high'},
  ]};
  const before=structuredClone(raw);
  const result=applyDescriptionAmounts(raw,'100 g Reis mit 150 g Hähnchen und 10 g Olivenöl');
  assert.equal(result.items[2].hiddenCaloriesRisk,'low');
  assert.equal(buildAccuracyWarnings(result,result.items).includes('hidden_calories'),false);
  assert.deepEqual(raw,before);
  assert.equal(buildAccuracyWarnings(raw,raw.items).includes('hidden_calories'),true);
});
test('hidden risk remains for unweighed oil, mixtures, unresolved identity, volume and other ingredients', () => {
  const oil={...item('olive oil',10),hiddenCaloriesRisk:'high'};
  assert.equal(applyDescriptionAmounts({...meal([]),items:[oil]},'olive oil').items[0].hiddenCaloriesRisk,'high');
  for (const [name,query] of [['olive oil dressing','olive oil'],['olive oil sauce','olive oil'],['olive oil','unknown']]) {
    const result=applyDescriptionAmounts({...meal([]),items:[{...oil,name,searchTermEn:query}]},'10 g olive oil');
    assert.equal(result.items[0].hiddenCaloriesRisk,'high',name+' / '+query);
  }
  assert.throws(()=>applyDescriptionAmounts({...meal([]),items:[oil]},'10 ml olive oil'),/mass_required/);
  const chicken={...item('chicken',150),hiddenCaloriesRisk:'high',preparation:'fried'};
  const otherRisk=applyDescriptionAmounts({...meal([]),items:[oil,chicken]},'10 g olive oil and 150 g chicken');
  assert.equal(otherRisk.items[0].hiddenCaloriesRisk,'low');
  assert.equal(otherRisk.items[1].hiddenCaloriesRisk,'high');
  assert.equal(buildAccuracyWarnings(otherRisk,otherRisk.items).includes('hidden_calories'),true);
});
console.log(JSON.stringify({passed,failed,scope:'deterministic description amounts only; no model, photo, nutrition or device accuracy claim'}));
if(failed) process.exitCode=1;
