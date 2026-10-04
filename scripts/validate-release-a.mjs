import {compatibleSearchIdentity} from '../supabase/functions/_shared/search-policy.mjs';
import {offMassNutrition,offMassPortions} from '../supabase/functions/_shared/off-product.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { randomUUID } from 'node:crypto';
import { openFoodFactsNutrition } from '../supabase/functions/_shared/nutrition.mjs';
const read = f => fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
const load = (file,mocks) => {
 const module={exports:{}};
 new Function('require','module','exports',ts.transpileModule(read(file),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(id=>{assert.ok(id in mocks,'unmocked '+id);return mocks[id]},module,module.exports);
 return module.exports;
};
const full={'energy-kcal_100g':99.75,proteins_100g:7.25,carbohydrates_100g:9.75,fat_100g:3.5,fiber_100g:1.25};
for(const field of ['energy-kcal_100g','proteins_100g','carbohydrates_100g','fat_100g']){
 for(const invalid of [null,undefined,'',NaN,-1,Infinity])assert.equal(openFoodFactsNutrition({...full,[field]:invalid}),null,field+': '+invalid);
 const missing={...full};delete missing[field];assert.equal(openFoodFactsNutrition(missing),null,field+' missing');
}
assert.equal(openFoodFactsNutrition(null),null);
assert.deepEqual(openFoodFactsNutrition(full),{calories:99.75,protein:7.25,carbs:9.75,fat:3.5,fiber:1.25});
assert.ok(openFoodFactsNutrition({'energy-kcal_100g':0,proteins_100g:0,carbohydrates_100g:0,fat_100g:0}));
assert.equal(openFoodFactsNutrition({...full,'energy-kcal_100g':0}),null);
const kj={...full,'energy-kj_100g':418.4};delete kj['energy-kcal_100g'];
assert.ok(Math.abs(openFoodFactsNutrition(kj).calories-100)<1e-10);
assert.equal(openFoodFactsNutrition({...kj,'energy-kcal_100g':''}),null,'invalid kcal must not be silently masked by kJ');
// Execute the real hosted search adapter against a synthetic provider response.
const source=read('supabase/functions/nutrition/index.ts');
const fn=source.slice(source.indexOf('async function searchOpenFoodFacts('),source.indexOf('async function usdaRows('));
const compiled=ts.transpileModule(fn,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const search=new Function('compatibleSearchIdentity','fetch','offMassNutrition','offMassPortions','openFoodFactsNutrition','localizedProductName',compiled+';return searchOpenFoodFacts;')(
 compatibleSearchIdentity,async()=>({ok:true,json:async()=>({hits:[{code:'0000001',product_name:'Incomplete',nutriments:{'energy-kcal_100g':250}},{code:'0000002',product_name:'Complete',nutriments:full,serving_quantity:12.5,serving_size:'12.5 g'}]})}),offMassNutrition,offMassPortions,openFoodFactsNutrition,p=>p.product_name);
const found=await search('test','en');assert.equal(found.length,1);assert.equal(found[0].id,'off-0000002');assert.equal(found[0].per100g.protein,7.25);assert.equal(found[0].portions[0].grams,12.5);

const personalization=load('src/services/personalization.ts',{'@/i18n/active':{getDictionary:()=>({common:{}})},'@/utils/units':{formatWeeklyRate:String}});
const profile={...personalization.DEFAULT_PROFILE,age:30,sex:'male',heightCm:180,weightKg:80,goal:'gain',activityLevel:'light',weeklyRateKg:0.5};
const plan=personalization.caloriePlan(profile);
assert.equal(plan.maintenance,2447.5);assert.equal(plan.requestedOffset,550);assert.equal(plan.calories,3000);assert.equal(plan.appliedOffset,552.5);
for(const sex of ['female','male','unspecified'])for(const age of [14,17,18,30,75])for(const goal of ['gain','lose','maintain'])for(const rate of [0.25,0.5]){
 const p={...profile,sex,age,goal,weeklyRateKg:rate};const c=personalization.caloriePlan(p);assert.equal(c.calories,personalization.calculateDailyTargets(p).calories);assert.equal(c.appliedOffset,c.calories-c.maintenance);if(age<18)assert.equal(c.requestedOffset,0);
}
assert.match(read('src/app/onboarding.tsx'),/dailyGoalOffset\(draftProfile.goal, rate\)/);
assert.match(read('src/app/onboarding.tsx'),/appliedOffset/);

const values=new Map();
const storage={getItem:async k=>values.get(k)??null,setItem:async(k,v)=>values.set(k,v),removeItem:async k=>values.delete(k),multiRemove:async keys=>keys.forEach(k=>values.delete(k)),multiSet:async pairs=>pairs.forEach(([k,v])=>values.set(k,v))};
const mocks={'@react-native-async-storage/async-storage':{default:storage},'@/services/personalization':{DEFAULT_PROFILE:{},isBiologicalSex:()=>true},'@/utils/date':{localDateKey:()=> '2026-09-25'},'@/utils/units':{defaultUnitSystem:()=> 'metric',isUnitSystem:()=>true},'@/utils/requestId':{isAnalysisRequestId:()=>true,newAnalysisRequestId:randomUUID}};
let local=load('src/services/localRepository.ts',mocks);
const make=(id,kcal=100)=>({id,title:'Synthetic',type:'Lunch',origin:'plan',date:'2026-09-25',calories:kcal,protein:5,carbs:10,fat:4,fiber:1,confidence:'high',items:[{id:'a',name:'Synthetic',amountG:100,baseAmountG:100,portionFactor:1,calories:kcal,protein:5,carbs:10,fat:4,fiber:1,included:true,confidence:'high',source:{provider:'bls',label:'TEST',referenceId:'TEST'},nutritionPer100g:{calories:99.75,protein:4.75,carbs:10.25,fat:3.95,fiber:1.1},portions:[{label:'Serving',grams:25.5}]}]});
const first=(await local.saveMealWithOutcome(make('offline'),'A')).storedMeal;
assert.ok(first.savedAt);assert.equal(first.sync.status,'pending');
local=load('src/services/localRepository.ts',mocks); // JS restart over the same durable storage.
let pending=await local.pendingMealForSync('offline','A');assert.equal(pending.savedAt,first.savedAt);assert.equal(pending.sync.mutationId,first.sync.mutationId);
const edited=(await local.saveMealWithOutcome(make('offline',200),'A')).storedMeal;
await local.acknowledgeMealSync('offline',first.sync.mutationId,4,'A');
pending=(await local.loadAllStoredScans())[0];assert.equal(pending.calories,200);assert.equal(pending.sync.status,'pending');assert.equal(pending.sync.revision,4);
const remote={...first,calories:999,sync:{mealId:first.id,ownerId:'A',revision:5,status:'synced'}};
await local.mergeCloudMealSnapshot([remote],[],'A',local.getLocalDataGeneration());
assert.equal((await local.loadAllStoredScans())[0].calories,200,'remote cannot erase pending local edit');
await local.markMealConflict('offline','A');await assert.rejects(local.pendingMealForSync('offline','A'),/meal_revision_conflict/);
let replacement=await local.resolveLocalMealConflict('offline',remote,true,'A',local.getLocalDataGeneration());assert.equal(replacement.sync.revision,5);assert.equal(replacement.calories,200);
await local.markMealConflict('offline','A');replacement=await local.resolveLocalMealConflict('offline',null,true,'A',local.getLocalDataGeneration());assert.notEqual(replacement.id,'offline','remote deletion only restores as new entry');
await local.deleteMeal(replacement.id,'A');assert.equal(await local.pendingMealForSync(replacement.id,'A'),null);const tombstone=(await local.loadDeletedMeals())[0];assert.equal(tombstone.sync.ownerId,'A');
const restoredRemote={...replacement,sync:{mealId:replacement.id,ownerId:'A',revision:7,status:'synced'}};
await local.mergeCloudMealSnapshot([restoredRemote],[],'A',local.getLocalDataGeneration());
assert.ok(!(await local.loadAllStoredScans()).some(m=>m.id===replacement.id),'pending deletion hides a remote snapshot');
await local.markDeletedMealConflict(replacement.id,'A');
assert.equal((await local.loadDeletedMeals())[0].sync.status,'conflict');
await local.rebaseDeletedMeal(replacement.id,'A',7,local.getLocalDataGeneration());
const rebased=(await local.loadDeletedMeals())[0];assert.equal(rebased.sync.revision,7);assert.notEqual(rebased.sync.mutationId,tombstone.sync.mutationId);
await local.forgetDeletedMeal(replacement.id,'wrong-id','A');assert.equal((await local.loadDeletedMeals()).length,1);
await local.forgetDeletedMeal(replacement.id,rebased.sync.mutationId,'A');assert.equal((await local.loadDeletedMeals()).length,0);
await local.mergeCloudMealSnapshot([restoredRemote],[],'A',local.getLocalDataGeneration());
assert.deepEqual((await local.loadAllStoredScans())[0].items[0].portions,restoredRemote.items[0].portions,'new local copy restores cloud portions');
const legacy=make('legacy');values.set('@kandro/meals:v1',JSON.stringify([legacy]));
const cloudLegacy={...legacy,items:legacy.items.map(({nutritionPer100g,portions,...item})=>item),sync:{mealId:'legacy',ownerId:'A',revision:0,status:'synced'}};
await local.mergeCloudMealSnapshot([cloudLegacy],[],'A',local.getLocalDataGeneration());
const enriched=(await local.loadAllStoredScans())[0];assert.deepEqual(enriched.items[0].nutritionPer100g,legacy.items[0].nutritionPer100g);assert.equal(enriched.sync.status,'pending','legacy metadata survives and is queued for migration');
await assert.rejects(local.pendingMealForSync('legacy','B'),/cloud_identity_changed/);
await local.acknowledgeMealSync('legacy',enriched.sync.mutationId,10,'A');
await local.mergeCloudMealSnapshot([],['legacy'],'A',local.getLocalDataGeneration());assert.equal((await local.loadAllStoredScans()).length,0,'synced remote deletion removes cached entry');
// Upgrade comparison: only the old DB's factor rounding and missing ordering
// may be ignored. Run both untouched pre-sync data and Build 19's already
// flagged legacy conflicts; neither has a pending local mutation.
for (const alreadyFlagged of [false,true]) {
 for (const difference of ['rounding','order','both']) {
  const before=make('legacy-harmless');
  before.items.push({...structuredClone(before.items[0]),id:'b',name:'Second synthetic ingredient'});
  before.items[0].baseAmountG=70;before.items[0].portionFactor=100/70;
  if(alreadyFlagged)before.sync={mealId:before.id,ownerId:'A',revision:1,status:'conflict'};
  const cloudCopy=structuredClone(before);cloudCopy.sync={mealId:before.id,ownerId:'A',revision:3,status:'synced'};
  if(difference!=='order')cloudCopy.items[0].portionFactor=1.429;
  if(difference!=='rounding')cloudCopy.items.reverse();
  const originalOrder=before.items.map(i=>i.id);
  values.set('@kandro/meals:v1',JSON.stringify([before]));
  await local.mergeCloudMealSnapshot([cloudCopy],[],'A',local.getLocalDataGeneration());
  const upgraded=(await local.loadAllStoredScans())[0];
  assert.equal(upgraded.sync.status,'synced',difference+' should not require a conflict choice');
  assert.equal(upgraded.sync.revision,3);assert.equal(upgraded.items.length,2);
  assert.deepEqual(before.items.map(i=>i.id),originalOrder,'comparison must not reorder input');
 }
 for (const [name,change] of [
  ['amount',m=>m.items[0].amountG+=0.1],['base amount',m=>m.items[0].baseAmountG+=0.1],
  ['nutrition',m=>m.items[0].protein+=1],['inclusion',m=>m.items[0].included=false],
  ['removed ingredient',m=>m.items=[]],['source',m=>m.items[0].source.referenceId='OTHER'],
  ['real factor change',m=>m.items[0].portionFactor+=0.01],['title',m=>m.title='Changed'],
 ]) {
  const before=make('legacy-real');if(alreadyFlagged)before.sync={mealId:before.id,ownerId:'A',revision:1,status:'conflict'};
  const changed=structuredClone(before);change(changed);changed.sync={mealId:before.id,ownerId:'A',revision:4,status:'synced'};
  values.set('@kandro/meals:v1',JSON.stringify([before]));
  await local.mergeCloudMealSnapshot([changed],[],'A',local.getLocalDataGeneration());
  const preserved=(await local.loadAllStoredScans())[0];assert.equal(preserved.sync.status,'conflict',name);
  assert.deepEqual(preserved.items,before.items,'real conflict must retain local content');
 }
}
// Reference enrichment must still survive an otherwise harmless order/rounding
// difference and be uploaded using a fresh mutation rather than dropped.
const rich=make('legacy-enrich');rich.items[0].baseAmountG=70;rich.items[0].portionFactor=100/70;
const bare=structuredClone(rich);bare.items[0].portionFactor=1.429;delete bare.items[0].nutritionPer100g;delete bare.items[0].portions;
bare.sync={mealId:bare.id,ownerId:'A',revision:7,status:'synced'};
values.set('@kandro/meals:v1',JSON.stringify([rich]));await local.mergeCloudMealSnapshot([bare],[],'A',local.getLocalDataGeneration());
const migrated=(await local.loadAllStoredScans())[0];assert.equal(migrated.sync.status,'pending');assert.ok(migrated.sync.mutationId);
assert.deepEqual(migrated.items[0].nutritionPer100g,rich.items[0].nutritionPer100g);
for(const status of ['pending','conflict']) {
 const edited=structuredClone(rich);edited.sync={mealId:edited.id,ownerId:'A',revision:7,status,mutationId:randomUUID()};
 values.set('@kandro/meals:v1',JSON.stringify([edited]));await local.mergeCloudMealSnapshot([bare],[],'A',local.getLocalDataGeneration());
 assert.deepEqual((await local.loadAllStoredScans())[0],edited,'a real local mutation must not be auto-resolved');
}
values.set('@kandro/meals:v1','[]');
console.log('25 targeted legacy regressions passed: harmless rounding/order, pre-existing legacy conflicts, real content differences, metadata enrichment and pending-edit protection.');
// Delayed cloud answer must never acknowledge or insert data after a session changes.
await local.saveMealWithOutcome(make('late'),'A');let owner='A', release;
const gate=new Promise(r=>release=r);let started;
const began=new Promise(r=>started=r);
const cloud=load('src/services/cloudRepository.ts',{'./localRepository':local,'./supabaseClient':{isSupabaseConfigured:true,getCurrentSessionUserId:async()=>owner,ensureSupabaseUser:async()=>({id:owner}),supabase:{rpc:async()=>{started();await gate;return {data:{revision:1},error:null}}}},'@/utils/requestId':{newAnalysisRequestId:randomUUID},'@/utils/date':{localDateKey:()=> '2026-09-25'},'@/utils/units':{},'@/services/personalization':{},'@/utils/format':{}});
const inflight=cloud.saveCloudMeal(make('late'));const rejected=assert.rejects(inflight,/cloud_identity_changed/);await began;owner='B';await local.clearLocalKandroData();release();await rejected;assert.equal((await local.loadAllStoredScans()).length,0);
console.log('Release A runtime regressions passed: OFF completeness/precision and real search adapter, target/UI consistency, restart persistence, edit acknowledgements, stale snapshots, conflicts, tombstones, legacy metadata, and delayed A→B response.');
const de=load('src/i18n/de.ts',{}).de,en=load('src/i18n/en.ts',{}).en;
let lang='de';
const helpers=load('src/utils/mealSuggestions.ts',{});
const recipeData=Object.fromEntries(['ingredientNames','ingredients','recipeSteps','recipes'].map(name=>['@/data/'+name+'.json',{default:JSON.parse(read('src/data/'+name+'.json'))}]));
const recipeService=load('src/services/recipes.ts',{...recipeData,'@/i18n/active':{getLanguage:()=>lang,getDictionary:()=>lang==='de'?de:en},'@/utils/mealSuggestions':helpers});
for(lang of ['de','en'])for(const id of Object.keys(recipeData['@/data/recipes.json'].default))for(const portion of [0.7,1,1.4]){
 const recipe=recipeService.getRecipe(id,portion);
 assert.ok(recipe.ingredients.every(i=>i.weighingLabel&&i.referenceState===i.weighingState));
 assert.ok(recipe.steps[0].length>100,'measurement instructions reach the actual recipe flow');
}
const orzo=recipeService.getRecipe('home-16');assert.equal(orzo.ingredients.find(i=>i.key==='chicken-breast').weighingState,'raw');assert.equal(orzo.ingredients.find(i=>i.key==='pasta-cooked').weighingState,'cooked-drained');
assert.equal(recipeService.getRecipe('home-08').ingredients.find(i=>i.key.startsWith('egg')).weighingState,'raw','pancake batter uses raw egg');
assert.equal(recipeService.getRecipe('home-36').ingredients.find(i=>i.key.startsWith('egg')).weighingState,'cooked-peeled','boiled egg is weighed peeled');
console.log('Recipe runtime passed: all 67 recipes in DE/EN at 3 portion factors; raw/cooked Orzo and egg states.');
