#!/usr/bin/env python3
"""QA provenance and unchanged expiry/access behavior in an isolated local clone."""
import json, os, pathlib, re, subprocess, uuid

root = pathlib.Path(__file__).resolve().parents[1]
host = os.environ.get('KANDRO_TEST_PG_SOCKET', '')
assert host == '127.0.0.1' or host.startswith('/tmp/kandro-pg-') or (host.startswith('/Users/') and host.endswith('/pgsocket')), 'Dedicated local PG only'
port = os.environ.get('KANDRO_TEST_PG_PORT', '56329')
template = os.environ.get('KANDRO_TEST_PG_TEMPLATE', '')
assert re.fullmatch(r'kandro_[a-z0-9_]+', template), 'Explicit local Kandro fixture template required'
database = 'kandro_qa_source_test_' + uuid.uuid4().hex[:10]
base = ['psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-h', host, '-p', port]
def run(sql, db=database, error=None):
    result = subprocess.run(base + ['-d', db], input=sql, text=True, capture_output=True)
    if error:
        assert result.returncode and error in result.stderr, result.stderr
        return
    assert result.returncode == 0, result.stderr
    return result.stdout.strip()

run('create database ' + database + ' template ' + template, 'postgres')
checks = []
def check(name):
    checks.append(name)
    print('PASS', name, flush=True)

try:
    fixtures = {}
    definitions = [
        ('expired_a_over_b', 'B', 'A', '-1 hour', 'testflight', False),
        ('active_a_over_b', 'B', 'A', '1 hour', 'testflight', False),
        ('expired_b_over_a', 'A', 'B', '-1 hour', 'review', False),
        ('active_b_over_a', 'A', 'B', '1 hour', 'local', False),
        ('expired_qa_with_pro', 'B', 'A', '-1 hour', 'testflight', True),
        ('public_b', 'B', None, None, None, False),
        ('public_pro', 'B', None, None, None, True),
        ('expired_unassigned', None, 'B', '-1 hour', 'local', False),
    ]
    for name, assignment, qa_variant, duration, environment, pro in definitions:
        user = str(uuid.uuid4()); fixtures[name] = user
        run(f"insert into auth.users(id) values('{user}'); insert into public.analysis_access(user_id,entitlement_active,entitlement_checked_at,entitlement_expires_at) values('{user}',{'true' if pro else 'false'},now(),now()+interval '1 day');")
        if assignment:
            run(f"insert into private.paywall_assignments(user_id,variant,reason) values('{user}','{assignment}','eligible')")
        if qa_variant:
            run(f"insert into private.paywall_qa_accounts(user_id,variant,environment,purpose,expires_at) values('{user}','{qa_variant}','{environment}','Synthetic local regression',now()+interval '{duration}')")
    run("update private.paywall_config set enforcement_enabled=true,public_enabled=false where experiment='paywall_access_v1'")
    def records():
        return {name: json.loads(run(f"select public.resolve_paywall_access_v1('{user}')")) for name, user in fixtures.items()}
    before = records()
    assert before['expired_a_over_b']['source'] == 'public', 'Baseline must reproduce lost QA provenance before migration'
    data_before = run("select jsonb_agg(a order by user_id) from private.paywall_assignments a")
    run((root / 'supabase/migrations/20261004150033_preserve_paywall_qa_measurement_source.sql').read_text())
    after = records()
    for name, record in after.items():
        original = {k: v for k, v in before[name].items() if k not in ('source', 'environment')}
        updated = {k: v for k, v in record.items() if k not in ('source', 'environment')}
        assert updated == original, (name, original, updated)
    assert run("select jsonb_agg(a order by user_id) from private.paywall_assignments a") == data_before
    check('all functional access fields, original assignments and entitlements are unchanged')
    for name, _assignment, qa_variant, _duration, environment, _pro in definitions:
        if qa_variant:
            assert after[name]['source'] == 'qa' and after[name]['environment'] == environment, (name, after[name])
        else:
            assert after[name]['source'] == 'public' and after[name]['environment'] == 'production'
    check('active and expired QA remain QA; genuine public accounts remain public')
    assert after['expired_a_over_b']['variant'] == 'B' and after['expired_a_over_b']['hard'] and after['expired_a_over_b']['access'] == 'inactive'
    assert after['active_a_over_b']['variant'] == 'A' and not after['active_a_over_b']['hard'] and after['active_a_over_b']['access'] == 'free'
    assert after['expired_b_over_a']['variant'] == 'A' and after['expired_b_over_a']['access'] == 'free'
    assert after['active_b_over_a']['variant'] == 'B' and after['active_b_over_a']['access'] == 'inactive'
    check('only live QA overrides variant: expired free QA cannot bypass ordinary B enforcement')
    assert after['expired_qa_with_pro']['variant'] == 'B' and after['expired_qa_with_pro']['access'] == 'active'
    assert after['public_pro']['access'] == 'active'
    assert after['expired_unassigned']['variant'] == 'unassigned' and after['expired_unassigned']['source'] == 'qa'
    check('purchased rights retain priority; expired QA creates no assignment')
    for role in ['anon', 'authenticated']:
        assert run(f"select has_function_privilege('{role}','private.paywall_access_v1(uuid)','EXECUTE')") == 'f'
        assert run(f"select has_function_privilege('{role}','public.resolve_paywall_access_v1(uuid)','EXECUTE')") == 'f'
    assert run("select has_function_privilege('service_role','private.paywall_access_v1(uuid)','EXECUTE')") == 't'
    assert run("select proconfig @> array['search_path=\"\"'] from pg_proc where oid='private.paywall_access_v1(uuid)'::regprocedure") == 't'
    check('private definer retains empty search_path and service-role-only access')
    print(f'QA source PostgreSQL: {len(checks)}/{len(checks)} groups passed; synthetic local clone only, no hosted claim.')
finally:
    run('drop database ' + database + ' with (force)', 'postgres')
