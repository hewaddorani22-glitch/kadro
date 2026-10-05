import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
function load(file,deps={}) {
 const module={exports:{}};
 const js=ts.transpileModule(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 new Function('require','module','exports',js)(name=>{assert.ok(name in deps,'Unmocked '+name);return deps[name]},module,module.exports);
 return module.exports;
}
const policy=load('src/services/accessPolicy.ts');
const freeB={...policy.FREE_ACCESS,variant:'B',hard:false,access:'free',enrollmentOpen:false};
assert.equal(policy.parseAccessRecord(freeB).variant,'B');
assert.equal(policy.resolveAccess(freeB),'free');
const storage=new Map();let online=true,permits=0,remote={...freeB,hard:true,access:'inactive'};
const app=load('src/services/appAccess.ts',{
 '@react-native-async-storage/async-storage':{getItem:async k=>storage.get(k)??null,setItem:async(k,v)=>storage.set(k,v),removeItem:async k=>storage.delete(k)},
 '@/services/accessPolicy':policy,
 '@/services/supabaseClient':{functionsBaseUrl:'https://fixture.invalid/functions/v1',supabaseAnonKey:'fixture-public',getAccessSession:async()=>({userId:'own-fixture',accessToken:'fixture-token'}),getCurrentSessionUserId:async()=>'own-fixture',supabase:{rpc:async name=>{assert.ok(['authorize_meal_create_v1','exclude_paywall_access_v1'].includes(name));if(name==='authorize_meal_create_v1')permits++;return {error:null}}}},
 '@/i18n/active':{getDictionary:()=>({access:{accessRequired:'access_required',saveOnline:'online_required'}})},
 '@/services/subscription':{loadSubscriptionSnapshot:async()=>{throw Error('No purchase should be requested')}},
 '@/services/serverEntitlement':{refreshServerEntitlement:async()=>false},
});
globalThis.fetch=async url=>{assert.equal(new URL(url).hostname,'fixture.invalid');if(!online)throw Error('offline');return {ok:true,json:async()=>remote}};
await app.refreshAppAccess();await assert.rejects(app.assertNewAppUse(),/access_required/);
remote=freeB;await app.refreshAppAccess();await app.assertNewAppUse();await app.authorizeMealCreate('normal-free-meal');
assert.equal(permits,0);assert.equal(app.isAppAccessMeasurementVerified('own-fixture'),true);
app.invalidateAppAccess();online=false;const cached=await app.refreshAppAccess();assert.equal(cached.variant,'B');assert.equal(policy.resolveAccess(cached),'free');await app.assertNewAppUse();
assert.equal(app.isAppAccessMeasurementVerified('own-fixture'),false);
online=true;remote={...freeB,access:'active',validUntil:new Date(Date.now()+60000).toISOString()};const active=await app.refreshAppAccess();assert.equal(policy.resolveAccess(active),'active');
console.log('PASS protected original B refreshes from locked to normal free access, preserves B/cache, uses no hard-paywall permit, and retains Pro priority');
