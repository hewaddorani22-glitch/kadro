begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- The existing gram editor accepts 1..5000 g for amounts and references.
-- Their ratio can therefore be 0.0002..5000, not only (0,20]. Keep the
-- reference and entered grams intact; changing or clamping them would alter
-- subsequent portion corrections. Six fractional digits also prevent valid
-- small ratios from rounding to zero. No user rows or RPC bodies are changed.
alter table public.meal_items
  alter column portion_factor type numeric(10,6),
  drop constraint meal_items_portion_factor_check,
  add constraint meal_items_portion_factor_check
    check (portion_factor > 0 and portion_factor <= 5000);

notify pgrst, 'reload schema';
commit;
