// Explicit synthetic-account integration test. Optional photo phase makes at
// most FOUR model calls; never loop/retry paid requests automatically.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import 'dotenv/config';

assert.ok(process.argv.includes('--live'),'Explicit --live required');
const photos=process.argv.includes('--photos');
const url=process.env.EXPO_PUBLIC_SUPABASE_URL,key=process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert.ok(url && key);
const report={timestamp:new Date().toISOString(),cases:[],cleanup:[],paidCalls:0};
const output=process.env.KANDRO_QA_OUTPUT;
assert.ok(output,'Evidence output path required');
const save=()=>writeFileSync(output,JSON.stringify(report,null,2)+'\n',{mode:0o600});
const subjects=[];
async function call(subject,path,body) {
  const started=performance.now();
  const response=await fetch(`${url}/functions/v1/nutrition${path}`,{
    method:body?'POST':'GET',headers:{apikey:key,'Content-Type':'application/json',...(subject?{Authorization:`Bearer ${subject.token}`}:{})},
    ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(90000),
  });
  return {status:response.status,body:await response.json(),latencyMs:Math.round(performance.now()-started)};
}
async function subject() {
  const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const result=await client.auth.signInAnonymously();
  if(result.error) throw result.error;
  const s={client,id:result.data.user.id,token:result.data.session.access_token};subjects.push(s);return s;
}
async function profile(s,age=29,consented=true) {
  const r=await s.client.from('profiles').upsert({user_id:s.id,display_name:'Synthetic final QA',age,privacy_version:consented?'2026-09-04-ai-v2':null,wellness_consent_at:consented?new Date().toISOString():null});
  if(r.error) throw r.error;
}
function record(id,result,expected) { report.cases.push({id,...result});save();assert.equal(result.status,expected,id); }
try {
  record('unauthenticated',await call(null,'/v1/search?q=banana&language=en'),401);
  const a=await subject();
  record('no-consent',await call(a,'/v1/search?q=banana&language=en'),403);
  await profile(a);
  const b=await subject();
  await assert.rejects(profile(b,15),error=>error.code==='23514');
  report.minorConsentConstraint='PASS: direct minor consent without guardian rejected by database';
  await profile(b,15,false);
  record('guardian-missing',await call(b,'/v1/search?q=banana&language=en'),403);
  for(const [viewer,other] of [[a,b],[b,a]]) {
    const r=await viewer.client.from('profiles').select('user_id').eq('user_id',other.id);
    assert.equal(r.error,null);assert.deepEqual(r.data,[]);
  }
  report.profileIsolation='PASS: both newly created subjects cannot read one another';
  for(const language of ['de','en']) {
    const r=await call(a,`/v1/barcode/7622210022776?language=${language}`);
    record(`milka-lu-${language}`,r,200);
    assert.match(r.body.name,/milka.*lu/i);
    assert.equal(r.body.source.referenceId,'7622210022776');
    assert.deepEqual([r.body.per100g.calories,r.body.per100g.protein,r.body.per100g.carbs,r.body.per100g.fat],[513,6.4,62.5,25.5]);
  }
  for(const [query,language] of [['Apfel','de'],['oats','en'],['rice','en'],['feijoada','en']]) {
    const r=await call(a,`/v1/search?q=${encodeURIComponent(query)}&language=${language}`);
    record(`search-${query}`,{...r,body:{count:r.body.results?.length,first:r.body.results?.[0],code:r.body.code}},200);
    assert.ok(Array.isArray(r.body.results));
  }
  if(photos) {
    assert.equal(process.env.KANDRO_QA_BUDGET_EUR,'0.50','Owner budget is 0.50 EUR');
    const meta=JSON.parse(readFileSync(process.env.KANDRO_QA_SECRET_METADATA,'utf8'));
    const digest=createHash('sha256').update('openai/gpt-4.1-mini').digest('hex');
    assert.equal(meta.find(x=>x.name==='OPENROUTER_VISION_MODEL')?.value,digest,'Verify deployed model before spending');
    report.budget={ownerCapEur:0.50,maxCalls:4,maxOutputTokensPerCall:2000,model:'openai/gpt-4.1-mini',pricingUsdPerMillion:{input:0.4,output:1.6},note:'Small existing JPEG; conservative 100000 input tokens per call gives USD 0.1728 total, far above image/prompt size. No automatic retries. Actual invoice not exposed by gateway.'};
    const image=readFileSync(new URL('../assets/meal-bowl.jpg',import.meta.url));
    assert.ok(image.length<300000,'Bound corpus size before paid phase');
    const base=image.toString('base64');
    // Only the available licensed example photo: no weighed ground truth.
    // Three positive repetitions, not three distinct reference meals.
    for(const [index,language] of ['de','en','de'].entries()) {
      assert.ok(report.paidCalls<4);report.paidCalls++;save();
      const r=await call(a,'/v1/analyze',{imageBase64:base,mimeType:'image/jpeg',language,requestId:randomUUID(),ingredientCorrection:1});
      report.cases.push({id:`photo-example-${index+1}`,language,imageSha256:createHash('sha256').update(image).digest('hex'),...r});save();
      assert.ok([200,422].includes(r.status),'bounded structured success/correction');
      if(r.status===200) assert.ok(Array.isArray(r.body.items)&&r.body.items.length>0);
    }
  }
  report.passed=true;
} catch(error) {
  report.passed=false;report.error=error.message;process.exitCode=1;
} finally {
  for(const s of subjects) {
    const deletion=await s.client.functions.invoke('delete-account',{method:'DELETE'});
    let cleaned=false,refreshRevoked=false;
    if(!deletion.error) {
      const remaining=await s.client.from('profiles').select('user_id').eq('user_id',s.id);
      const refresh=await s.client.auth.refreshSession();
      cleaned=!remaining.error&&remaining.data.length===0;
      refreshRevoked=Boolean(refresh.error||!refresh.data.session);
    }
    report.cleanup.push({deleted:!deletion.error,profileRemoved:cleaned,refreshRevoked,...(deletion.error?{pendingSyntheticUserId:s.id}: {})});
    if(!cleaned||!refreshRevoked) process.exitCode=1;
  }
  save();console.log(JSON.stringify({passed:report.passed,paidCalls:report.paidCalls,cleanup:report.cleanup,error:report.error}));
}
