import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const raw=readFileSync(new URL('../src/services/mealAnalysis.ts',import.meta.url),'utf8');
const source=raw.replace(/^import[\s\S]*?from [^;]+;\n/gm,'')+'\nexport { gatewayFetch, gatewayMessage, localizeResult };';
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
let fetchImpl=()=>new Promise(()=>{}), timer, cleared=false, requestSignal;
const t={gatewayTimeout:'Localized timeout',analysisFailed:'Localized failure',noConnection:'Localized connection error',sessionUnavailable:'Localized session error',warnUnmatched:'Localized missing',warnGenericReference:'Localized typical reference'};
const bindings={
  process:{env:{}}, functionsBaseUrl:'https://example.invalid/functions/v1',supabaseAnonKey:'public-test',
  getLocalDataGeneration:()=>0,
  getAccessToken:async()=> 'synthetic-token',isSupabaseConfigured:true,
  getDictionary:()=>({errors:t,paywall:{}}),getLanguage:()=> 'en',getLocale:()=> 'en-GB',
  fetch:(url,init)=>{
    assert.equal(url,'https://example.invalid/functions/v1/nutrition/v1/search');
    assert.equal(init.headers.Authorization,'Bearer synthetic-token');
    assert.equal(init.headers.apikey,'public-test');
    requestSignal=init.signal;return fetchImpl(url,init);
  },
  AbortController,setTimeout:(callback,ms)=>{assert.equal(ms,90000);timer=callback;return 1;},
  clearTimeout:()=>{cleared=true;},
};
const api={};new Function('exports',...Object.keys(bindings),js)(api,...Object.values(bindings));
const hanging=api.gatewayFetch('/v1/search');
assert.equal(typeof timer,'function','gateway must bound a stalled network request');
for(let tick=0;tick<4;tick++) await Promise.resolve();
const rejected=assert.rejects(hanging,error=>error.kind==='timeout' && error.message===t.gatewayTimeout);
timer();await rejected;
assert.equal(requestSignal?.aborted,true);
assert.equal(cleared,true);

cleared=false;
fetchImpl=async()=>({ok:true,status:200,json:()=>new Promise(()=>{})});
const hangingBody=api.gatewayFetch('/v1/search');
await Promise.resolve();await Promise.resolve();
const bodyRejected=assert.rejects(hangingBody,error=>error.kind==='timeout');
timer();await bodyRejected;
assert.equal(cleared,true,'deadline includes body parsing, not just response headers');

fetchImpl=async()=>({ok:true,status:200,json:async()=>({results:[{id:'one'}]})});
const success=await api.gatewayFetch('/v1/search');
assert.deepEqual(await success.json(),{results:[{id:'one'}]});
assert.equal(success.status,200);
assert.equal(api.gatewayMessage('unknown','raw provider secret or wrong language'),t.analysisFailed);
assert.deepEqual(api.localizeResult({items:[],warnings:['unmatched_ingredient','untrusted provider text']}).warnings,[t.warnUnmatched]);
console.log('PASS: gateway 90-second deadline covers headers/body, aborts transport, retains successful JSON and suppresses unmapped provider prose. INTEGRATION with fake transport/timers.');
