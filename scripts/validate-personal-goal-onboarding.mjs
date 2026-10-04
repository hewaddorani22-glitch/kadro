#!/usr/bin/env node
// Runs shipped controller + repositories with synthetic platform adapters.
// No native-render, backend, billing or model-call claim.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
const read = file => fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
function load(file,mocks={},source=read(file)) {
 const module={exports:{}};
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 new Function('require','module','exports',code)(id=>{assert.ok(id in mocks,`${file}: unmocked ${id}`);return mocks[id]},module,module.exports);
 return module.exports;
}
const goals=load('src/services/personalGoal.ts');
const units=load('src/utils/units.ts',{'@/i18n/active':{getLocale:()=> 'de-DE'},'@/i18n':{deviceRegion:()=> 'DE'}});
const personalization=load('src/services/personalization.ts',{'@/i18n/active':{getDictionary:()=>({common:{}})},'@/utils/units':units});
const base={...personalization.DEFAULT_PROFILE,age:29,goal:'lose',heightCm:178,weightKg:78,unitSystem:'metric',completedAt:null};
const checks=[];
async function test(name,run){await run();checks.push(name);console.log('PASS',name)}
await test('seven adult steps; six for maintain and teens; strict calendar and optional fields',()=>{
 assert.deepEqual(goals.onboardingSteps(29,'lose'),['goal','about','body','activity','target','preferences','plan']);
 for(const [age,goal] of [[14,'lose'],[17,'gain'],[29,'maintain']]){assert.equal(goals.onboardingSteps(age,goal).length,6);assert.ok(!goals.onboardingSteps(age,goal).includes('target'))}
 for(const [date,valid] of [['2028-02-29',true],['2027-02-29',false],['2026-04-31',false],['2026-00-10',false],['2026-10-00',false],['2026-10-04',true],['04.10.2026',false],['2026-1-04',false],['2026-10-04T12:00:00Z',false]]) assert.equal(goals.isPersonalGoalDate(date),valid,date);
 assert.equal(goals.personalGoalError(null,null,'2026-10-04'),null);
 assert.equal(goals.personalGoalError(70,'2026-10-04','2026-10-04'),null);
 assert.equal(goals.personalGoalError(70,'2026-10-03','2026-10-04'),'date');
 assert.equal(goals.personalGoalError(null,'2026-12-04','2026-10-04'),'weight');
 for(const weight of [NaN,Infinity,39.9,200.1])assert.equal(goals.personalGoalError(weight,null,'2026-10-04'),'weight');
 for(const [value,result]of [['70,5',70.5],['150.25',150.25],['70kg',null],['1e2',null],['',null],['70.123',null]])assert.equal(goals.parsePersonalGoalWeight(value),result);
 for(const profile of [{...base,age:17},{...base,goal:'maintain'}])assert.deepEqual(goals.normalizePersonalGoal({...profile,targetWeightKg:70,targetDate:'2027-01-01'}),{targetWeightKg:null,targetDate:null});
 assert.deepEqual(personalization.calculateDailyTargets(base),personalization.calculateDailyTargets({...base,targetWeightKg:40,targetDate:'2026-10-04'}),'a wish must never change the calorie/protein calculation');
});
function controller(profile=base,editing=false){
 let cursor=0,slots=[],effects=[],tree;const saved=[],routes=[],events=[],grants=[],enrolled=[];let guardianApproved=false;
 const same=(a,b)=>a&&b&&a.length===b.length&&a.every((x,i)=>Object.is(x,b[i]));
 const react={
  useState(initial){const index=cursor++;slots[index]??={value:typeof initial==='function'?initial():initial};return[slots[index].value,v=>{slots[index].value=typeof v==='function'?v(slots[index].value):v}]},
  useRef(initial){const index=cursor++;slots[index]??={current:initial};return slots[index]},
  useMemo(fn,deps){const index=cursor++;if(!same(slots[index]?.deps,deps))slots[index]={deps,value:fn()};return slots[index].value},
  useCallback(fn,deps){return this.useMemo(fn,deps)},
  useEffect(fn,deps){const index=cursor++;if(!same(slots[index]?.deps,deps)){slots[index]={deps};effects.push(fn)}}
 };react.useCallback=(fn,deps)=>react.useMemo(()=>fn,deps);
 const section=new Proxy({}, {get:(_,key)=>['step','confirmAge','paceGain','paceLose','dateMonths','dateChosen','paceWeeks','targetDiff','goalBy','decreaseUnit','increaseUnit'].includes(key)?(...args)=>`${key}:${args.join('/')}`:String(key)});
 const t={onboarding:section,common:section,access:section};
 const jsx=(type,props)=>({type,props:props??{}});
 const source=process.env.KANDRO_ONBOARDING_BASELINE==='1'?execFileSync('git',['show','HEAD:src/app/onboarding.tsx'],{encoding:'utf8'}):read('src/app/onboarding.tsx');
 const screen=load('src/app/onboarding.tsx',{
  react,'react/jsx-runtime':{jsx,jsxs:jsx,Fragment:'Fragment'},
  'react-native':{...Object.fromEntries(['KeyboardAvoidingView','Modal','Pressable','ScrollView','Text','TextInput','View'].map(k=>[k,k])),Platform:{OS:'ios'},Keyboard:{addListener:()=>({remove(){}})},StyleSheet:{create:v=>v,hairlineWidth:1},useWindowDimensions:()=>({height:844,fontScale:1})},
  'react-native-safe-area-context':{SafeAreaView:'SafeAreaView',useSafeAreaInsets:()=>({top:0,bottom:0})},
  'expo-router':{useLocalSearchParams:()=>editing?{edit:'1'}:{},useRouter:()=>({replace:p=>routes.push(p),push:p=>routes.push(p)})},
  '@expo/vector-icons/Ionicons':{default:'Icon'},'@/components/WeightEntry':{WeightEntry:'WeightEntry'},'@/components/KandroMark':{KandroMark:'Mark'},
  '@/components/PersonalGoalSummary':{PersonalGoalSummary:'PersonalGoalSummary'},'@/components/PlanBuilder':{PlanBuilder:'PlanBuilder',BUILDING_MS:-250},
  '@/components/ui':{PrimaryButton:'PrimaryButton',ProgressBar:'ProgressBar'},
  '@/constants/theme':{radii:{},spacing:{}},'@/context/ThemeContext':{useTheme:()=>({colors:{}}),useThemedStyles:()=>new Proxy({},{get:()=>({})})},
  '@/context/AppContext':{useApp:()=>({profile,completeOnboarding:async p=>saved.push(p),grantWellnessConsent:async age=>grants.push(age)})},
  '@/i18n/LanguageProvider':{useLanguage:()=>({language:'de',locale:'de-DE',t})},
  '@/services/personalization':personalization,'@/services/personalGoal':goals,
  '@/services/guardianConsent':{getGuardianConsentStatus:async()=>guardianApproved,requestGuardianConsent:async()=>guardianApproved?'approved':'pending'},
  '@/services/appAccess':{prepareAccessEnrollment:async confirmed=>enrolled.push(confirmed)},'@/services/reminders':{prepareReminderOnboarding:async()=>{}},
  '@/services/telemetry':{trackEvent:(event,payload)=>events.push({event,...payload})},
  '@/services/haptics':Object.fromEntries(['errorHaptic','selectionHaptic','stepHaptic','successHaptic'].map(k=>[k,async()=>{}])),
  '@/utils/format':{formatNumber:String,formatDateParts:d=>d.toISOString().slice(0,10)},'@/utils/decimalInput':load('src/utils/decimalInput.ts'),'@/utils/units':units,'@/utils/date':{localDateKey:()=> '2026-10-04'},
 },source).default;
 const render=()=>{cursor=0;tree=screen();const pending=effects;effects=[];pending.forEach(fn=>fn());return tree};
 const nodes=(node=tree)=>{if(Array.isArray(node))return node.flatMap(n=>nodes(n));if(!node||typeof node!=='object')return[];if(node.type==='Modal'&&!node.props.visible)return[];return[node,...nodes(node.props.children??null)]};
 const find=(type,predicate=()=>true)=>{const node=nodes().find(n=>(typeof n.type==='function'?n.type.name:n.type)===type&&predicate(n.props));assert.ok(node,`${type} not on ${step()}`);return node.props};
 const step=()=>events.filter(e=>e.event==='setup step viewed').at(-1)?.step;
 const flush=async()=>{for(let i=0;i<6;i++)await Promise.resolve();await new Promise(r=>setTimeout(r,5));render();await new Promise(r=>setTimeout(r,5));render()};
 const next=async()=>{find('PrimaryButton',p=>p.icon==='arrow-forward').onPress();await flush()};
 render();return{sex:profile.sex,render,find,nodes,step,next,flush,saved,routes,grants,enrolled,setGuardian:v=>{guardianApproved=v},back:async()=>{find('Pressable',p=>p.accessibilityLabel==='back').onPress();await flush()}};
}
// The biological sex is an explicit choice: nothing is preselected on "about".
async function through(c,steps){for(const expected of steps){assert.equal(c.step(),expected);if(expected==='about'){const sex=c.nodes().find(n=>n.type?.name==='Segmented'&&n.props.selected===null);if(sex){assert.equal(c.find('PrimaryButton',p=>p.icon==='arrow-forward').disabled,true,'sex must be chosen');sex.props.onSelect(c.sex??'female');c.render()}}await c.next()}}
await test('real screen: explicit age, manual next, seven steps and consent boundary',async()=>{
 const c=controller();assert.equal(c.step(),'goal');c.find('ChoiceList').onSelect('gain');c.render();assert.equal(c.step(),'goal','selection does not navigate');await c.next();assert.equal(c.step(),'about');
 assert.equal(c.find('PrimaryButton',p=>p.icon==='arrow-forward').disabled,true);await c.next();assert.equal(c.step(),'about','direct handler cannot bypass age');
 c.find('Pressable',p=>p.accessibilityRole==='checkbox').onPress();c.render();
 await through(c,['about','body','activity','target','preferences']);assert.equal(c.step(),'plan');await c.next();assert.equal(c.saved.length,0,'needs wellness consent');
 c.find('PrimaryButton',p=>p.label==='consentAccept').onPress();await c.flush();assert.equal(c.saved.length,1);assert.equal(c.saved[0].targetWeightKg,81,'gain: suggested target +3 kg is kept');assert.match(c.saved[0].targetDate,/^\d{4}-\d{2}-\d{2}$/);assert.deepEqual(c.enrolled,[true]);assert.deepEqual(c.routes,['/reminder-setup']);
});
await test('real screen: tap-only goal entry, date chips, validation, back retention, unit conversion and profile edit',async()=>{
 const previous={...base,displayName:'Saved',sex:'female',completedAt:'2026-09-01T12:00:00Z',targetWeightKg:70.5,targetDate:'2027-04-01'};
 const c=controller(previous,true);assert.equal(c.find('ChoiceList').selected,'lose');await c.next();assert.equal(c.find('TextInput',p=>p.accessibilityLabel==='nameTitle').value,'Saved');assert.ok(!c.nodes().some(n=>n.type?.name==='NumberStep'),'recorded age cannot be edited');
 await through(c,['about','body','activity']);assert.equal(c.step(),'target');
 const weightInput=()=>c.find('TextInput',p=>p.accessibilityLabel==='targetWeightLabel');
 assert.equal(weightInput().value,'70.5');
 assert.ok(!c.nodes().some(n=>n.type==='TextInput'&&n.props.accessibilityLabel==='targetDateLabel'),'the date is never typed');
 // A saved custom date stays selectable as its own chip.
 const chip=label=>c.find('Pressable',p=>p.accessibilityRole==='radio'&&p.accessibilityLabel===label);
 assert.equal(c.find('Pressable',p=>p.accessibilityRole==='radio'&&p.accessibilityState?.checked&&p.accessibilityLabel!==undefined).accessibilityLabel,'2027-04-01');
 chip('dateMonths:6').onPress();c.render();
 // invalid typed weight blocks Next
 weightInput().onChangeText('0');c.render();await c.next();assert.equal(c.step(),'target');
 weightInput().onChangeText('70,5');c.render();
 // the − / + steppers move on the 0.5 kg grid
 c.find('StepperButton',p=>p.icon==='add').onPressIn();c.render();assert.equal(weightInput().value,'71');
 c.find('StepperButton',p=>p.icon==='remove').onPressIn();c.render();assert.equal(weightInput().value,'70.5');
 c.find('UnitToggle').onChange('us');await c.flush();c.render();assert.equal(weightInput().value,'155.4');
 c.find('UnitToggle').onChange('metric');await c.flush();c.render();
 await c.next();await c.back();assert.equal(c.step(),'target');
 await through(c,['target','preferences']);const shown=c.find('PersonalGoalSummary').profile;assert.equal(shown.age,29);assert.ok(Math.abs(shown.targetWeightKg-70.5)<0.06);assert.equal(shown.targetDate,'2027-04-04');assert.equal(shown.completedAt,previous.completedAt);await c.next();
 assert.equal(c.saved.length,1);assert.equal(c.saved[0].targetDate,'2027-04-04');assert.deepEqual(c.grants,[],'adult edits do not re-request consent');assert.deepEqual(c.enrolled,[],'edits never enroll anew');assert.deepEqual(c.routes,['/(tabs)/profile']);
});
await test('real screen: a new adult gets a suggested target and matching date; removing clears both',async()=>{
 const c=controller();await c.next();c.find('Pressable',p=>p.accessibilityRole==='checkbox').onPress();c.render();await through(c,['about','body','activity']);assert.equal(c.step(),'target');c.render();
 assert.equal(c.find('TextInput',p=>p.accessibilityLabel==='targetWeightLabel').value,'73','suggested target is prefilled');
 const checked=c.find('Pressable',p=>p.accessibilityRole==='radio'&&p.accessibilityState?.checked&&typeof p.accessibilityLabel==='string');
 assert.match(checked.accessibilityLabel,/^datePace/,'the pace date is preselected');
 c.find('Pressable',p=>p.accessibilityRole==='button'&&String(p.onPress).includes("setTargetWeightInput('')")).onPress();c.render();
 assert.ok(!c.nodes().some(n=>n.type==='TextInput'&&n.props.accessibilityLabel==='targetWeightLabel'));
 await through(c,['target','preferences']);await c.next();c.find('PrimaryButton',p=>p.label==='consentAccept').onPress();await c.flush();assert.equal(c.saved[0].targetWeightKg,null);assert.equal(c.saved[0].targetDate,null);
});
await test('real screen: 14–15 guardian gate and no youth target claims; maintain skips target',async()=>{
 const c=controller({...base,age:15,completedAt:'2026-09-01',targetWeightKg:60,targetDate:'2027-01-01'},true);
 await through(c,['goal','about','body','activity','preferences']);assert.equal(c.step(),'plan');assert.equal(c.find('PersonalGoalSummary').profile.targetWeightKg,null);await c.next();assert.equal(c.saved.length,0);assert.ok(c.find('PrimaryButton',p=>p.label==='guardianSend'));
 c.find('TextInput',p=>p.accessibilityLabel==='guardianEmail').onChangeText('guardian@example.test');c.render();c.find('PrimaryButton',p=>p.label==='guardianSend').onPress();await c.flush();assert.equal(c.saved.length,0);assert.ok(c.find('PrimaryButton',p=>p.label==='guardianCheck'));c.setGuardian(true);c.find('PrimaryButton',p=>p.label==='guardianCheck').onPress();await c.flush();assert.equal(c.saved.length,1);assert.equal(c.saved[0].age,15);
 const m=controller({...base,goal:'maintain',completedAt:'2026-09-01'},true);await through(m,['goal','about','body','activity','preferences']);assert.equal(m.step(),'plan');
});
const values=new Map();
const storage={getItem:async k=>values.get(k)??null,setItem:async(k,v)=>values.set(k,v),removeItem:async k=>values.delete(k),multiSet:async pairs=>pairs.forEach(([k,v])=>values.set(k,v)),multiRemove:async keys=>keys.forEach(k=>values.delete(k))};
const localMocks={'@/services/personalGoal':goals,'@react-native-async-storage/async-storage':{default:storage},'@/services/personalization':personalization,'@/utils/date':{localDateKey:()=> '2026-10-04'},'@/utils/units':units,'@/utils/requestId':{isAnalysisRequestId:()=>true,newAnalysisRequestId:()=> 'test-id'}};
let local=load('src/services/localRepository.ts',localMocks);
await test('real local repository survives restart, legacy rows, corrupted wishes and account replacement',async()=>{
 const desired={...base,completedAt:'2026-09-01',targetWeightKg:70.25,targetDate:'2028-02-29'};await local.saveProfile(desired);local=load('src/services/localRepository.ts',localMocks);assert.deepEqual(await local.loadProfile(),desired);
 values.set('@kandro/profile:v1',JSON.stringify({...base,completedAt:'2026-09-01'}));const old=await local.loadProfile();assert.equal(old.completedAt,'2026-09-01');assert.equal(old.targetWeightKg,null);assert.equal(old.targetDate,null);
 for(const extra of [{targetWeightKg:'70',targetDate:'2027-01-01'},{targetWeightKg:201},{age:17,targetWeightKg:70}]){values.set('@kandro/profile:v1',JSON.stringify({...base,...extra}));assert.equal((await local.loadProfile()).targetWeightKg,null)}
 await local.saveProfile(desired);await local.replaceLocalAccountData({...base,completedAt:'2026-09-02'},[],0);assert.equal((await local.loadProfile()).targetWeightKg,null);assert.equal((await local.loadProfile()).completedAt,'2026-09-02');
});
await test('real cloud repository stores/reads wishes for owner, keeps legacy completed state and target formula',async()=>{
 const writes=[],filters=[];let row={display_name:'Stored',goal:'lose',age:29,height_cm:178,weight_kg:78,activity_level:'light',weekly_rate_kg:0.5,unit_system:'metric',sex:'female',preferences:[],target_weight_kg:'70.25',target_date:'2028-02-29',updated_at:'2026-09-01'};
 const targets=personalization.calculateDailyTargets(base);
 const supabase={from:table=>{const chain={upsert:async(payload,options)=>{writes.push({table,payload,options});return{error:null}},select:()=>chain,eq:(key,value)=>{filters.push({table,key,value});return chain},single:async()=>({data:table==='profiles'?row:targets,error:null})};return chain}};
 const cloud=load('src/services/cloudRepository.ts',{'@/services/personalGoal':goals,'./supabaseClient':{supabase,isSupabaseConfigured:true,ensureSupabaseUser:async()=>({id:'owner-A'}),getCurrentSessionUserId:()=> 'owner-A'},'@/utils/date':{localDateKey:()=> '2026-10-04'},'@/utils/units':units,'@/services/personalization':personalization,'@/utils/format':{formatClockTime:String},'./localRepository':{getLocalDataGeneration:()=>0},'@/utils/requestId':{newAnalysisRequestId:()=> 'test-id'}});
 await cloud.saveCloudProfile({...base,targetWeightKg:70.25,targetDate:'2028-02-29'},targets);assert.equal(writes[0].payload.user_id,'owner-A');assert.equal(writes[0].payload.target_weight_kg,70.25);assert.equal(writes[0].payload.target_date,'2028-02-29');assert.equal(writes[1].payload.calories,targets.calories);
 const result=await cloud.initializeCloudProfile(base,targets,true,{userId:'owner-A',generation:0});assert.equal(result.profile.targetWeightKg,70.25);assert.equal(result.profile.targetDate,'2028-02-29');assert.equal(result.profile.completedAt,'2026-09-01');assert.ok(filters.some(f=>f.table==='profiles'&&f.key==='user_id'&&f.value==='owner-A'));
 row={...row,target_weight_kg:null,target_date:null};const old=await cloud.initializeCloudProfile(base,targets,true);assert.equal(old.profile.targetWeightKg,null);assert.equal(old.profile.completedAt,'2026-09-01');
 await assert.rejects(cloud.initializeCloudProfile(base,targets,true,{userId:'owner-B',generation:0}),/cloud_identity_changed/);
 await cloud.saveCloudProfile({...base,age:17,targetWeightKg:70,targetDate:'2028-02-29'},targets);assert.equal(writes.at(-2).payload.target_weight_kg,null);assert.equal(writes.at(-2).payload.target_date,null);
});
console.log(`Personal-goal/onboarding: ${checks.length} controller/persistence groups passed. Native layout and hosted schema not claimed.`);
// Order: the plan is built on screen before it is revealed (no number shown
// first and "calculated" afterwards), and no button can skip past it.
{
  const src = read('src/app/onboarding.tsx');
  const buildAt = src.indexOf("step === 'plan' && building ? <View style={styles.buildingStage}><PlanBuilder");
  const revealAt = src.indexOf("step === 'plan' && !building ?");
  assert.ok(buildAt > 0 && revealAt > buildAt, 'building precedes the reveal');
  assert.match(src, /showFooterButton && !keyboardOpen && !\(step === 'plan' && building\)/, 'no Next while the plan is being built');
  assert.match(src, /setTimeout\(\(\) => setRevealed\(true\), BUILDING_MS \+ 250\)/, 'reveal waits for the full count');
  assert.match(src, /const building = step === 'plan' && !editing && !revealed;/, 'building from the first frame');
  assert.doesNotMatch(read('src/app/access-setup.tsx'), /PlanBuilder|buildingTitle/, 'the plan is never built a second time after consent');
  console.log('PASS build-then-reveal order; no second calculation after consent');
}
