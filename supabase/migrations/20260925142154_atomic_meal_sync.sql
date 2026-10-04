begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
-- Release A: deploy before the matching client. Existing rows are not rewritten.
-- New writes replace the whole meal atomically. Old clients keep their grants,
-- but triggers advance revisions and retain deletion tombstones for both paths.
alter table public.meals add column cloud_revision bigint not null default 0 check (cloud_revision >= 0);
alter table public.meal_items
  add column nutrition_per_100g jsonb,
  add column portions jsonb,
  add column source_estimated_reference boolean not null default false,
  add column item_position integer not null default 0 check (item_position between 0 and 99),
  add column metadata_version smallint not null default 1 check (metadata_version = 1);

create table private.meal_sync_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  meal_id text not null check (char_length(meal_id) between 1 and 240),
  revision bigint not null default 0 check (revision >= 0),
  deleted boolean not null default false,
  last_mutation_id uuid,
  receipts jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, meal_id)
);
alter table private.meal_sync_state enable row level security;
revoke all on private.meal_sync_state from public, anon, authenticated;

create function private.valid_meal_reference(value jsonb) returns boolean
language plpgsql immutable security invoker set search_path = '' as $$
declare field text; maximum numeric;
begin
  if value is null then return true; end if;
  if jsonb_typeof(value) <> 'object' then return false; end if;
  foreach field in array array['calories','protein','carbs','fat','fiber'] loop
    if field = 'fiber' and not (value ? field) then continue; end if;
    if jsonb_typeof(value -> field) is distinct from 'number' then return false; end if;
    maximum := case field when 'calories' then 10000 when 'fiber' then 500 else 2000 end;
    if (value ->> field)::numeric < 0 or (value ->> field)::numeric > maximum then return false; end if;
  end loop;
  return true;
end $$;
create function private.valid_meal_portions(value jsonb) returns boolean
language plpgsql immutable security invoker set search_path = '' as $$
declare portion jsonb;
begin
  if value is null then return true; end if;
  if jsonb_typeof(value) <> 'array' then return false; end if;
  if jsonb_array_length(value) > 20 then return false; end if;
  for portion in select * from jsonb_array_elements(value) loop
    if jsonb_typeof(portion) <> 'object'
      or jsonb_typeof(portion -> 'label') is distinct from 'string'
      or char_length(portion ->> 'label') not between 1 and 80
      or jsonb_typeof(portion -> 'grams') is distinct from 'number'
      or ((portion ? 'estimated') and jsonb_typeof(portion -> 'estimated') <> 'boolean') then return false; end if;
    if (portion ->> 'grams')::numeric <= 0 or (portion ->> 'grams')::numeric > 5000 then return false; end if;
  end loop;
  return true;
end $$;
alter table public.meal_items
  add constraint meal_items_reference_valid check (private.valid_meal_reference(nutrition_per_100g)),
  add constraint meal_items_portions_valid check (private.valid_meal_portions(portions));
revoke all on function private.valid_meal_reference(jsonb), private.valid_meal_portions(jsonb) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.valid_meal_reference(jsonb), private.valid_meal_portions(jsonb) to authenticated;

-- Every mutation, including writes from Build 18, invalidates stale revisions.
create function private.track_meal_revision() returns trigger
language plpgsql security definer set search_path = '' as $$
declare owner_id uuid; target_id text; state private.meal_sync_state%rowtype;
begin
  owner_id := case when tg_op = 'DELETE' then old.user_id else new.user_id end;
  target_id := case when tg_op = 'DELETE' then old.id else new.id end;
  if tg_op = 'UPDATE' and (new.user_id <> old.user_id or new.id <> old.id) then
    raise exception 'meal_identity_immutable';
  end if;
  -- Auth deletion cascades do not recreate state for an already deleted user.
  if not exists (select 1 from auth.users where id = owner_id) then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner_id::text || ':' || target_id, 0));
  insert into private.meal_sync_state(user_id, meal_id) values(owner_id, target_id) on conflict do nothing;
  select * into state from private.meal_sync_state where user_id = owner_id and meal_id = target_id for update;
  if state.deleted and tg_op <> 'DELETE' then raise exception 'meal_deleted'; end if;
  update private.meal_sync_state set revision = state.revision + 1,
    deleted = tg_op = 'DELETE', last_mutation_id = null, updated_at = clock_timestamp()
    where user_id = owner_id and meal_id = target_id;
  if tg_op = 'DELETE' then return old; end if;
  new.cloud_revision := state.revision + 1;
  return new;
end $$;
create trigger track_meal_revision before insert or update or delete on public.meals
  for each row execute function private.track_meal_revision();

create function private.track_meal_item_revision() returns trigger
language plpgsql security definer set search_path = '' as $$
declare owner_id uuid; target_id text;
begin
  owner_id := case when tg_op = 'DELETE' then old.user_id else new.user_id end;
  target_id := case when tg_op = 'DELETE' then old.meal_id else new.meal_id end;
  if tg_op = 'UPDATE' and (new.user_id <> old.user_id or new.meal_id <> old.meal_id or new.id <> old.id) then
    raise exception 'meal_item_identity_immutable';
  end if;
  -- A no-op value update still invokes the parent revision trigger.
  update public.meals set updated_at = clock_timestamp() where user_id = owner_id and id = target_id;
  return null;
end $$;
create trigger track_meal_item_revision after insert or update or delete on public.meal_items
  for each row execute function private.track_meal_item_revision();
revoke all on function private.track_meal_revision(), private.track_meal_item_revision() from public, anon, authenticated;

create function private.mutate_meal_v2(
  expected_user_id uuid, mutation_id uuid, expected_revision bigint,
  ancestors uuid[], operation text, meal jsonb, items jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid(); target_id text := meal ->> 'id';
  state private.meal_sync_state%rowtype; fingerprint text; receipt jsonb;
  item jsonb; position integer := 0; final_revision bigint; kept_receipts jsonb;
  total_calories numeric; total_protein numeric; total_carbs numeric; total_fat numeric; total_fiber numeric;
begin
  if owner_id is null or owner_id is distinct from expected_user_id then raise exception 'cloud_identity_changed'; end if;
  if not exists (select 1 from auth.users where id = owner_id) then raise exception 'cloud_identity_changed'; end if;
  if mutation_id is null or expected_revision is null or expected_revision < 0
    or operation not in ('save','delete') or operation is null
    or target_id is null or char_length(target_id) not between 1 and 240
    or coalesce(cardinality(ancestors),0) > 64
    or jsonb_typeof(meal) <> 'object' or jsonb_typeof(items) is distinct from 'array'
    or jsonb_array_length(items) > 100
    or octet_length(meal::text) + octet_length(items::text) > 262144 then raise exception 'invalid_meal_mutation'; end if;
  fingerprint := pg_catalog.md5(jsonb_build_object('operation',operation,'meal',meal,'items',items)::text);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner_id::text || ':' || target_id, 0));
  insert into private.meal_sync_state(user_id, meal_id) values(owner_id,target_id) on conflict do nothing;
  select * into state from private.meal_sync_state where user_id = owner_id and meal_id = target_id for update;
  receipt := state.receipts -> mutation_id::text;
  if receipt is not null then
    if receipt ->> 'hash' <> fingerprint then raise exception 'meal_mutation_id_reused'; end if;
    return jsonb_build_object('revision',(receipt ->> 'revision')::bigint,'status','duplicate','deleted',operation='delete');
  end if;
  if state.deleted and operation = 'save' then raise exception 'meal_deleted'; end if;
  if expected_revision <> state.revision and not coalesce(state.last_mutation_id = any(ancestors), false) then
    raise exception 'meal_revision_conflict';
  end if;
  if operation = 'delete' then
    delete from public.meals where user_id = owner_id and id = target_id;
    if not found then
      update private.meal_sync_state set revision = revision + 1, deleted = true, updated_at = clock_timestamp()
        where user_id = owner_id and meal_id = target_id;
    end if;
  else
    -- Never store a parent total that contradicts its included ingredient rows.
    select coalesce(sum((v ->> 'calories')::numeric),0),coalesce(sum((v ->> 'protein')::numeric),0),
      coalesce(sum((v ->> 'carbs')::numeric),0),coalesce(sum((v ->> 'fat')::numeric),0),coalesce(sum(coalesce((v ->> 'fiber')::numeric,0)),0)
      into total_calories,total_protein,total_carbs,total_fat,total_fiber
      from jsonb_array_elements(items) v where (v ->> 'included')::boolean;
    if (meal ->> 'calories')::numeric is distinct from total_calories
      or (meal ->> 'protein')::numeric is distinct from total_protein
      or (meal ->> 'carbs')::numeric is distinct from total_carbs
      or (meal ->> 'fat')::numeric is distinct from total_fat
      or coalesce((meal ->> 'fiber')::numeric,0) <> total_fiber then raise exception 'meal_totals_mismatch'; end if;
    -- UPDATE/INSERT avoids the double BEFORE trigger of INSERT ON CONFLICT.
    update public.meals set title=meal->>'title', meal_type=meal->>'meal_type',
      eaten_at=(meal->>'eaten_at')::timestamptz, meal_date=(meal->>'meal_date')::date,
      calories=total_calories, protein=total_protein, carbs=total_carbs, fat=total_fat, fiber=total_fiber,
      confidence=meal->>'confidence', origin=meal->>'origin', saved_at=(meal->>'saved_at')::timestamptz,
      updated_at=clock_timestamp() where user_id=owner_id and id=target_id;
    if not found then
      insert into public.meals(user_id,id,title,meal_type,eaten_at,meal_date,calories,protein,carbs,fat,fiber,confidence,origin,saved_at)
      values(owner_id,target_id,meal->>'title',meal->>'meal_type',(meal->>'eaten_at')::timestamptz,(meal->>'meal_date')::date,
        total_calories,total_protein,total_carbs,total_fat,total_fiber,meal->>'confidence',meal->>'origin',(meal->>'saved_at')::timestamptz);
    end if;
    delete from public.meal_items where user_id=owner_id and meal_id=target_id;
    for item in select * from jsonb_array_elements(items) loop
      insert into public.meal_items(user_id,meal_id,id,name,amount_g,base_amount_g,portion_factor,
        calories,protein,carbs,fat,fiber,confidence,optional,included,source_provider,source_reference_id,source_label,
        nutrition_per_100g,portions,source_estimated_reference,item_position,metadata_version)
      values(owner_id,target_id,item->>'id',item->>'name',(item->>'amount_g')::numeric,(item->>'base_amount_g')::numeric,
        (item->>'portion_factor')::numeric,(item->>'calories')::integer,(item->>'protein')::integer,(item->>'carbs')::integer,
        (item->>'fat')::integer,coalesce((item->>'fiber')::integer,0),item->>'confidence',(item->>'optional')::boolean,
        (item->>'included')::boolean,item->>'source_provider',item->>'source_reference_id',item->>'source_label',
        nullif(item->'nutrition_per_100g','null'::jsonb),nullif(item->'portions','null'::jsonb),
        coalesce((item->>'source_estimated_reference')::boolean,false),position,1);
      position := position+1;
    end loop;
  end if;
  select revision,receipts into final_revision,kept_receipts from private.meal_sync_state where user_id=owner_id and meal_id=target_id;
  kept_receipts := kept_receipts || jsonb_build_object(mutation_id::text,jsonb_build_object('hash',fingerprint,'revision',final_revision));
  select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into kept_receipts
    from (select key,value from jsonb_each(kept_receipts) order by (value->>'revision')::bigint desc limit 64) recent;
  update private.meal_sync_state set last_mutation_id=mutation_id,receipts=kept_receipts,updated_at=clock_timestamp()
    where user_id=owner_id and meal_id=target_id;
  return jsonb_build_object('revision',final_revision,'status','applied','deleted',operation='delete');
end $$;
revoke all on function private.mutate_meal_v2(uuid,uuid,bigint,uuid[],text,jsonb,jsonb) from public,anon;
grant execute on function private.mutate_meal_v2(uuid,uuid,bigint,uuid[],text,jsonb,jsonb) to authenticated;
create function public.mutate_meal_v2(expected_user_id uuid, mutation_id uuid, expected_revision bigint,
  ancestors uuid[], operation text, meal jsonb, items jsonb)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.mutate_meal_v2(expected_user_id,mutation_id,expected_revision,ancestors,operation,meal,items);
$$;
revoke all on function public.mutate_meal_v2(uuid,uuid,bigint,uuid[],text,jsonb,jsonb) from public,anon;
grant execute on function public.mutate_meal_v2(uuid,uuid,bigint,uuid[],text,jsonb,jsonb) to authenticated;

-- Only IDs requested by this account can be tested for deletion, no cross-user lookup.
create function private.deleted_meal_ids(expected_user_id uuid, ids text[]) returns text[]
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or auth.uid() is distinct from expected_user_id then raise exception 'cloud_identity_changed'; end if;
  if coalesce(cardinality(ids),0) > 5000 then raise exception 'too_many_meal_ids'; end if;
  return array(select meal_id from private.meal_sync_state where user_id=auth.uid() and deleted and meal_id=any(ids));
end $$;
revoke all on function private.deleted_meal_ids(uuid,text[]) from public,anon;
grant execute on function private.deleted_meal_ids(uuid,text[]) to authenticated;
create function public.deleted_meal_ids(expected_user_id uuid, ids text[]) returns text[]
language sql stable security invoker set search_path = '' as $$ select private.deleted_meal_ids(expected_user_id,ids); $$;
revoke all on function public.deleted_meal_ids(uuid,text[]) from public,anon;
grant execute on function public.deleted_meal_ids(uuid,text[]) to authenticated;

notify pgrst, 'reload schema';
commit;
