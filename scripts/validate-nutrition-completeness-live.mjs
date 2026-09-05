// Explicit opt-in: paid hosted model calls on a disposable QA account only.
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
const url=process.env.EXPO_PUBLIC_SUPABASE_URL;
const key=process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const {data,error}=await client.auth.signInAnonymously();
if(error || !data.user) throw error ?? new Error('No QA account');
try {
  const consent=await client.from('profiles').upsert({user_id:data.user.id,age:29,privacy_version:'2026-09-04-ai-v2',wellness_consent_at:new Date().toISOString()});
  if(consent.error) throw consent.error;
  for(const description of ['50 g getrocknete Datteln ohne Stein','100 g Banane und 30 g bittere Lindenzapfen']) {
    const response=await fetch(`${url}/functions/v1/nutrition/v1/describe`,{
      method:'POST',headers:{Authorization:`Bearer ${data.session.access_token}`,apikey:key,'Content-Type':'application/json'},
      body:JSON.stringify({description,language:'de',locale:'de-DE',requestId:randomUUID()})});
    const body=await response.json();
    if(description.includes('Datteln')) {
      assert.equal(response.status,200,body.code);
      assert.ok(body.items.length>0);
      assert.ok(body.items.every(item=>item.included && item.calories>0 && item.source?.code!=='unmatched'));
      const calories=body.items.reduce((sum,item)=>sum+item.calories,0);
      assert.ok(calories>=120 && calories<=200,`Unexpected date energy ${calories}`);
      console.log(JSON.stringify({case:'dried dates 50g',status:response.status,items:body.items.map(({name,amountG,calories,source})=>({name,amountG,calories,source}))}));
    } else {
      console.log(JSON.stringify({case:'mixed diagnostic',status:response.status,body}));
      assert.equal(response.status,422,'Unmatched mixed meal must not return partial nutrition');
      assert.ok(['missing_nutrition','unclear_image'].includes(body.code));
      console.log(JSON.stringify({case:'unmatched mixed meal',status:response.status,code:body.code}));
    }
  }
} finally {
  const deleted=await client.functions.invoke('delete-account',{method:'DELETE'});
  if(deleted.error) throw deleted.error;
  console.log('Disposable nutrition QA account deleted.');
}
