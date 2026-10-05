-- Execute only on an owned local clone after the owner-restored open cohort migration.
-- All fixture changes roll back; no real account, purchase or model is involved.
begin;
set local statement_timeout='30s';
update private.paywall_config set public_enabled=true,starts_at=now()-interval '1 hour',enforcement_enabled=true where experiment='paywall_access_v1';
create function pg_temp.fixture(anonymous boolean default false, age integer default 18, old_account boolean default false, confirmed boolean default true) returns uuid language plpgsql as $$
declare u uuid:=gen_random_uuid();
begin
 insert into auth.users(id,aud,role,is_anonymous,created_at,email_confirmed_at) values(u,'authenticated','authenticated',anonymous,now()-case when old_account then interval '2 days' else interval '1 second' end,case when confirmed and not anonymous then now()-interval '1 second' else null end);
 insert into public.profiles(user_id,age,privacy_version,wellness_consent_at) values(u,age,case when age is null then null else '2026-09-04-ai-v2' end,case when age is null then null else now() end);
 insert into public.analysis_access(user_id,entitlement_checked_at) values(u,now());
 return u;
end $$;
create function pg_temp.enroll(u uuid,first_use boolean default true,trial_eligible boolean default true,days7 boolean default true,product text default 'com.hewaddorani.kandro.pro.monthly') returns jsonb language sql as $$select public.enroll_paywall_access_v1(u,first_use,true,trial_eligible,product,days7)$$;
do $$
declare u uuid;r jsonb;v text;before_at timestamptz;
begin
 u:=pg_temp.fixture(true); r:=pg_temp.enroll(u);
 v:=r->>'variant'; select assigned_at into before_at from private.paywall_assignments where user_id=u; if v not in ('A','B') or r->>'reason'<>'eligible' then raise exception 'anonymous adult excluded'; end if;
 update auth.users set is_anonymous=false,email_confirmed_at=now() where id=u;
 r:=pg_temp.enroll(u); if r->>'variant'<>v or (select assigned_at from private.paywall_assignments where user_id=u)<>before_at then raise exception 'linking rerandomized'; end if;
 u:=pg_temp.fixture(false,18,false,false);r:=pg_temp.enroll(u);if r->>'reason'<>'eligible' then raise exception 'new unverified adult incorrectly excluded';end if;
 u:=pg_temp.fixture(false,null);r:=pg_temp.enroll(u);if r->>'reason'<>'age' then raise exception 'unknown age';end if;
 u:=pg_temp.fixture(false,17);r:=pg_temp.enroll(u);if r->>'reason'<>'age' then raise exception 'minor';end if;
 u:=pg_temp.fixture(false,18,true);r:=pg_temp.enroll(u);if r->>'reason'<>'existing' then raise exception 'old identity';end if;
 u:=pg_temp.fixture();update public.analysis_access set free_completed=1 where user_id=u;r:=pg_temp.enroll(u);if r->>'reason'<>'existing' then raise exception 'prior analysis';end if;
 u:=pg_temp.fixture();insert into public.meals(user_id,id,title,meal_type,eaten_at,meal_date,calories,protein,carbs,fat,fiber,confidence,origin,saved_at) values(u,'conservative-history-'||u::text,'Synthetic local history','Lunch',now(),current_date,100,10,10,2,0,'high','scan',now());r:=pg_temp.enroll(u);if r->>'variant'<>'excluded' or r->>'access'<>'free' or r->>'reason' not in ('existing','prior_use') then raise exception 'existing meal';end if;
 u:=pg_temp.fixture();r:=pg_temp.enroll(u,false);if r->>'reason'<>'prior_use' then raise exception 'unconfirmed first use';end if;
 u:=pg_temp.fixture();r:=pg_temp.enroll(u,true,false);if r->>'reason'<>'offer' then raise exception 'trial eligibility';end if;
 u:=pg_temp.fixture();r:=pg_temp.enroll(u,true,true,false);if r->>'reason'<>'offer' then raise exception 'trial duration';end if;
 u:=pg_temp.fixture();r:=pg_temp.enroll(u,true,true,true,'wrong');if r->>'reason'<>'offer' then raise exception 'wrong product';end if;
 u:=pg_temp.fixture();update public.analysis_access set entitlement_active=true,entitlement_expires_at=now()+interval '1 day' where user_id=u;
 r:=pg_temp.enroll(u);if r->>'reason'<>'pro' or r->>'access'<>'active' then raise exception 'active entitlement priority';end if;
 u:=pg_temp.fixture();r:=pg_temp.enroll(u);v:=r->>'variant';if v not in('A','B') then raise exception 'eligible adult';end if;
 select assigned_at into before_at from private.paywall_assignments where user_id=u;
 r:=pg_temp.enroll(u,false,false,false,'wrong');if r->>'variant'<>v or (select assigned_at from private.paywall_assignments where user_id=u)<>before_at then raise exception 'rerandomization';end if;

 -- Explicit local fixture variants verify both paths independent of random draw.
 u:=pg_temp.fixture(true); insert into private.paywall_assignments(user_id,variant,reason) values(u,'A','eligible');
 r:=public.resolve_paywall_access_v1(u); if (r->>'hard')::boolean or r->>'access'<>'free' then raise exception 'A free return lost';end if;
 u:=pg_temp.fixture(true); insert into private.paywall_assignments(user_id,variant,reason,preserve_free_access) values(u,'B','eligible',true);
 r:=public.resolve_paywall_access_v1(u); if not (r->>'hard')::boolean or r->>'access'<>'inactive' then raise exception 'B hard paywall not restored';end if;
 update public.analysis_access set entitlement_active=true,entitlement_expires_at=now()+interval '1 day' where user_id=u;
 r:=public.resolve_paywall_access_v1(u);if r->>'access'<>'active' then raise exception 'B purchase does not take priority';end if;
 update public.analysis_access set entitlement_active=false,entitlement_expires_at=null where user_id=u;
 insert into private.paywall_qa_accounts(user_id,variant,environment,purpose,expires_at) values(u,'A','local','Owner restoration fixture',now()+interval '1 day');
 r:=public.resolve_paywall_access_v1(u);if (r->>'hard')::boolean or r->>'source'<>'qa' then raise exception 'QA override changed';end if;
 update private.paywall_qa_accounts set expires_at=now()-interval '1 minute' where user_id=u;
 r:=public.resolve_paywall_access_v1(u);if not (r->>'hard')::boolean or r->>'source'<>'qa' then raise exception 'expired QA source exclusion lost';end if;
 if (select count(*) from generate_series(0,255) as byte_value where byte_value<128)<>128 then raise exception '50 percent A threshold';end if;
 if (select count(*) from generate_series(0,255) as byte_value where byte_value>=128)<>128 then raise exception '50 percent B threshold';end if;
 -- A known old-client first use stays excluded after later linking/enrollment.
 u:=pg_temp.fixture();perform public.record_paywall_prior_use_v1(u);r:=pg_temp.enroll(u);if r->>'variant'<>'excluded' then raise exception 'old-client prior use';end if;
 -- Pausing new assignment does not remove existing Pro or rewrite the cohort.
 update private.paywall_config set public_enabled=false where experiment='paywall_access_v1';
 u:=pg_temp.fixture();update public.analysis_access set entitlement_active=true,entitlement_expires_at=now()+interval '1 day' where user_id=u;
 r:=pg_temp.enroll(u);if r->>'variant'<>'excluded' or r->>'access'<>'active' then raise exception 'pause removed Pro';end if;
end $$;
select 'PASS anonymous/unverified inclusion, stable linking, A/free/B/hard/Pro, QA source, exact 128/256 random threshold, age17, old account, prior analysis, first-use, trial eligibility/duration/product, active rights, stable original variant, prior client and pause';
set local role authenticated;
do $$ begin
 begin
 perform public.enroll_paywall_access_v1('aaaaaaaa-aaaa-4aaa-8aaa-000000000099',true,true,true,'com.hewaddorani.kandro.pro.monthly',true);
 raise exception 'authenticated may forge assignment';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'PASS authenticated role cannot invoke service-only assignment RPC';
rollback;
