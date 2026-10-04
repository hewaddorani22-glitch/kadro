-- Local candidate only. Does not activate a provider or change existing consent.
begin;
create table public.capture_ai_consents (
 user_id uuid primary key references auth.users(id) on delete cascade,
 version text not null check (version = '2026-10-01-gemini-candidate-v1'),
 scopes text[] not null default ARRAY['search']::text[] check(cardinality(scopes)>0 and scopes <@ ARRAY['search','analysis']::text[]),
 accepted_at timestamptz not null default now()
);
alter table public.capture_ai_consents enable row level security;
revoke all on public.capture_ai_consents from public,anon,authenticated;
grant select on public.capture_ai_consents to authenticated;
grant all on public.capture_ai_consents to service_role;
create policy capture_ai_consent_owner on public.capture_ai_consents for select to authenticated using ((select auth.uid())=user_id);

create table private.capture_operations (
 user_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null,
 kind text not null check(kind in ('analysis','search')),
 fingerprint text not null check(length(fingerprint)=64),
 network_hash text not null check(length(network_hash)=64),
 created_at timestamptz not null default now(),
 result jsonb,
 primary key(user_id,request_id),
 check(result is null or (jsonb_typeof(result)='object' and octet_length(result::text)<=262144))
);
alter table private.capture_operations enable row level security;
revoke all on private.capture_operations from public,anon,authenticated;
create index capture_operations_time on private.capture_operations(created_at);
create index capture_operations_identity on private.capture_operations(user_id,kind,fingerprint,created_at);


-- Read-only fast path before quota work. Claims below remain atomic.
create function private.lookup_capture_operation(p_user_id uuid,p_request_id uuid,p_kind text,p_fingerprint text,p_network_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare existing private.capture_operations%rowtype;
begin
 select * into existing from private.capture_operations where user_id=p_user_id and request_id=p_request_id;
 if not found and p_kind='search' then
  select * into existing from private.capture_operations where user_id=p_user_id and kind='search' and fingerprint=p_fingerprint and created_at>pg_catalog.now()-interval '24 hours' order by created_at desc limit 1;
 end if;
 if existing.user_id is null then return jsonb_build_object('status','missing'); end if;
 if existing.kind<>p_kind or existing.fingerprint<>p_fingerprint then return jsonb_build_object('status','mismatch'); end if;
 if existing.result is not null and existing.created_at>pg_catalog.now()-interval '22 hours' then return jsonb_build_object('status','replay','result',existing.result); end if;
 return jsonb_build_object('status','request_completed');
end;$$;
create function public.lookup_capture_operation(p_user_id uuid,p_request_id uuid,p_kind text,p_fingerprint text,p_network_hash text)
returns jsonb language sql security invoker set search_path='' as $$select private.lookup_capture_operation(p_user_id,p_request_id,p_kind,p_fingerprint,p_network_hash);$$;
revoke all on function private.lookup_capture_operation(uuid,uuid,text,text,text),public.lookup_capture_operation(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function private.lookup_capture_operation(uuid,uuid,text,text,text),public.lookup_capture_operation(uuid,uuid,text,text,text) to service_role;

create function private.reserve_capture_operation(p_user_id uuid,p_request_id uuid,p_kind text,p_fingerprint text,p_network_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare existing private.capture_operations%rowtype; since_at timestamptz := pg_catalog.now()-interval '24 hours';
begin
 if p_kind is null or p_fingerprint is null or p_network_hash is null or p_kind not in ('analysis','search') or p_fingerprint !~ '^[0-9a-f]{64}$' or p_network_hash !~ '^[0-9a-f]{64}$'
   or p_user_id is null or p_request_id is null then raise exception 'invalid_capture_request'; end if;
 -- One lock protects the small globally bounded search budget and operation replay.
 perform pg_catalog.pg_advisory_xact_lock(6808622187);
 select * into existing from private.capture_operations where user_id=p_user_id and request_id=p_request_id;
 if found then
   if existing.kind<>p_kind or existing.fingerprint<>p_fingerprint then return jsonb_build_object('status','mismatch'); end if;
   if existing.result is not null and existing.created_at>pg_catalog.now()-interval '22 hours' then return jsonb_build_object('status','replay','result',existing.result); end if;
   return jsonb_build_object('status','request_completed');
 end if;
 -- Identical assistance retries with a fresh client ID must not create another cost.
 if p_kind='search' then
   select * into existing from private.capture_operations where user_id=p_user_id and kind='search' and fingerprint=p_fingerprint and created_at>since_at order by created_at desc limit 1;
   if found then
     if existing.result is not null and existing.created_at>pg_catalog.now()-interval '22 hours' then return jsonb_build_object('status','replay','result',existing.result); end if;
     return jsonb_build_object('status','request_completed');
   end if;
   if (select count(*) from private.capture_operations where kind='search' and created_at>since_at)>=100
    or (select count(*) from private.capture_operations where kind='search' and user_id=p_user_id and created_at>since_at)>=5
    or (select count(*) from private.capture_operations where kind='search' and network_hash=p_network_hash and created_at>since_at)>=20 then
      return jsonb_build_object('status','rate_limited');
   end if;
 end if;
 insert into private.capture_operations(user_id,request_id,kind,fingerprint,network_hash) values(p_user_id,p_request_id,p_kind,p_fingerprint,p_network_hash);
 return jsonb_build_object('status','claimed');
end; $$;
create function public.reserve_capture_operation(p_user_id uuid,p_request_id uuid,p_kind text,p_fingerprint text,p_network_hash text)
returns jsonb language sql security invoker set search_path='' as $$select private.reserve_capture_operation(p_user_id,p_request_id,p_kind,p_fingerprint,p_network_hash);$$;
create function private.finish_capture_operation(p_user_id uuid,p_request_id uuid,p_result jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if p_result is null or jsonb_typeof(p_result)<>'object' or octet_length(p_result::text)>262144 then raise exception 'invalid_capture_result'; end if;
 update private.capture_operations set result=p_result where user_id=p_user_id and request_id=p_request_id and result is null;
 return jsonb_build_object('status',case when found then 'completed' else 'unchanged' end);
end; $$;
create function public.finish_capture_operation(p_user_id uuid,p_request_id uuid,p_result jsonb)
returns jsonb language sql security invoker set search_path='' as $$select private.finish_capture_operation(p_user_id,p_request_id,p_result);$$;
create function private.cleanup_capture_operations() returns void language sql security definer set search_path='' as $$
 update private.capture_operations set result=null where result is not null and created_at<pg_catalog.now()-interval '22 hours';
 delete from private.capture_operations where created_at<pg_catalog.now()-interval '30 days';
$$;
revoke all on function private.reserve_capture_operation(uuid,uuid,text,text,text),public.reserve_capture_operation(uuid,uuid,text,text,text),private.finish_capture_operation(uuid,uuid,jsonb),public.finish_capture_operation(uuid,uuid,jsonb),private.cleanup_capture_operations() from public,anon,authenticated;
grant execute on function private.reserve_capture_operation(uuid,uuid,text,text,text),public.reserve_capture_operation(uuid,uuid,text,text,text),private.finish_capture_operation(uuid,uuid,jsonb),public.finish_capture_operation(uuid,uuid,jsonb),private.cleanup_capture_operations() to service_role;
-- Installation does not require cron in an isolated test database. Production
-- activation requires the retention job, checked separately before deployment.
do $$begin
 if exists(select 1 from pg_extension where extname='pg_cron') then
  perform cron.schedule('capture-operation-retention','11 * * * *','select private.cleanup_capture_operations()');
 end if;
end;$$;
commit;
