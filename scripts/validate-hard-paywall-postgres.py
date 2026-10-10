#!/usr/bin/env python3
"""hard_after_first_scan (20261010120000) in an isolated local clone.

Usage: KANDRO_TEST_PG_SOCKET=/tmp/kandro-pg-<name> KANDRO_TEST_PG_PORT=<port> \
  KANDRO_TEST_PG_TEMPLATE=kandro_<name> python3 scripts/validate-hard-paywall-postgres.py
The template must contain every migration up to 20261009100300 (production
state before this change) with the auth/cron stubs used by the other
*-postgres.py validators. Creates and drops its own database; never touches a
linked Supabase project.
"""
import json, os, pathlib, re, subprocess, uuid

root = pathlib.Path(__file__).resolve().parents[1]
host = os.environ.get('KANDRO_TEST_PG_SOCKET', '')
assert host.startswith('/tmp/kandro-pg-'), 'Dedicated local PG only'
port = os.environ.get('KANDRO_TEST_PG_PORT', '56329')
template = os.environ.get('KANDRO_TEST_PG_TEMPLATE', '')
assert re.fullmatch(r'kandro_[a-z0-9_]+', template), 'Explicit local Kandro fixture template required'
database = 'kandro_hard_wall_test_' + uuid.uuid4().hex[:10]
base = ['psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-h', host, '-p', port]
migration = (root / 'supabase/migrations/20261010120000_hard_paywall_after_first_scan.sql').read_text()


def run(sql, db=database, error=None):
    result = subprocess.run(base + ['-d', db], input=sql, text=True, capture_output=True)
    if error:
        assert result.returncode and error in result.stderr, (error, result.stdout, result.stderr)
        return result.stderr
    assert result.returncode == 0, result.stderr
    return result.stdout.strip()


def check(name):
    print('PASS', name, flush=True)


def access(user):
    return json.loads(run(f"select public.resolve_paywall_access_v1('{user}')"))


def reserve(user):
    request = str(uuid.uuid4())
    decision = json.loads(run(f"select public.reserve_analysis_access('{user}','{request}',60,false)"))
    if decision.get('status') == 'reserved':
        run(f"select public.mark_analysis_request_started('{user}','{request}'); select public.complete_analysis_request('{user}','{request}','{{}}'::jsonb)")
    return decision


def meal_sql(user, meal):
    return (f"insert into public.meals(user_id,id,title,meal_type,eaten_at,meal_date,calories,protein,carbs,fat,confidence,origin) "
            f"values('{user}','{meal}','Synthetic meal','Lunch',now(),current_date,500,30,40,20,'high','scan')")


def user(created, entitled=False):
    u = str(uuid.uuid4())
    run(f"insert into auth.users(id,created_at) values('{u}',{created}); insert into public.profiles(user_id,age,privacy_version,wellness_consent_at) values('{u}',25,'2026-09-04-ai-v2',now());")
    if entitled:
        # A running App Store trial gives access in RevenueCat: entitlement_active.
        run(f"insert into public.analysis_access(user_id,entitlement_active,entitlement_checked_at,entitlement_expires_at) values('{u}',true,now(),now()+interval '7 days')")
    return u


run('create database ' + database + ' template ' + template, 'postgres')
try:
    legacy = user("now()-interval '1 day'")
    legacy_b = user("now()-interval '2 days'")
    run(f"insert into private.paywall_assignments(user_id,variant,reason) values('{legacy_b}','B','eligible')")
    before = {u: access(u) for u in (legacy, legacy_b)}
    run(migration)
    config = json.loads(run("select to_jsonb(c) from private.paywall_config c"))
    assert config['hard_after_first_scan'] is True and config['hard_after_first_scan_free_analyses'] == 1
    assert config['hard_after_first_scan_starts_at'], config
    assert config['enforcement_enabled'] is False and config['public_enabled'] is False, 'paused A/B test stays paused'
    cutoff = run("select hard_after_first_scan_starts_at from private.paywall_config")
    run("select pg_sleep(0.01)")
    assert run("select hard_after_first_scan_starts_at from private.paywall_config") == cutoff
    check('mode enabled once with a stored cutoff; A/B test flags untouched')

    for u, record in before.items():
        after = access(u)
        assert after['mode'] == 'legacy' and after['freeAnalyses'] == 3, after
        assert {k: v for k, v in after.items() if k not in ('mode', 'freeAnalyses')} == record, (record, after)
    assert [reserve(legacy)['accessKind'] for _ in range(3)] == ['free'] * 3
    assert reserve(legacy)['status'] == 'verification_required', 'legacy keeps exactly three free analyses'
    for index in range(4):
        run(meal_sql(legacy, f'legacy-{index}'))
    assert not access(legacy)['hard'] and run(f"select count(*) from private.paywall_free_meals where user_id='{legacy}'") == '0'
    check('existing accounts unchanged: legacy mode, 3 free analyses, free meal logging, paused B soft')

    fresh = user('now()')
    record = access(fresh)
    assert record['mode'] == 'hard_after_first_scan' and record['freeAnalyses'] == 1 and not record['hard'] and record['access'] == 'free', record
    assert reserve(fresh)['accessKind'] == 'free'
    assert reserve(fresh)['status'] == 'verification_required', 'exactly one free AI analysis'
    run(f"update public.analysis_access set entitlement_checked_at=now() where user_id='{fresh}'")
    assert reserve(fresh)['status'] == 'subscription_required'
    check('new install: exactly one free analysis, then the subscription is required')

    run(meal_sql(fresh, 'first'))
    record = access(fresh)
    assert record['hard'] and record['access'] == 'inactive' and record['mode'] == 'hard_after_first_scan', record
    run(meal_sql(fresh, 'second'), error='paywall_access_required')
    run("begin; set local role authenticated; set local request.jwt.claim.sub='" + fresh + "'; select public.authorize_meal_create_v1('third'); commit;", error='paywall_access_required')
    run(f"update public.meals set title='Corrected' where user_id='{fresh}' and id='first'")
    run(f"delete from public.meals where user_id='{fresh}' and id='first'")
    assert access(fresh)['hard'], 'deleting the free meal does not return it'
    run(meal_sql(fresh, 'again'), error='paywall_access_required')
    check('after the first saved meal: hard, no further meal or receipt without Pro; own meal stays editable')

    trial = user('now()', entitled=True)
    run(meal_sql(trial, 'first'))
    run(meal_sql(trial, 'second'))
    record = access(trial)
    assert record['hard'] and record['access'] == 'active' and record['validUntil'], record
    assert reserve(trial)['accessKind'] == 'pro'
    run("begin; set local role authenticated; set local request.jwt.claim.sub='" + trial + "'; select public.authorize_meal_create_v1('third'); commit;")
    assert run(f"select count(*) from private.paywall_meal_permits where user_id='{trial}'") == '2'
    check('an active entitlement (App Store trial) unlocks meals, receipts and Pro analyses')

    batch = user('now()')
    run("begin; " + meal_sql(batch, 'a') + "; " + meal_sql(batch, 'b') + "; commit;", error='paywall_access_required')
    assert run(f"select count(*) from public.meals where user_id='{batch}'") == '0'
    run(meal_sql(batch, 'a'))
    check('two meals in one transaction cannot both take the single free meal')

    skipped = user('now()')
    stale = user("now()-interval '1 day'")
    run(f"insert into private.paywall_assignments(user_id,variant,reason,assigned_at) values('{skipped}','excluded','fallback',now()-interval '1 hour')")
    assert access(skipped)['mode'] == 'legacy', 'a pre-cutoff assignment row keeps the legacy scope'
    assert access(stale)['mode'] == 'legacy'
    run(f"insert into private.paywall_qa_accounts(user_id,variant,environment,purpose,expires_at) values('{batch}','A','local','Synthetic hard wall QA',now()+interval '1 hour')")
    assert access(batch)['mode'] == 'legacy' and not access(batch)['hard'], 'a live QA variant keeps its tested terms'
    check('pre-cutoff rows and live QA/A-B variants stay outside the cohort')

    run("update private.paywall_config set hard_after_first_scan=false")
    record = access(fresh)
    assert record['mode'] == 'legacy' and not record['hard'] and record['freeAnalyses'] == 3, record
    run(meal_sql(fresh, 'after-switch-off'))
    run("update private.paywall_config set hard_after_first_scan=true")
    run("update private.paywall_config set hard_after_first_scan_starts_at=null", error='paywall_config_hard_after_first_scan_cutoff')
    check('switching the mode off returns the cohort to the legacy scope; enabled mode needs a cutoff')

    run(f"delete from auth.users where id='{fresh}'")
    assert run(f"select count(*) from private.paywall_free_meals where user_id='{fresh}'") == '0'
    for role in ['anon', 'authenticated']:
        assert run(f"select has_table_privilege('{role}','private.paywall_free_meals','SELECT')") == 'f'
        assert run(f"select has_function_privilege('{role}','private.paywall_access_v1(uuid)','EXECUTE')") == 'f'
    assert run("select relrowsecurity from pg_class where oid='private.paywall_free_meals'::regclass") == 't'
    assert run("select proconfig @> array['search_path=\"\"'] from pg_proc where oid='private.paywall_access_v1(uuid)'::regprocedure") == 't'
    check('free-meal record is private, RLS-protected and deleted with the account')

    run(migration, error='paywall_functions_changed_before_hard_after_first_scan')
    check('md5 drift guard refuses to run twice or over changed functions')
finally:
    run('drop database if exists ' + database, 'postgres')
