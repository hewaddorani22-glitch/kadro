-- PostgREST can only use a column name in `on_conflict=email` when that
-- column is backed by a real UNIQUE constraint. The original expression
-- index on lower(email) protected the data but could not be inferred by the
-- waitlist Edge Function's upsert. Emails are already forced to lowercase by
-- waitlist_email_check, so a column constraint has the same data semantics.
drop index if exists public.waitlist_email_key;

alter table public.waitlist
  add constraint waitlist_email_key unique (email);
