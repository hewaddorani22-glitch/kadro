#!/usr/bin/env python3
"""Real SQL regression tests. Only a dedicated Unix-socket test cluster is accepted.
Usage: KANDRO_TEST_PG_SOCKET=/tmp/kandro-pg-20260925 KANDRO_TEST_PG_PORT=56329 python3 scripts/validate-meal-sync-postgres.py
Creates/drops its own temporary database, never touches a linked Supabase project.
"""
import os, pathlib, subprocess, json, uuid, concurrent.futures
root = pathlib.Path(__file__).resolve().parents[1]
host = os.environ.get('KANDRO_TEST_PG_SOCKET', '')
assert host.startswith('/tmp/kandro-pg-'), 'Use a dedicated local test cluster; remote hosts are refused'
base = ['psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-h', host, '-p', os.environ.get('KANDRO_TEST_PG_PORT', '56329')]
db = 'kandro_sync_test_' + uuid.uuid4().hex[:10]
def run(sql, database=db, expect=None):
    p = subprocess.run(base + ['-d', database], input=sql, text=True, capture_output=True)
    if expect:
        assert p.returncode and expect in p.stderr, (expect, p.stdout, p.stderr)
        return p.stderr
    assert not p.returncode, p.stderr
    return p.stdout.strip()
def quote(v): return "'" + str(v).replace("'", "''") + "'"
def js(v): return quote(json.dumps(v, separators=(',', ':'))) + '::jsonb'
u = '10000000-0000-4000-8000-000000000001'
v = '10000000-0000-4000-8000-000000000002'
def authenticated(sql, owner=u, expect=None):
    return run(f"begin; set local role authenticated; set local request.jwt.claim.sub={quote(owner)}; {sql}; commit;", expect=expect)
def item(id='a', calories=100):
    return dict(id=id, name='Synthetic item '+id, amount_g=100.5, base_amount_g=100.5, portion_factor=1,
      calories=calories, protein=5, carbs=10, fat=4, fiber=2, confidence='high', optional=False,
      included=True, source_provider='bls', source_reference_id='TEST', source_label='Synthetic fixture',
      nutrition_per_100g=dict(calories=99.5,protein=4.95,carbs=9.9,fat=3.98,fiber=1.99),
      portions=[dict(label='Test portion',grams=75.5,estimated=True)],source_estimated_reference=True)
def meal(id, items):
    return dict(id=id,title='Synthetic meal',meal_type='Lunch',eaten_at='2026-09-25T12:00:00Z',meal_date='2026-09-25',
      saved_at='2026-09-25T12:00:00Z',origin='plan',confidence='high',
      **{k:sum(i[k] for i in items if i['included']) for k in ['calories','protein','carbs','fat','fiber']})
def call(id, items, rev=0, mutation=None, op='save', ancestors=None, owner=u, expected=None, parent=None):
    mutation = mutation or str(uuid.uuid4())
    p = parent or (meal(id,items) if op=='save' else dict(id=id))
    sql = f"select public.mutate_meal_v2('{expected or owner}','{mutation}',{rev},ARRAY[{','.join(quote(a) for a in (ancestors or []))}]::uuid[],{quote(op)},{js(p)},{js(items)})"
    return sql, mutation
checks=[]
def check(name, fn):
    fn(); checks.append(name); print('PASS',name,flush=True)
run(f'create database {db}', database='postgres')
try:
    run("do $$ begin create role anon; exception when duplicate_object then null; end $$; do $$ begin create role authenticated; exception when duplicate_object then null; end $$;")
    run("create schema auth; create schema private; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated, anon; grant execute on function auth.uid() to authenticated,anon;")
    for name in ['20260831111459_day3_core_schema.sql','20260901150000_harden_nutrition_sources.sql','20260901160000_allow_planned_meals.sql','20260905141007_meal_item_decimal_grams.sql','20260925142154_atomic_meal_sync.sql','20260926221131_meal_portion_factor_range.sql']:
        matches=list((root/'supabase/migrations').glob(name[:14]+'*')); assert len(matches)==1, name
        run(matches[0].read_text())
    run(f"insert into auth.users values('{u}'),('{v}')")
    for index,(amount,reference) in enumerate([(150,5),(1,5000),(5000,1),(70,100),(100,100),(140,100)]):
        scaled={**item(id='factor-item-'+str(index)),'amount_g':amount,'base_amount_g':reference,'portion_factor':amount/reference}
        rpc,mid=call('factor-'+str(index),[scaled]);ack=json.loads(authenticated(rpc))
        assert json.loads(authenticated(rpc))['status']=='duplicate'
        stored=json.loads(authenticated("select row_to_json(i) from meal_items i where meal_id='factor-"+str(index)+"'"))
        assert stored['amount_g']==amount and stored['base_amount_g']==reference
        assert abs(stored['portion_factor']-amount/reference)<0.000001
    check('full gram-editor ratio range and standard portions persist with idempotent retries',lambda:None)
    for factor in [0,-1,5001,'NaN','Infinity']:
        rpc,_=call('invalid-factor',[{**item(),'portion_factor':factor}])
        authenticated(rpc,expect='constraint' if factor!='Infinity' else 'overflow')
        assert authenticated("select count(*) from meals where id='invalid-factor'")=='0'
    check('invalid portion factors still roll back the whole meal',lambda:None)
    a,b=item(),item('b',200)
    sql,mid=call('m',[a,b]); ack=json.loads(authenticated(sql)); rev=ack['revision']
    check('create complete meal and metadata',lambda: exec("assert json.loads(run(\"select nutrition_per_100g from meal_items where id='a'\")) == a['nutrition_per_100g']; assert run(\"select amount_g from meal_items where id='a'\") == '100.5'"))
    duplicate=json.loads(authenticated(sql)); assert duplicate['status']=='duplicate' and duplicate['revision']==rev
    check('identical retry is idempotent',lambda: None)
    reused,_=call('m',[a],rev,mid); authenticated(reused,expect='meal_mutation_id_reused')
    before=run("select row_to_json(m) from meals m where id='m'") + run("select json_agg(i order by id) from meal_items i where meal_id='m'") + run("select row_to_json(s) from private.meal_sync_state s where meal_id='m'")
    bad={**a,'name':''}; broken,_=call('m',[bad],rev); authenticated(broken,expect='check constraint')
    after=run("select row_to_json(m) from meals m where id='m'") + run("select json_agg(i order by id) from meal_items i where meal_id='m'") + run("select row_to_json(s) from private.meal_sync_state s where meal_id='m'")
    assert before==after
    check('child failure rolls back parent children and revision ledger',lambda: None)
    update,updateid=call('m',[a],rev); rev2=json.loads(authenticated(update))['revision']
    assert run("select count(*) from meal_items where meal_id='m'")=='1'
    assert run("select calories from meals where id='m'")=='100'
    check('removing an ingredient removes its cloud row',lambda: None)
    stale,_=call('m',[b],rev); authenticated(stale,expect='meal_revision_conflict')
    check('stale second device cannot overwrite newer data',lambda: None)
    chained,_=call('m',[b],rev,ancestors=[updateid]); rev3=json.loads(authenticated(chained))['revision']
    empty,_=call('m',[],rev3); rev4=json.loads(authenticated(empty))['revision']
    assert run("select count(*) from meal_items where meal_id='m'")=='0'
    assert run("select calories from meals where id='m'")=='0'
    check('acknowledgement lost: descendant edit and empty replacement',lambda: None)
    # Real concurrent SQL connections using the same expected revision.
    one,_=call('race',[a]); two,_=call('race',[b])
    def run_concurrent(sql):
        try: return ('ok',authenticated(sql))
        except AssertionError as e: return ('error',str(e))
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        results=list(pool.map(run_concurrent,[one,two]))
    assert sorted(x[0] for x in results)==['error','ok'], results
    assert 'meal_revision_conflict' in next(x[1] for x in results if x[0]=='error')
    check('two concurrent database sessions: one wins, one explicit conflict',lambda: None)
    # Legacy writes invalidate optimistic revisions; deletion tombstones apply to both clients.
    authenticated("update meals set title='Legacy edit' where id='m'")
    authenticated(call('m',[a],rev4)[0],expect='meal_revision_conflict')
    authenticated("delete from meals where id='m'")
    authenticated(call('m',[a],rev4)[0],expect='meal_deleted')
    assert json.loads(authenticated(f"select to_json(public.deleted_meal_ids('{u}',ARRAY['m','race']))"))==['m']
    check('legacy edit advances revision and legacy deletion prevents resurrection',lambda: None)
    r=int(run("select cloud_revision from meals where id='race'")); delete,delid=call('race',[],r,op='delete')
    assert json.loads(authenticated(delete))['deleted'] is True
    assert json.loads(authenticated(delete))['status']=='duplicate'
    check('delete retry stays deleted and idempotent',lambda: None)
    # Identity is exclusively taken from auth.uid(), never arbitrary payload user_id.
    sql,_=call('identity',[a],owner=v,expected=u); authenticated(sql,owner=v,expect='cloud_identity_changed')
    sql,_=call('private',[a]); authenticated(sql)
    assert authenticated("select count(*) from meals where id='private'",owner=v)=='0'
    authenticated("select * from private.meal_sync_state",expect='permission denied')
    run('begin; set local role anon; '+sql+'; rollback;',expect='permission denied')
    check('RLS, private ledger, anonymous denial and account-switch guards',lambda: None)
    run(f"delete from auth.users where id='{u}'")
    assert run(f"select count(*) from meals where user_id='{u}'")=='0'
    assert run(f"select count(*) from private.meal_sync_state where user_id='{u}'")=='0'
    check('account deletion cascades without orphaned sync state',lambda: None)
    # Function exposure and search paths are checked on the actual created functions.
    assert run("select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('mutate_meal_v2','deleted_meal_ids') and p.prosecdef")=='0'
    assert run("select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.prosecdef and not coalesce(p.proconfig @> ARRAY['search_path=\"\"'],false)")=='0'
    check('public wrappers invoker-only; private definers use empty search paths',lambda: None)
    if os.environ.get('KANDRO_TEST_ADVISORS') == '1':
        uri = 'postgresql:///' + db + '?host=' + host.replace('/','%2F') + '&port=' + os.environ.get('KANDRO_TEST_PG_PORT','56329')
        result=subprocess.run([str(root/'node_modules/.bin/supabase'),'db','advisors','--db-url',uri,'--type','all','--output-format','json'],text=True,capture_output=True,timeout=60)
        print('ADVISORS',result.returncode,result.stdout,result.stderr)
    print(json.dumps({'passed':len(checks),'checks':checks,'scope':'isolated PostgreSQL, synthetic auth.uid; no live Supabase or PostgREST'},indent=2))
finally:
    run(f'drop database {db} with (force)', database='postgres')
