#!/usr/bin/env python3
"""Additive goal columns and existing owner/guardian gates on isolated local PG."""
import os, pathlib, subprocess, uuid
root=pathlib.Path(__file__).resolve().parents[1]
host=os.environ.get('KANDRO_TEST_PG_SOCKET','')
assert host.startswith('/tmp/kandro-pg-'), 'Dedicated local Unix socket required'
base=['psql','-X','-qAt','-v','ON_ERROR_STOP=1','-h',host,'-p',os.environ.get('KANDRO_TEST_PG_PORT','56329')]
db='kandro_personal_goal_test_'+uuid.uuid4().hex[:10]
def run(sql,database=db,error=None):
 result=subprocess.run(base+['-d',database],input=sql,text=True,capture_output=True)
 if error:
  assert result.returncode and error in result.stderr,result.stderr
  return
 assert result.returncode==0,result.stderr
 return result.stdout.strip()
def auth(owner,sql,error=None):
 return run("begin;set local role authenticated;set local request.jwt.claim.role='authenticated';set local request.jwt.claim.sub='"+owner+"';"+sql+';commit;',error=error)
a,b,teen=[str(uuid.uuid4()) for _ in range(3)]
checks=[]
def check(name):checks.append(name);print('PASS',name,flush=True)
run('create database '+db,'postgres')
try:
 run("do $$begin create role authenticated;exception when duplicate_object then null;end$$;do $$begin create role anon;exception when duplicate_object then null;end$$;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.role() returns text language sql stable as $$select nullif(current_setting('request.jwt.claim.role',true),'')$$;grant usage on schema auth to authenticated;")
 for migration in ['20260831111459_day3_core_schema.sql','20260831191324_add_privacy_consent.sql','20260904120000_allow_teen_profiles_with_guardian_consent.sql']:
  run((root/'supabase/migrations'/migration).read_text())
 run(f"insert into auth.users values('{a}'),('{b}'),('{teen}');insert into public.profiles(user_id,age,weight_kg,goal)values('{a}',29,78,'lose'),('{b}',30,85,'gain'),('{teen}',15,60,'lose')")
 before=run('select user_id,age,weight_kg,goal,updated_at from public.profiles order by user_id')
 run((root/'supabase/migrations/20261004145027_add_optional_personal_goal.sql').read_text())
 assert run('select user_id,age,weight_kg,goal,updated_at from public.profiles order by user_id')==before
 assert run('select count(*) from public.profiles where target_weight_kg is null and target_date is null')=='3'
 check('migration preserves all legacy profile data and defaults both columns to NULL')
 auth(a,"update public.profiles set target_weight_kg=70.25,target_date='2028-02-29'")
 assert auth(a,'select target_weight_kg,target_date from public.profiles')=='70.25|2028-02-29'
 assert auth(b,'select target_weight_kg,target_date from public.profiles')=='|'
 auth(b,f"update public.profiles set target_weight_kg=99 where user_id='{a}'")
 assert auth(a,'select target_weight_kg from public.profiles')=='70.25'
 auth(b,f"insert into public.profiles(user_id,age,target_weight_kg)values('{uuid.uuid4()}',29,70)",error='row-level security')
 run('set role anon;select target_weight_kg from public.profiles',error='permission denied')
 check('own goal round-trips; foreign reads/updates and anonymous reads remain blocked')
 for value in ['39.99','200.01',"'NaN'"]:
  auth(a,'update public.profiles set target_weight_kg='+value,error='profiles_personal_goal_check')
 auth(a,"update public.profiles set target_date='2027-02-29'",error='date/time field value out of range')
 auth(a,'update public.profiles set target_weight_kg=null',error='profiles_personal_goal_check')
 auth(teen,'update public.profiles set target_weight_kg=55',error='profiles_personal_goal_check')
 auth(teen,'update public.profiles set age=18,target_weight_kg=55',error='minor age boundary is server managed')
 auth(teen,"update public.profiles set privacy_version='test',wellness_consent_at=now()",error='profiles_minor_consent_check')
 check('invalid weight/date/date-only/youth wishes and youth age or consent bypasses rejected')
 auth(a,"update public.profiles set goal='maintain',display_name='Legacy client'")
 assert auth(a,'select goal,target_weight_kg from public.profiles')=='maintain|70.25'
 auth(a,'update public.profiles set target_weight_kg=null,target_date=null')
 assert auth(a,'select target_weight_kg,target_date from public.profiles')=='|'
 check('older clients can change existing goals without knowing new fields; owner can clear wishes')
 assert run("select count(*) from pg_policies where tablename='profiles'")=='3'
 assert run("select relrowsecurity from pg_class where oid='public.profiles'::regclass")=='t'
 check('the three existing ownership policies and enabled RLS remain unchanged')
 print(f'Personal goal PostgreSQL: {len(checks)} groups passed; synthetic auth claims, no hosted/JWT claim.')
finally:
 run('drop database '+db+' with (force)','postgres')
