begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Server-side record that a user saw the paywall, independent of the
-- opt-in product analytics. Not every user has a paywall assignment, so
-- exposures live in their own table: one row per user and fixed context,
-- first sighting only. No device, locale, price or purchase data.
create table private.paywall_exposures (
  user_id uuid not null references auth.users (id) on delete cascade,
  context text not null check (context in ('entry', 'blocked', 'hard', 'manual')),
  shown_at timestamptz not null default now(),
  primary key (user_id, context)
);
alter table private.paywall_exposures enable row level security;
revoke all on private.paywall_exposures from public, anon, authenticated;
grant all on private.paywall_exposures to service_role;

-- Idempotent: repeated calls for the same user and context never write again,
-- so the endpoint cannot grow storage beyond four rows per account.
create function private.mark_paywall_shown(p_context text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists(select 1 from auth.users where id = auth.uid()) then
    raise exception 'cloud_identity_changed';
  end if;
  if p_context is null or p_context not in ('entry', 'blocked', 'hard', 'manual') then
    raise exception 'invalid_paywall_context';
  end if;
  insert into private.paywall_exposures(user_id, context) values (auth.uid(), p_context)
  on conflict (user_id, context) do nothing;
end $$;
revoke all on function private.mark_paywall_shown(text) from public, anon;
grant execute on function private.mark_paywall_shown(text) to authenticated;

create function public.mark_paywall_shown(p_context text) returns void
language sql security invoker set search_path = '' as $$ select private.mark_paywall_shown(p_context); $$;
revoke all on function public.mark_paywall_shown(text) from public, anon;
grant execute on function public.mark_paywall_shown(text) to authenticated;

notify pgrst, 'reload schema';
commit;
