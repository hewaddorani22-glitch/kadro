-- The app accepts tenths of a gram. Integer columns reject those JSON numbers
-- with 22P02, leaving the meal header saved without its ingredient rows.
-- Widen both columns without changing owner policies, grants or range checks.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.meal_items
  alter column amount_g type numeric(8, 1) using amount_g::numeric(8, 1),
  alter column base_amount_g type numeric(8, 1) using base_amount_g::numeric(8, 1);

notify pgrst, 'reload schema';
commit;
