-- Apple refresh tokens are AES-256-GCM ciphertext; the encryption key is an
-- Edge Function secret, never a database column or an Expo environment value.
create table public.apple_account_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  apple_subject text,
  client_id text,
  refresh_token_ciphertext text,
  refresh_token_iv text,
  authorization_code_hash text,
  updated_at timestamptz not null default now(),
  exchange_window_started_at timestamptz not null default now(),
  exchange_attempts integer not null default 0 check (exchange_attempts between 0 and 10),
  constraint apple_token_complete check (
    (apple_subject is null and client_id is null and refresh_token_ciphertext is null and refresh_token_iv is null and authorization_code_hash is null)
    or (apple_subject is not null and length(apple_subject) between 1 and 255
      and client_id is not null and client_id = 'com.hewaddorani.kandro'
      and refresh_token_ciphertext is not null and length(refresh_token_ciphertext) between 24 and 12000
      and refresh_token_iv is not null and refresh_token_iv ~ '^[A-Za-z0-9+/]{16}$'
      and authorization_code_hash is not null and authorization_code_hash ~ '^[0-9a-f]{64}$')
  )
);
alter table public.apple_account_tokens enable row level security;
-- No client policies: neither anonymous nor authenticated clients can read,
-- insert, mutate or delete these rows, including their own encrypted token.
revoke all on public.apple_account_tokens from public, anon, authenticated;
grant select, insert, update, delete on public.apple_account_tokens to service_role;
comment on table public.apple_account_tokens is 'Server-only Apple token revocation material, encrypted by the Edge Function and deleted with its auth user.';

-- Invoker rights, service-role-only. The atomic update bounds exchange attempts
-- to ten per hour per existing authenticated account, including concurrent calls.
create function public.claim_apple_token_exchange(p_user_id uuid)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  with claimed as (
    insert into public.apple_account_tokens (user_id, exchange_attempts)
    values (p_user_id, 1)
    on conflict (user_id) do update set
      exchange_window_started_at = case
        when public.apple_account_tokens.exchange_window_started_at <= now() - interval '1 hour' then now()
        else public.apple_account_tokens.exchange_window_started_at end,
      exchange_attempts = case
        when public.apple_account_tokens.exchange_window_started_at <= now() - interval '1 hour' then 1
        else public.apple_account_tokens.exchange_attempts + 1 end
    where public.apple_account_tokens.exchange_window_started_at <= now() - interval '1 hour'
       or public.apple_account_tokens.exchange_attempts < 10
    returning user_id
  )
  select exists(select 1 from claimed);
$$;
revoke all on function public.claim_apple_token_exchange(uuid) from public, anon, authenticated;
grant execute on function public.claim_apple_token_exchange(uuid) to service_role;
