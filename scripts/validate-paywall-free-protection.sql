-- Owned local test database only. All fixtures roll back; no real account/Apple/purchase.
begin;
set local statement_timeout='30s';
create function pg_temp.protected_fixture(protected boolean, anonymous boolean default true) returns uuid language plpgsql as $$
declare u uuid:=gen_random_uuid();
begin
 insert into auth.users(id,aud,role,is_anonymous,created_at,email_confirmed_at) values(u,'authenticated','authenticated',anonymous,now(),case when anonymous then null else now() end);
 insert into public.profiles(user_id,age,privacy_version,wellness_consent_at) values(u,30,'2026-09-04-ai-v2',now());
 insert into public.analysis_access(user_id,entitlement_checked_at,free_completed) values(u,now(),3);
 insert into private.paywall_assignments(user_id,variant,reason,preserve_free_access) values(u,'B','eligible',protected);
 return u;
end $$;
do $$
declare u uuid; r jsonb; original_date timestamptz; original_quota public.analysis_access%rowtype;
begin
 u:=pg_temp.protected_fixture(true);
 select assigned_at into original_date from private.paywall_assignments where user_id=u;
 select * into original_quota from public.analysis_access where user_id=u;
 r:=public.resolve_paywall_access_v1(u);
 if r->>'variant'<>'B' or (r->>'hard')::boolean or r->>'access'<>'free' or r->>'source'<>'public' then raise exception 'protected anonymous B not free';end if;
 update auth.users set is_anonymous=false,email_confirmed_at=now() where id=u;
 r:=public.enroll_paywall_access_v1(u,false,false,false,'wrong',false);
 if r->>'variant'<>'B' or (r->>'hard')::boolean or r->>'access'<>'free' then raise exception 'later linking reactivated hard paywall';end if;
 if (select assigned_at from private.paywall_assignments where user_id=u)<>original_date or (select reason from private.paywall_assignments where user_id=u)<>'eligible' then raise exception 'original denominator rewritten';end if;
 if (select to_jsonb(a) from public.analysis_access a where user_id=u)<>to_jsonb(original_quota) then raise exception 'free access changed AI quota or Pro';end if;
 update public.analysis_access set entitlement_active=true,entitlement_expires_at=now()+interval '1 day' where user_id=u;
 r:=public.resolve_paywall_access_v1(u);if r->>'access'<>'active' then raise exception 'purchased rights lost';end if;
 insert into private.paywall_qa_accounts(user_id,variant,environment,purpose,expires_at) values(u,'B','local','Synthetic sticky free protection QA',now()+interval '1 day');
 r:=public.resolve_paywall_access_v1(u);if not (r->>'hard')::boolean or r->>'access'<>'active' or r->>'source'<>'qa' then raise exception 'explicit active QA override broken';end if;
 update private.paywall_qa_accounts set expires_at=now()-interval '1 minute' where user_id=u;
 update public.analysis_access set entitlement_active=false,entitlement_expires_at=null where user_id=u;
 r:=public.resolve_paywall_access_v1(u);if (r->>'hard')::boolean or r->>'access'<>'free' or r->>'source'<>'qa' then raise exception 'expired QA lost sticky protection or measurement provenance';end if;
 u:=pg_temp.protected_fixture(false,false);
 r:=public.resolve_paywall_access_v1(u);if not (r->>'hard')::boolean or r->>'access'<>'inactive' then raise exception 'nonprotected verified B lost hard paywall';end if;
 update public.analysis_access set entitlement_active=true,entitlement_expires_at=now()+interval '1 day' where user_id=u;
 r:=public.resolve_paywall_access_v1(u);if r->>'access'<>'active' then raise exception 'normal B purchased rights lost';end if;
end $$;
select 'PASS sticky free access, unchanged B denominator/date, later linking, unchanged AI quota, active Pro, active/expired QA, ordinary verified B';
set local role authenticated;
do $$ begin
 begin
 update private.paywall_assignments set preserve_free_access=true;
 raise exception 'client can grant free protection';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'PASS client cannot grant its own free-protection flag';
rollback;
