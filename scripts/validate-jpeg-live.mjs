// Explicit post-deployment QA; exactly one paid call, no automatic retry.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import 'dotenv/config';
assert.ok(process.argv.includes('--live'));
assert.equal(process.env.KANDRO_QA_BUDGET_EUR,'0.50');
const prior=JSON.parse(readFileSync(process.env.KANDRO_QA_PRIOR));
assert.equal(prior.paidCalls,3);
const meta=JSON.parse(readFileSync(process.env.KANDRO_QA_SECRET_METADATA));
assert.equal(meta.find(x=>x.name==='OPENROUTER_VISION_MODEL')?.value,createHash('sha256').update('openai/gpt-4.1-mini').digest('hex'));
const url=process.env.EXPO_PUBLIC_SUPABASE_URL,key=process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const output=process.env.KANDRO_QA_OUTPUT; assert.ok(output);
const report={timestamp:new Date().toISOString(),backendVersion:51,cases:[],paidCalls:0,priorPaidCalls:3};
const save=()=>writeFileSync(output,JSON.stringify(report,null,2)+'\n',{mode:0o600});
let subject;
try {
  const auth=await client.auth.signInAnonymously();if(auth.error)throw auth.error;subject=auth.data;
  const profile=await client.from('profiles').upsert({user_id:subject.user.id,display_name:'Synthetic JPEG QA',age:29,privacy_version:'2026-09-04-ai-v2',wellness_consent_at:new Date().toISOString()});
  if(profile.error)throw profile.error;
  const image=readFileSync(new URL('../assets/meal-bowl.jpg',import.meta.url)); assert.ok(image.length<300000);
  const jpeg=image.toString('base64');
  const cases=[['plain text','x'.repeat(100)],['invalid alphabet','!'.repeat(100)],['base64 text',Buffer.from('not an image '.repeat(20)).toString('base64')],['truncated JPEG',jpeg.slice(0,-12)],['missing SOI','AAAA'+jpeg.slice(4)],['extra content',jpeg+Buffer.from('junk').toString('base64')],['whitespace',' '+jpeg],['data URL','data:image/jpeg;base64,'+jpeg],['PNG under JPEG MIME',readFileSync(new URL('../assets/favicon.png',import.meta.url)).toString('base64')],['empty',''],['oversize','x'.repeat(3000004)],['valid example',jpeg]];
  for(const [name,imageBase64]of cases){
    if(name==='valid example'){report.paidCalls++;save();assert.equal(report.paidCalls,1);}
    const started=performance.now();
    const response=await fetch(`${url}/functions/v1/nutrition/v1/analyze`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${subject.session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({imageBase64,mimeType:'image/jpeg',language:'en',requestId:randomUUID(),ingredientCorrection:1}),signal:AbortSignal.timeout(90000)});
    const body=await response.json();report.cases.push({name,status:response.status,body,latencyMs:Math.round(performance.now()-started)});save();
    assert.equal(response.status,name==='valid example'?200:name==='oversize'?413:400,name);
  }
  report.imageSha256=createHash('sha256').update(image).digest('hex');report.passed=true;
}catch(error){report.passed=false;report.error=error.message;process.exitCode=1;}
finally{
  if(subject){
    const deletion=await client.functions.invoke('delete-account',{method:'DELETE'});
    const remaining=await client.from('profiles').select('user_id').eq('user_id',subject.user.id);
    const refresh=await client.auth.refreshSession();
    report.cleanup={deleted:!deletion.error,profileRemoved:!remaining.error&&remaining.data.length===0,refreshRevoked:Boolean(refresh.error||!refresh.data.session)};
    if(Object.values(report.cleanup).some(x=>!x)){report.pendingSyntheticUserId=subject.user.id;process.exitCode=1;}
  }save(); console.log(JSON.stringify({passed:report.passed,paidCalls:report.paidCalls,cleanup:report.cleanup,error:report.error}));
}
