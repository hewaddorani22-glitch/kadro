\set ON_ERROR_STOP on
-- Run only on the dedicated local QA PostgreSQL instance. Everything rolls back.
begin;
create schema if not exists auth;
-- The minimal stub is created only on QA instances without the Auth schema.
create table if not exists auth.users (id uuid primary key);
\ir ../supabase/migrations/20261004225818_apple_account_token_lifecycle.sql
insert into auth.users (id) values ('a9900000-0000-4000-8000-000000000001');
set local role service_role;
do $$
begin
  for attempt in 1..10 loop
    if not public.claim_apple_token_exchange('a9900000-0000-4000-8000-000000000001') then raise exception 'early rate limit'; end if;
  end loop;
  if public.claim_apple_token_exchange('a9900000-0000-4000-8000-000000000001') then raise exception 'rate limit bypassed'; end if;
  update public.apple_account_tokens set
    apple_subject = 'synthetic-subject', client_id = 'com.hewaddorani.kandro',
    refresh_token_ciphertext = repeat('A', 32), refresh_token_iv = repeat('A', 16), authorization_code_hash = repeat('0',64)
  where user_id = 'a9900000-0000-4000-8000-000000000001';
  if (select exchange_attempts <> 10 from public.apple_account_tokens where user_id = 'a9900000-0000-4000-8000-000000000001') then raise exception 'token write reset rate counter'; end if;
  begin
    update public.apple_account_tokens set client_id = null where user_id = 'a9900000-0000-4000-8000-000000000001';
    raise exception 'incomplete token accepted';
  exception when check_violation then null;
  end;
  update public.apple_account_tokens set exchange_window_started_at = now() - interval '61 minutes' where user_id = 'a9900000-0000-4000-8000-000000000001';
  if not public.claim_apple_token_exchange('a9900000-0000-4000-8000-000000000001') then raise exception 'new rate window blocked'; end if;
  if (select exchange_attempts <> 1 from public.apple_account_tokens where user_id = 'a9900000-0000-4000-8000-000000000001') then raise exception 'new window did not start at one'; end if;
end;
$$;
reset role;
set local role authenticated;
do $$
begin
  begin perform * from public.apple_account_tokens; raise exception 'client read exposed'; exception when insufficient_privilege then null; end;
  begin insert into public.apple_account_tokens(user_id) values ('a9900000-0000-4000-8000-000000000001'); raise exception 'client insert exposed'; exception when insufficient_privilege then null; end;
  begin update public.apple_account_tokens set apple_subject='attacker'; raise exception 'client update exposed'; exception when insufficient_privilege then null; end;
  begin delete from public.apple_account_tokens; raise exception 'client delete exposed'; exception when insufficient_privilege then null; end;
  begin perform public.claim_apple_token_exchange('a9900000-0000-4000-8000-000000000001'); raise exception 'client RPC exposed'; exception when insufficient_privilege then null; end;
end;
$$;
reset role;
set local role anon;
do $$
begin
  begin perform * from public.apple_account_tokens; raise exception 'anonymous read exposed'; exception when insufficient_privilege then null; end;
  begin perform public.claim_apple_token_exchange('a9900000-0000-4000-8000-000000000001'); raise exception 'anonymous RPC exposed'; exception when insufficient_privilege then null; end;
end;
$$;
reset role;
do $$
begin
  if not (select relrowsecurity from pg_class where oid='public.apple_account_tokens'::regclass) then raise exception 'RLS disabled'; end if;
  if exists(select 1 from pg_policies where schemaname='public' and tablename='apple_account_tokens') then raise exception 'unexpected token policy'; end if;
  if (select prosecdef from pg_proc where oid='public.claim_apple_token_exchange(uuid)'::regprocedure) then raise exception 'unexpected definer function'; end if;
end;
$$;
delete from auth.users where id='a9900000-0000-4000-8000-000000000001';
do $$ begin if exists(select 1 from public.apple_account_tokens) then raise exception 'token not deleted with account'; end if; end; $$;
rollback;
\echo PASS Apple-token SQL: service-only rights, actual client denial, RLS, invoker, constraints, 10/hour limit and account cascade; rolled back.
