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
  // A generic raisin reference is an estimate across varieties. Colour and
  // seedless wording must not make an identifiable raisin an unknown food.
  // Whole-term allowlist: coatings, bread, oil, fresh grapes, etc. stay distinct.
  const raisinWords = term.replace(/[-,()]/g, ' ').replace(/\s+/g, ' ').trim();
  if (/^(?:(?:dried|green|golden|yellow|brown|black|seedless)\s+)*(?:raisins?|sultanas?)(?:\s+(?:dried|green|golden|yellow|brown|black|seedless))*$/.test(raisinWords)) return 'raisins';

  // References price edible nut kernels. Shell wording is presentation, not a
  // different ingredient. Never change the detected grams/count here: those
  // must already refer to edible weight, as required by the detection contract.
  // Keep roasting/salt qualifiers; do not strip shell words from shellfish,
  // taco shells, almond milk, unknown plants or compound foods.
  const kernels = term.replace(/\b(?:in(?: the| their)? shells?|with(?: the| their)? shells?|shell[- ]on|(?:un)?shelled)\b/g, ' ')
    .replace(/\s+/g, ' ').trim();
  if (kernels !== term && /^(?:(?:raw|dry roasted|oil roasted|roasted|salted|unsalted)\s+)*(?:(?:pistachios?|almonds?|walnuts?|hazelnuts?|pecans?|cashews?|peanuts?)(?: nuts?)?|brazil nuts?)(?:\s+(?:raw|dry roasted|oil roasted|roasted|salted|unsalted))*$/.test(kernels)) return kernels;
  return term;
}
