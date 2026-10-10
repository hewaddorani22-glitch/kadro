import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {randomUUID,webcrypto} from 'node:crypto';
import {validateDetection} from '../supabase/functions/_shared/detection.mjs';
import {descriptionAmounts,applyDescriptionAmounts} from '../supabase/functions/_shared/description-amounts.mjs';
import {modelRequest,parseStructuredResponse,requestStructured,GEMINI_MODEL,GEMINI_RELEASE_APPROVED,ModelError} from '../supabase/functions/_shared/model-adapter.mjs';
import {validateSearchAssistance,runSearchAssistance} from '../supabase/functions/_shared/search-assistance.mjs';
import {referenceCache} from '../supabase/functions/_shared/reference-cache.mjs';
import {offMassNutrition,offMassPortions} from '../supabase/functions/_shared/off-product.mjs';
import {compatibleSearchIdentity} from '../supabase/functions/_shared/search-policy.mjs';
import {searchBlsCatalog} from '../supabase/functions/_shared/bls-search.mjs';
// Hard process-wide boundary also covers fetch captured by imported modules.
const originalGlobalFetch=globalThis.fetch;
globalThis.fetch=async()=>{throw new Error('TEST_EXTERNAL_HTTP_BLOCKED');};
const item=(name,grams=100)=>({name,searchTermEn:name==='oats'?'oat flakes':name,referenceKey:'other',estimatedGrams:grams,estimatedGramsLow:grams,estimatedGramsHigh:grams,preparation:'raw',hiddenCaloriesRisk:'low',confidence:'medium',optional:false,pieceCount:null,pieceLabel:null});
const meal={title:'Synthetic contract fixture',clarity:'clear',dishCount:1,confidence:'medium',items:[item('olive oil'),item('oats')]};
let count=0; const test=async(name,fn)=>{await fn();count++;console.log('PASS',name);};
await test('full detection validation, precision, ranges, pieces, max 12, no fabricated IDs',()=>{
 validateDetection(meal); for(const edit of [m=>m.items[0].estimatedGrams=NaN,m=>m.items[0].estimatedGramsLow=101,m=>m.items[0].pieceCount=2,m=>m.items[0].referenceKey='invented',m=>m.items[0].calories=99,m=>m.items=Array.from({length:13},()=>item('oats')),m=>m.title='',m=>delete m.items[0].optional,m=>m.items[0].estimatedGrams=100.55]) {const m=structuredClone(meal);edit(m);assert.throws(()=>validateDetection(m),/provider_response_invalid/);}
});
await test('explicit weights follow identities, omitted weighted constituent remains correctable',()=>{
 for(const text of ['100,5 g Haferflocken und 3 g Olivenöl','100.5 g oats and 3 g olive oil']) assert.deepEqual(applyDescriptionAmounts(meal,text).items.map(i=>i.estimatedGrams),[3,100.5]);
 for(const [text,grams] of [['2 × 150 g Skyr',300],['0,2 kg gekochter Reis',200],['1 oz oats',28.3],['1 lb oats',453.6]])assert.equal(descriptionAmounts(text)[0].grams,grams);
 const missing=applyDescriptionAmounts({...meal,items:[item('oats')]},'100 g oats and 3 g unknown food');assert.equal(missing.items[1].searchTermEn,'unknown');assert.equal(missing.items[1].estimatedGrams,3);
 for(const text of ['10 ml Öl','200 ml Hafermilch','200 ml Milchpulver','200 ml Kondensmilch','200 ml Milch mit Honig'])assert.throws(()=>descriptionAmounts(text),/mass_required/);
 for(const text of ['0,5 g oats','.5 g oats','-3 g oats','2 × -150 g oats','100.55 g oats','6000 g oats'])assert.throws(()=>descriptionAmounts(text),/amount_out_of_range/);
 assert.deepEqual(descriptionAmounts('Milch 45 % und zwei Eier'),[]);
 assert.throws(()=>descriptionAmounts('100 g Haferflocken mit Milch'),/amount_ambiguous/);
 const eggs=applyDescriptionAmounts({...meal,items:[item('gekochte Eier')]},'2 gekochte Eier, zusammen 110 g');
 assert.equal(eggs.items.length,1);assert.equal(eggs.items[0].estimatedGrams,110);
 const pancakes=applyDescriptionAmounts({...meal,items:[item('pancakes'),item('maple syrup')]},'3 pancakes, 150 g in total, and 25 g maple syrup');
 assert.deepEqual(pancakes.items.map(i=>i.estimatedGrams),[150,25]);
 assert.equal(descriptionAmounts('200 g Naturjoghurt mit 1,5 % Fett')[0].grams,200);
 assert.throws(()=>descriptionAmounts('200 g Naturjoghurt mit 1,5 % Fett mit Honig'),/amount_ambiguous/);
 assert.throws(()=>descriptionAmounts('Reis und Hähnchen, zusammen 300 g'),/amount_ambiguous/);
 // Captured Azure responses used singular inflection and no space before %.
 const liveEgg={...item('gekochtes Ei',110),searchTermEn:'chicken egg boiled',pieceCount:2,pieceLabel:'2 Eier'};
 const boundEgg=applyDescriptionAmounts({...meal,items:[liveEgg]},'2 gekochte Eier, zusammen 110 g');
 assert.equal(boundEgg.items.length,1);assert.equal(boundEgg.items[0].estimatedGramsLow,110);assert.equal(boundEgg.items[0].pieceCount,2);
 const liveYogurt={...item('Naturjoghurt 1,5% Fett',200),searchTermEn:'plain yogurt low fat 1.5% milkfat'};
 const boundYogurt=applyDescriptionAmounts({...meal,items:[liveYogurt,item('Banane',50)]},'200 g Naturjoghurt mit 1,5 % Fett und 50 g Banane');
 assert.equal(boundYogurt.items.length,2);assert.deepEqual(boundYogurt.items.map(i=>i.estimatedGramsLow),[200,50]);
 for(const wrong of ['Naturjoghurt 11,5% Fett','Naturjoghurt 3,5% Fett','Naturjoghurt']) {
  const result=applyDescriptionAmounts({...meal,items:[item(wrong)]},'200 g Naturjoghurt mit 1,5 % Fett');
  assert.equal(result.items[0].estimatedGrams,100);assert.equal(result.items[1].searchTermEn,'unknown');
 }
 for(const wrong of ['rohes Ei','Eiweißbrot']) {
  const result=applyDescriptionAmounts({...meal,items:[item(wrong)]},'2 gekochte Eier, zusammen 110 g');
  assert.equal(result.items[0].estimatedGrams,100);assert.equal(result.items[1].searchTermEn,'unknown');
 }
});
await test('plain dairy milk volumes use a labelled density estimate; identities, units and explicit fat survive',()=>{
 for(const [text,grams] of [['1 Liter Milch',1030],['200 ml Milch',206],['0,2 l Vollmilch',206],['20 cl milk',206],['2 dl skimmed milk',206],['2 x 200 ml Milch',412],['Milch mit 1,5 % Fett 200 ml',206]]) assert.equal(descriptionAmounts(text)[0].grams,grams,text);
 const fixture={...meal,items:[item('Ei',110),item('Zimtschnecke',180),{...item('Milch'),searchTermEn:'whole milk'}]};
 const result=applyDescriptionAmounts(fixture,'2 Eier und 2 zintscjenxken und 1 Liter Milch');
 assert.equal(result.items.length,3);assert.deepEqual(result.items.map(i=>i.estimatedGrams),[110,180,1030]);
 assert.equal(result.items[2].estimatedGramsLow,1020);assert.equal(result.items[2].estimatedGramsHigh,1050);assert.equal(result.items[2].milkVolumeEstimated,true);assert.equal(result.confidence,'medium');
 const fat=applyDescriptionAmounts({...meal,items:[item('Vollmilch 3.5% Fett'),item('Milch 1.5% Fett')]},'200 ml Milch mit 1,5 % Fett');
 assert.deepEqual(fat.items.map(i=>i.estimatedGrams),[100,206]);
 assert.equal(applyDescriptionAmounts({...meal,items:[item('whole milk')]},'200 ml Vollmilch').items.length,1);
 for(const [text,wrong] of [['200 ml Vollmilch','skimmed milk'],['200 ml Milch mit 1,5 % Fett','Milch 3.5% Fett']]) {
  const corrected=applyDescriptionAmounts({...meal,items:[item(wrong)]},text);
  assert.equal(corrected.items.length,1);assert.equal(corrected.items[0].searchTermEn,'unknown');assert.equal(corrected.items[0].estimatedGrams,206);
 }
 const unweighed=applyDescriptionAmounts({...meal,confidence:'high',items:[{...item('egg'),confidence:'high'}]},'2 eggs');
 assert.equal(unweighed.items[0].confidence,'medium');assert.equal(unweighed.confidence,'medium');
 assert.throws(()=>applyDescriptionAmounts({...meal,items:[item('milk'),item('whole milk')]},'200 ml Milch'),/amount_ambiguous/);
 for(const text of ['-1 l Milch','6 l Milch','0 ml milk'])assert.throws(()=>descriptionAmounts(text),/amount_out_of_range/);
});
await test('model adapter keeps routes separate, blocks unapproved Gemini and truncated/refused/invalid data',async()=>{
 assert.equal(GEMINI_RELEASE_APPROVED,false);
 const req=modelRequest({model:GEMINI_MODEL,reasoning:'medium',content:[{type:'input_image',image_url:'data:image/jpeg;base64,AA=='}]});
 assert.equal(req.body.provider.only[0],'google-vertex/global');assert.equal(req.body.max_tokens,8192);assert.equal(req.body.reasoning.effort,'medium');assert.equal(req.body.messages[0].content[0].image_url.url,'data:image/jpeg;base64,AA==');
 assert.deepEqual(modelRequest({content:[]}).body.provider.only,['azure']);assert.throws(()=>modelRequest({model:GEMINI_MODEL,reasoning:'none',content:[]}));
 let calls=0; await assert.rejects(requestStructured({apiKey:'synthetic',model:GEMINI_MODEL,content:[],fetchImpl:()=>{calls++;}}),/ai_route_not_approved/);assert.equal(calls,0);
 for(const [payload,code,gemini] of [[{choices:[{finish_reason:'length'}]},'model_truncated',true],[{choices:[{finish_reason:'content_filter'}]},'model_refused',true],[{choices:[{finish_reason:'stop',message:{content:'```json {}'}}]},'provider_response_invalid',true],[{status:'incomplete'},'model_truncated',false],[{output:[{content:[{type:'refusal'}]}]},'model_refused',false]])assert.throws(()=>parseStructuredResponse(payload,gemini),new RegExp(code));
 await assert.rejects(requestStructured({apiKey:'synthetic',content:[],timeoutMs:5,fetchImpl:async()=>({ok:true,json:()=>new Promise(()=>{})})}),/provider_timeout/);
 await assert.rejects(requestStructured({apiKey:'synthetic',content:[],fetchImpl:async()=>({ok:true,json:async()=>({output_text:'{}'})})}),/provider_response_invalid/);
});
await test('AI assistance accepts no invented candidates, brand/preparation loss or third variant',async()=>{
 const proposal={canonical:'Edamame',preserve:[],question:'Meinst du Edamame?',candidateIds:[],variants:[]};
 validateSearchAssistance(proposal,[],'die grünen Bohnen beim Sushi');
 for(const p of [{...proposal,candidateIds:['made-up']},{...proposal,variants:['milk 3.5%']},{...proposal,variants:['a','b','c']}])assert.throws(()=>validateSearchAssistance(p,[],'Brand milk 1.5%'));
 let calls=0,lookups=0;const result=await runSearchAssistance({query:'die grünen Bohnen beim Sushi',language:'de',candidates:[],apiKey:'synthetic',routeAuthorized:true,lookup:()=>{lookups++;},fetchImpl:async()=>{calls++;return {ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify(proposal)}}]})};}});
 assert.equal(calls,1);assert.equal(lookups,0);assert.equal(result.confirmationRequired,true);assert.deepEqual(result.results,[]);
});
await test('cache coalesces, expires negatives, bounds size and never caches provider failures',async()=>{
 let now=0,calls=0;const cache=referenceCache({max:2,ttl:50,negativeTtl:5,now:()=>now});const loader=async()=>{calls++;await Promise.resolve();return {rows:[]};};
 const [a,b]=await Promise.all([cache.get('a',loader,()=>true,x=>!x.rows.length),cache.get('a',loader)]);a.rows.push('local');assert.deepEqual(b.rows,[]);assert.equal(calls,1);now=6;await cache.get('a',loader);assert.equal(calls,2);
 for(let i=0;i<2;i++)await assert.rejects(cache.get('bad',async()=>{throw new Error('429');}));
 await cache.get('b',loader);await cache.get('c',loader);await cache.get('a',loader);assert.equal(calls,5);
});
await test('mass-based OFF values and source portion decimals, never volume-as-grams',()=>{
 const p={nutriments:{'energy-kcal_100g':99.75,proteins_100g:2.5,carbohydrates_100g:10,fat_100g:4},serving_size:'12.5 g',serving_quantity:12.5};
 assert.equal(offMassNutrition(p).fiber,undefined);assert.equal(offMassPortions(p)[0].grams,12.5);
 for(const extra of [{quantity:'200 ml'},{nutrition_data_per:'100ml'},{product_quantity_unit:'l'}])assert.equal(offMassNutrition({...p,...extra}),null);
 assert.deepEqual(offMassPortions({...p,serving_size:'1 cup',serving_quantity_unit:'ml'}),[]);
});
await test('mandatory ordinary search identities use real catalogue without opposite qualifiers',()=>{
 assert.equal(compatibleSearchIdentity('Milk 1.5 %','Milk 11.5 %'),false);
 for(const q of ['Ei','Öl','egg','oil','Banane','Bananen','Haferflocken','haferfloken','Reis roh','Reis gekocht','Rosinen','Mandeln','Milch 1,5 %','Milch 3,5 %'])assert.ok(searchBlsCatalog(q,'de').length,q);
 for(const [q,wrong] of [['Reis',/milchreis|reismehl|reisnudeln/i],['Rosinen',/brot/i],['Mandeln',/drink|milch/i]])assert.doesNotMatch(searchBlsCatalog(q,'de')[0].nameDe,wrong);
 for(const q of ['Milch 1,5 %','Milch 3,5 %'])assert.ok(searchBlsCatalog(q,'de').every(x=>x.nameDe.includes(q.match(/\d,\d/)[0])));
 for(const language of ['de','en']) for(const [q,code] of [['Milch 3,5 %','M111300'],['Milch 3.5%','M111300'],['Milch 1,5 %','M111200'],['whole milk','M111300'],['Vollmilch','M111300']]) assert.equal(searchBlsCatalog(q,language)[0]?.code,code,language+': '+q);
 for(const q of ['milk chocolate','Milchschokolade','oat milk','Hafermilch']) assert.ok(!['M111100','M111200','M111300'].includes(searchBlsCatalog(q,'en')[0]?.code),q);
 assert.ok(!searchBlsCatalog('AcmeNotExisting Skyr','de').some(x=>x.strong));
});
// Execute the complete shipped Edge Function with synthetic Auth/RPC/transport.
const source=fs.readFileSync(new URL('../supabase/functions/nutrition/index.ts',import.meta.url),'utf8');
let appAccess={hard:false,access:'free',variant:'excluded'};
const imports={};let authorized=true,consented=true,providerCalls=0,rpcCalls=[];
const receipts=new Map();
const rpc=async(name,args={})=>{rpcCalls.push(name);
 if(['record_paywall_prior_use_v1','resolve_paywall_access_v1'].includes(name))return {data:appAccess,error:null};
 if(name==='lookup_capture_operation'){const entry=receipts.get(args.p_request_id);return {data:entry?(entry.fingerprint!==args.p_fingerprint?{status:'mismatch'}:entry.result?{status:'replay',result:entry.result}:{status:'request_completed'}):{status:'missing'},error:null};}
 if(name==='reserve_capture_operation'){receipts.set(args.p_request_id,{fingerprint:args.p_fingerprint});return {data:{status:'claimed'},error:null};}
 if(name==='finish_capture_operation'){receipts.get(args.p_request_id).result=args.p_result;return {data:{status:'completed'},error:null};}
const statuses={lookup_capture_operation:'missing',reserve_capture_operation:'claimed',reserve_analysis_access:'reserved',consume_global_analysis_quota:'allowed',mark_analysis_request_started:'started',finish_capture_operation:'completed',complete_analysis_request:'completed',claim_nutrition_provider_request:'allowed'};return {data:name==='consume_analysis_quota'?1:{status:statuses[name]??'allowed'},error:null};};
const query={abortSignal(){return this;},select(){return this;},eq(){return this;},in(){return this;},async maybeSingle(){return {data:{age:30,privacy_version:consented?'2026-09-04-ai-v2':'old',wellness_consent_at:'synthetic'},error:null};},then(resolve){return Promise.resolve({data:[],error:null}).then(resolve);},upsert(){return this;}};
const context={supabase:{auth:{getUser:async()=>({data:{user:authorized?{id:'10000000-0000-4000-8000-000000000001'}:null},error:null})},from:()=>query,rpc},supabaseAdmin:{from:()=>query,rpc}};
for(const [,id]of source.matchAll(/from '([^']+)'/g))imports[id]=id.startsWith('npm:')?{withSupabase:(_options,fn)=>request=>fn(request,context)}:await import(new URL('../supabase/functions/nutrition/'+id,import.meta.url));
const module={exports:{}};let upstream=async()=>new Response(JSON.stringify({hits:[]}));
const fakeFetch=async(...args)=>{providerCalls++;return upstream(...args);};
globalThis.fetch=fakeFetch;
const env={OPENROUTER_API_KEY:'synthetic',NUTRITION_RATE_LIMIT_SALT:'synthetic-local-test-only-salt-long-enough'};
new Function('require','module','exports','Deno','crypto','fetch',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(id=>imports[id],module,module.exports,{env:{get:key=>env[key]}},webcrypto,fakeFetch);
const gateway=module.exports.default;
const get=async(path)=>{const response=await gateway.fetch(new Request('http://localhost/nutrition'+path,{headers:{'x-real-ip':'127.0.0.1'}}));return {status:response.status,body:await response.json(),headers:response.headers};};
await test('B blocks every new provider entry before free quota/cache; A and old users retain lookup',async()=>{
 const before=providerCalls; appAccess={hard:true,access:'inactive',variant:'B'};
 for(const path of ['/v1/search?q=egg&scope=catalogue','/v1/barcode/00000901']) assert.equal((await get(path)).status,402);
 for(const path of ['/v1/analyze','/v1/describe','/v1/search-assist']) {
  rpcCalls=[]; const response=await gateway.fetch(new Request('http://localhost/nutrition'+path,{method:'POST',body:'{}'}));
  assert.equal(response.status,402); assert.equal((await response.json()).code,'paywall_access_required');
  assert.ok(!rpcCalls.includes('reserve_analysis_access'));assert.ok(!rpcCalls.includes('consume_analysis_quota'));
 }
 assert.equal(providerCalls,before);
 appAccess={hard:true,access:'unknown',variant:'B'};assert.equal((await get('/v1/search?q=egg&scope=catalogue')).status,503);
 appAccess={hard:false,access:'free',variant:'A'};assert.equal((await get('/v1/search?q=egg&scope=catalogue')).status,200);
 appAccess={hard:false,access:'free',variant:'excluded'};
});
await test('production GET paths: auth/consent before cache, local typing no external calls, cache replay',async()=>{
 assert.equal(compatibleSearchIdentity('Milk 1.5 %','Milk 11.5 %'),false);
 for(const q of ['Ei','Öl','egg','oil']){const result=await get('/v1/search?q='+encodeURIComponent(q)+'&language=de&scope=catalogue');assert.equal(result.status,200);assert.ok(result.body.results.length);}
 assert.equal(providerCalls,0);const path='/v1/search?q=AcmeSynthetic&language=de';const first=await get(path);assert.equal(first.status,200);assert.equal(first.body.searchStatus,'complete');
 // German readers: Germany-scoped text search plus one brand-tag probe when it found little; the replay is cached.
 assert.equal(providerCalls,2);await get(path);assert.equal(providerCalls,2);
 authorized=false;assert.equal((await get(path)).status,401);authorized=true;consented=false;assert.equal((await get(path)).status,403);consented=true;
});
await test('production barcode/search errors preserve status and Retry-After; invalid JSON never empty success',async()=>{
 upstream=async()=>new Response('{}',{status:429,headers:{'Retry-After':'17'}});let r=await get('/v1/barcode/00000001?language=de');assert.equal(r.status,429);assert.equal(r.headers.get('retry-after'),'17');
 upstream=async()=>new Response('{}',{status:404});assert.equal((await get('/v1/barcode/00000002')).status,404);
 upstream=async()=>new Response('{broken',{status:200});r=await get('/v1/search?q=AcmeBrokenJson&language=de');assert.notEqual(r.status,200);assert.equal(r.body.code,'provider_response_invalid');
 upstream=async()=>new Response('{}',{status:200});r=await get('/v1/search?q=AcmeBrokenSchema&language=de');assert.equal(r.body.code,'provider_response_invalid');
 upstream=async()=>{throw new DOMException('timeout','TimeoutError');};r=await get('/v1/search?q=AcmeTimeout&language=de');assert.equal(r.body.code,'provider_timeout');
 upstream=async()=>new Response('{}',{status:503});r=await get('/v1/barcode/00000003');assert.equal(r.body.code,'provider_error');
});
await test('candidate activation fails before paid inference; an unsupported volume no longer blocks a description',async()=>{
 const before=providerCalls;const capabilities=await get('/v1/capture-capabilities');assert.equal(capabilities.body.gemini,false);assert.equal(capabilities.body.searchAssistance,false);
 const assist=await gateway.fetch(new Request('http://localhost/nutrition/v1/search-assist',{method:'POST',body:JSON.stringify({query:'edamame',requestId:randomUUID()})}));assert.equal((await assist.json()).code,'ai_route_not_approved');
 assert.equal(providerCalls,before);
 // Owner decision 04.10.2026: "200 ml Öl" keeps the model estimate (amount_estimated) instead of a 422.
 const describe=await gateway.fetch(new Request('http://localhost/nutrition/v1/describe',{method:'POST',body:JSON.stringify({description:'200 ml Öl',requestId:randomUUID()})}));assert.notEqual((await describe.json()).code,'mass_required');
});
await test('production partial provider results remain selectable and carry outage status',async()=>{
 upstream=async(url)=>String(url).includes('usda.gov')?new Response('{}',{status:503}):new Response(JSON.stringify({hits:[{code:'00000901',product_name:'Acme synthetic bar',nutriments:{'energy-kcal_100g':99.75,proteins_100g:2,carbohydrates_100g:10,fat_100g:5}}]}));
 const result=await get('/v1/search?q=AcmeSyntheticBar&language=en');assert.equal(result.status,200);assert.equal(result.body.searchStatus,'partial');assert.equal(result.body.results[0].source.referenceId,'00000901');
});
const post=async(body)=>{const response=await gateway.fetch(new Request('http://localhost/nutrition/v1/describe',{method:'POST',headers:{'x-real-ip':'127.0.0.1'},body:JSON.stringify(body)}));return {status:response.status,body:await response.json()};};
await test('production text inference preserves quantities and replays before quota, old client stays compatible',async()=>{
 upstream=async()=>new Response(JSON.stringify({status:'completed',output_text:JSON.stringify(meal)}));
 const request={description:'100.5 g oats and 3 g olive oil',requestId:randomUUID(),ingredientCorrection:1,captureProtocol:2,language:'en'};
 const calls=providerCalls;rpcCalls=[];const first=await post(request);assert.equal(first.status,200,JSON.stringify(first.body));assert.deepEqual(first.body.items.map(i=>i.amountG),[3,100.5]);assert.equal(providerCalls,calls+1);
 rpcCalls=[];assert.deepEqual(await post(request),first);assert.equal(providerCalls,calls+1);assert.deepEqual(rpcCalls,['record_paywall_prior_use_v1','lookup_capture_operation']);
 assert.equal((await post({...request,description:'4 g olive oil'})).status,409);assert.equal(providerCalls,calls+1);
 const old=await post({...request,requestId:randomUUID(),captureProtocol:undefined});assert.equal(old.status,200);assert.deepEqual(old.body.items,first.body.items);
});
await test('production text path accepts the beta milk case and keeps the estimate warning for old and current clients',async()=>{
 const milkName=searchBlsCatalog('Milch','en').find(row=>row.code==='M111300').nameEn;
 upstream=async()=>new Response(JSON.stringify({status:'completed',output_text:JSON.stringify({...meal,items:[{...item('Milch'),searchTermEn:milkName}]})}));
 for(const protocol of [undefined,2]) {
  const result=await post({description:'1 Liter Milch',requestId:randomUUID(),ingredientCorrection:1,captureProtocol:protocol,language:'de'});
  assert.equal(result.status,200,JSON.stringify(result.body));assert.equal(result.body.items[0].amountG,1030);
  assert.ok(result.body.warnings.includes('milk_volume_estimated'));assert.equal(result.body.confidence,'medium');
 }
});
await test('unfinished ingredient draft replays free, invalid model response cannot create a retry cost loop',async()=>{
 upstream=async()=>new Response(JSON.stringify({status:'completed',output_text:JSON.stringify({...meal,items:[item('oats'),{...item('mystery'),searchTermEn:'unknown'}]})}));
 const request={description:'100.5 g oats and 3 g mystery',requestId:randomUUID(),ingredientCorrection:1,captureProtocol:2,language:'en'};const first=await post(request);assert.equal(first.status,200);assert.equal(first.body.correctionRequired,true);assert.equal(first.body.items.length,2);assert.ok(rpcCalls.includes('refund_analysis_request'));
 const before=providerCalls;assert.deepEqual(await post(request),first);assert.equal(providerCalls,before);
 upstream=async()=>new Response(JSON.stringify({output_text:'{}'}));const bad={...request,requestId:randomUUID()};const failure=await post(bad);assert.equal(failure.body.code,'provider_response_invalid');const used=providerCalls;assert.equal((await post(bad)).body.code,'request_completed');assert.equal(providerCalls,used);
});
console.log(JSON.stringify({passed:count,scope:'actual shared modules and full Edge handler; synthetic transport/Auth/RPC; zero external API calls'}));

globalThis.fetch=originalGlobalFetch;
