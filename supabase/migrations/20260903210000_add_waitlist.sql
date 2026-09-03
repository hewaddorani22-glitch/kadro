-- A pre-launch waitlist, so marketing can start before the App Store review
-- finishes. Kept here rather than at an email vendor: the data is one column of
-- addresses, the project already stores personal data under the same
-- processing agreement, and a free tier that later starts charging is a bad
-- place to keep the only copy of a launch list.
--
-- Double opt-in is not optional in Germany: sending marketing to an address
-- that only ever typed itself into a form is a § 7 UWG problem. Both timestamps
-- exist so the consent can actually be evidenced — when it was given, and when
-- it was confirmed from the address itself.
create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  -- Which language to write to them in at launch.
  language text not null default 'de',
  -- Where the signup came from, so a campaign can be told apart from organic.
  source text,
  signed_up_at timestamptz not null default now(),
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  -- Single-use, rotated on every resend, so an old mail cannot confirm again.
  token text not null,
  -- Salted hash, never the address itself: rate limiting must not turn the
  -- table into a log of who visited the site from where.
  ip_hash text,
  constraint waitlist_email_check check (email = lower(email) and email like '%_@_%._%'),
  constraint waitlist_language_check check (language in ('de', 'en'))
);

-- One row per address. A second signup rotates the token and resends rather
-- than creating a duplicate nobody can unsubscribe from.
create unique index if not exists waitlist_email_key on public.waitlist (lower(email));
create index if not exists waitlist_token_idx on public.waitlist (token);
create index if not exists waitlist_ip_recent_idx on public.waitlist (ip_hash, signed_up_at desc);

alter table public.waitlist enable row level security;

-- No policies at all, deliberately: the anon key is published in the website's
-- JavaScript, and a readable waitlist is an email list anyone can download.
-- Only the edge function's service role touches this table.
revoke all on public.waitlist from anon, authenticated;

comment on table public.waitlist is
  'Pre-launch signups. Double opt-in; no policies, so only the service role in the waitlist function can read or write it.';
