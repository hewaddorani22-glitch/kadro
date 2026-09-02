-- The analysis gateway trusted the model's searchTermEn without checking it.
-- When the model returned "other" — the referenceKey sentinel — for every
-- ingredient of a plate, all of them resolved to one cached row, and chicken,
-- rice and broccoli were each priced at 39 kcal per 100 g.
--
-- The gateway now rejects placeholder terms before any lookup, so these rows
-- can no longer be read. They are deleted anyway: a cache entry that never
-- described a real food should not sit in the table waiting for its TTL.
delete from public.usda_food_cache
where search_term ~ '^v[0-9]+:(other|unknown|none|n/a|na|null|undefined|food|meal|dish|ingredient)$'
   or length(split_part(search_term, ':', 2)) < 3;

-- Stop the same shape of row from being written again, whatever calls the
-- table. The application guard is the first line; this is the last one.
alter table public.usda_food_cache
  drop constraint if exists usda_food_cache_search_term_is_a_food;

alter table public.usda_food_cache
  add constraint usda_food_cache_search_term_is_a_food
  check (
    search_term !~ '^v[0-9]+:(other|unknown|none|n/a|na|null|undefined|food|meal|dish|ingredient)$'
    and length(split_part(search_term, ':', 2)) >= 3
  );
