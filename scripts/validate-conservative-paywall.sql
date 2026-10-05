-- Execute only on an owned local clone after the conservative migration.
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
 if r->>'variant'<>'excluded' or r->>'access'<>'free' or r->>'reason'<>'identity' then raise exception 'anonymous enrollment'; end if;
 update auth.users set is_anonymous=false,email_confirmed_at=now() where id=u;
 r:=pg_temp.enroll(u); if r->>'variant'<>'excluded' then raise exception 'linking enrolled existing free account'; end if;
 u:=pg_temp.fixture(false,18,false,false);r:=pg_temp.enroll(u);if r->>'reason'<>'identity' then raise exception 'unverified identity';end if;
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
 -- A known old-client first use stays excluded after later linking/enrollment.
 u:=pg_temp.fixture();perform public.record_paywall_prior_use_v1(u);r:=pg_temp.enroll(u);if r->>'variant'<>'excluded' then raise exception 'old-client prior use';end if;
 -- Pausing new assignment does not remove existing Pro or rewrite the cohort.
 update private.paywall_config set public_enabled=false where experiment='paywall_access_v1';
 u:=pg_temp.fixture();update public.analysis_access set entitlement_active=true,entitlement_expires_at=now()+interval '1 day' where user_id=u;
 r:=pg_temp.enroll(u);if r->>'variant'<>'excluded' or r->>'access'<>'active' then raise exception 'pause removed Pro';end if;
end $$;
select 'PASS anonymous, unverified, age17, old account, prior analysis, first-use, trial eligibility/duration/product, active rights, stable original variant, prior client and pause';
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
