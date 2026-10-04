#!/usr/bin/env python3
"""New capture gates on actual PostgreSQL; synthetic auth.uid, never remote."""
import os,pathlib,subprocess,json,uuid,concurrent.futures
root=pathlib.Path(__file__).resolve().parents[1]
host=os.environ.get('KANDRO_TEST_PG_SOCKET','')
assert host.startswith('/tmp/kandro-pg-'),'Dedicated local Unix socket required'
base=['psql','-X','-qAt','-v','ON_ERROR_STOP=1','-h',host,'-p',os.environ.get('KANDRO_TEST_PG_PORT','56329')]
db='kandro_capture_test_'+uuid.uuid4().hex[:10]
def run(sql,database=db,denied=False):
 p=subprocess.run(base+['-d',database],input=sql,text=True,capture_output=True)
 if denied: assert p.returncode and 'permission denied' in p.stderr,p.stderr;return
 assert not p.returncode,p.stderr
 return p.stdout.strip()
u=str(uuid.uuid4());v=str(uuid.uuid4());fp='a'*64;network='b'*64
checks=[]
def check(name):checks.append(name);print('PASS',name,flush=True)
def call(name,id,kind='search',fingerprint=fp,owner=u):return f"select public.{name}('{owner}','{id}','{kind}','{fingerprint}','{network}')"
def service(sql):return run('begin;set local role service_role;'+sql+';commit;')
run('create database '+db,'postgres')
try:
 run("do $$begin create role service_role bypassrls;exception when duplicate_object then null;end$$;do $$begin create role authenticated;exception when duplicate_object then null;end$$;do $$begin create role anon;exception when duplicate_object then null;end$$;create schema auth;create schema private;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant usage on schema private to service_role;")
 run((root/'supabase/migrations/20261001140808_capture_ai_candidate_gates.sql').read_text())
 run(f"insert into auth.users values('{u}'),('{v}')")
 id=str(uuid.uuid4());assert json.loads(service(call('lookup_capture_operation',id)))['status']=='missing'
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:out=list(pool.map(lambda _:json.loads(service(call('reserve_capture_operation',id)))['status'],range(2)))
 assert sorted(out)==['claimed','request_completed'];check('simultaneous claims permit exactly one provider operation')
 result='{"status":200,"body":{"correctionRequired":true,"items":[]}}'
 assert json.loads(service(f"select public.finish_capture_operation('{u}','{id}','{result}'::jsonb)"))['status']=='completed'
 assert json.loads(service(call('lookup_capture_operation',id)))['result']==json.loads(result)
 assert json.loads(service(call('reserve_capture_operation',str(uuid.uuid4()))))['status']=='replay'
 assert json.loads(service(call('reserve_capture_operation',id,fingerprint='c'*64)))['status']=='mismatch'
 assert json.loads(service(f"select public.finish_capture_operation('{u}','{id}','{{}}'::jsonb)"))['status']=='unchanged';check('immutable receipts replay correction/errors, changed payloads rejected, new-ID identical search deduplicated')
 for i in range(4):assert json.loads(service(call('reserve_capture_operation',str(uuid.uuid4()),fingerprint=f'{i:064x}')))['status']=='claimed'
 assert json.loads(service(call('reserve_capture_operation',str(uuid.uuid4()),fingerprint='d'*64)))['status']=='rate_limited'
 assert json.loads(service(call('reserve_capture_operation',str(uuid.uuid4()),kind='analysis',fingerprint='d'*64)))['status']=='claimed';check('five daily search operations bounded separately from photo/text allowance')
 for role in ['anon','authenticated']:
  run('set role '+role+';'+call('reserve_capture_operation',str(uuid.uuid4())),denied=True)
  run('set role '+role+';select * from private.capture_operations',denied=True)
 check('untrusted roles cannot reserve or inspect operation ledger')
 service(f"insert into public.capture_ai_consents(user_id,version) values('{u}','2026-10-01-gemini-candidate-v1')")
 def auth(owner,sql):return run(f"begin;set local role authenticated;set local request.jwt.claim.sub='{owner}';{sql};commit;")
 assert auth(u,'select count(*) from public.capture_ai_consents')=='1';assert auth(v,'select count(*) from public.capture_ai_consents')=='0'
 run(f"set role authenticated;insert into public.capture_ai_consents(user_id,version) values('{v}','2026-10-01-gemini-candidate-v1')",denied=True)
 assert run('select scopes::text from public.capture_ai_consents')=='{search}';check('consent is owner-readable, server-written and scope-specific')
 run("update private.capture_operations set created_at=now()-interval '23 hours'")
 service('select private.cleanup_capture_operations()');assert run('select count(*) from private.capture_operations where result is not null')=='0'
 assert json.loads(service(call('lookup_capture_operation',id)))['status']=='request_completed';check('retention removes meal receipts without immediately reopening costly operation')
 run(f"delete from auth.users where id='{u}'");assert run('select count(*) from private.capture_operations')=='0';assert run('select count(*) from public.capture_ai_consents')=='0';check('account deletion cascades both new tables')
 assert run("select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef")=='0';check('no exposed SECURITY DEFINER functions')
 if os.environ.get('KANDRO_TEST_ADVISORS')=='1':
  uri='postgresql:///'+db+'?host='+host.replace('/','%2F')+'&port='+os.environ.get('KANDRO_TEST_PG_PORT','56329')
  advisors=subprocess.run([str(root/'node_modules/.bin/supabase'),'db','advisors','--db-url',uri,'--type','all','--output-format','json'],capture_output=True,text=True,timeout=60)
  print('ADVISORS',advisors.returncode,advisors.stdout,advisors.stderr,flush=True)
 print(json.dumps({'passed':len(checks),'scope':'real isolated PostgreSQL, synthetic auth.uid; not JWT/PostgREST'},indent=2))
finally:run('drop database '+db+' with (force)','postgres')
