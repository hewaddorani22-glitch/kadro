-- READ ONLY. Run separately with authorized database access before deployment.
-- No personal IDs, titles or ingredient names leave this aggregate report.
-- Existing discrepancies must not be automatically rewritten by the migration.
with ingredient_totals as (
  select user_id, meal_id,
    count(*) as item_count,
    coalesce(sum(calories) filter (where included), 0) as calories,
    coalesce(sum(protein) filter (where included), 0) as protein,
    coalesce(sum(carbs) filter (where included), 0) as carbs,
    coalesce(sum(fat) filter (where included), 0) as fat,
    coalesce(sum(fiber) filter (where included), 0) as fiber
  from public.meal_items group by user_id, meal_id
)
select count(*) as meals,
  count(*) filter (where i.item_count is null) as meals_without_items,
  count(*) filter (where (m.calories,m.protein,m.carbs,m.fat,m.fiber)
    is distinct from (coalesce(i.calories,0),coalesce(i.protein,0),coalesce(i.carbs,0),coalesce(i.fat,0),coalesce(i.fiber,0))) as meals_with_total_mismatch
from public.meals m left join ingredient_totals i on i.user_id=m.user_id and i.meal_id=m.id;
