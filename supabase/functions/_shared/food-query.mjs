/** Normalize model lookup language, not the user's displayed food or amounts.
 * Only portion wording and equivalent spellings are removed. Preparation,
 * fat percentages, ingredients and negations remain nutritionally meaningful.
 */
export function normalizeFoodQuery(value) {
  return String(value ?? '').trim().toLowerCase()
    .replace(/\bwholegrain\b/g, 'whole grain')
    .replace(/\bwholewheat\b/g, 'whole wheat')
    .replace(/\bchick\s+peas\b/g, 'chickpeas')
    .replace(/\bgarbanzo beans?\b/g, 'chickpeas')
    .replace(/\baubergines?\b/g, 'eggplant')
    .replace(/\bcourgettes?\b/g, 'zucchini')
    .replace(/^\d+(?:[.,]\d+)?\s+(?:(?:g|grams?|kg|oz|ounces?)\s+)?(?:of\s+)?(?=[a-z])/, '')
    .replace(/\b(?:slices?|sliced|pieces?|portions?|servings?|chopped|diced)\b/g, ' ')
    .replace(/^\s*of\s+/, '')
    .replace(/\s+/g, ' ').trim().slice(0, 120);
}

// Entire-term aliases only: "raisin bread" must NEVER become "raisins".
// Dried is redundant for raisins, not for grapes, dates, rice or any other food.
export function canonicalFoodQuery(value) {
  const term = normalizeFoodQuery(value);
  return /^(?:dried )?(?:raisins?|sultanas?)(?: dried)?$/.test(term) ? 'raisins' : term;
}
