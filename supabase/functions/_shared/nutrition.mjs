/**
 * The display language for the detected title and ingredient names. An older
 * build sends nothing, and an unknown value is not worth a 400: falling back to
 * the app's default language is the safe reading.
 */
export function requestedLanguage(input) {
  return input?.language === 'de' ? 'de' : 'en';
}

export function validateAnalysisInput(input) {
  return input?.mimeType === 'image/jpeg'
    && typeof input?.imageBase64 === 'string'
    && input.imageBase64.length >= 100;
}

/**
 * @param detection  structured model output
 * @param source     'photo' or 'text'. A typed description is by definition one
 *                   meal the user chose to report, so the multi-dish guard —
 *                   which exists to stop a photo of a whole table — must not
 *                   apply to it. The model marks normal plates as dishCount > 1
 *                   often enough that leaving it on rejected valid input.
 */
export function classifyDetection(detection, source = 'photo') {
  const fromPhoto = source !== 'text';

  if (!detection || detection.clarity === 'unclear' || !Array.isArray(detection.items) || detection.items.length === 0) {
    return {
      status: 422,
      body: {
        code: 'unclear_image',
        message: fromPhoto
          ? 'Das Foto ist für eine verlässliche Schätzung nicht eindeutig genug.'
          : 'Aus dieser Beschreibung lässt sich noch keine Mahlzeit ableiten. Nenne kurz die Lebensmittel und ungefähren Mengen.',
      },
    };
  }

  if (fromPhoto && detection.dishCount > 1) {
    return {
      status: 422,
      body: {
        code: 'multiple_dishes',
        message: 'Es wurden mehrere getrennte Mahlzeiten erkannt. Bitte fotografiere nur einen Teller.',
      },
    };
  }

  return null;
}

export function nutrient(food, ids) {
  const match = (food.foodNutrients || []).find((entry) => ids.includes(Number(entry.nutrientId || entry.nutrientNumber)));
  return Number(match?.value || 0);
}

/**
 * Cache key for a USDA search. USDA data is effectively static, so the same
 * term must always resolve to the same entry regardless of casing or spacing.
 */
export function normalizeSearchTerm(term) {
  return String(term ?? '').trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 120);
}

/**
 * Terms that name a category rather than a food. The model once returned
 * "other" — the referenceKey sentinel — as the search term for every
 * ingredient of a plate, so chicken, rice and broccoli all resolved to one
 * cached row and the whole meal was priced from it. A term that cannot
 * identify a food must never reach USDA or the cache.
 */
const UNUSABLE_SEARCH_TERMS = new Set([
  'other', 'unknown', 'none', 'n/a', 'na', 'null', 'undefined', 'food', 'meal', 'dish', 'ingredient',
]);

export function isUsableSearchTerm(term) {
  const normalized = normalizeSearchTerm(term);
  if (normalized.length < 3) return false;
  if (UNUSABLE_SEARCH_TERMS.has(normalized)) return false;
  // A BLS key is a reference id, not something USDA can look up.
  if (/^[a-z]+_[a-z_]+$/.test(normalized) && !normalized.includes(' ')) return false;
  return true;
}

/** Changing the matcher invalidates previous choices without deleting data. */
export const USDA_MATCHER_VERSION = 3;

export function usdaCacheKey(term) {
  return `v${USDA_MATCHER_VERSION}:${normalizeSearchTerm(term)}`;
}

const DATA_TYPE_PRIORITY = ['Foundation', 'SR Legacy', 'Survey (FNDDS)', 'Branded'];

const PREPARATION_WORDS = new Set([
  'baked', 'boiled', 'breaded', 'canned', 'cooked', 'dried', 'fried', 'grilled',
  'raw', 'roasted', 'steamed', 'stewed', 'sweetened', 'unsweetened',
]);

const LOW_INFORMATION_WORDS = new Set([
  'and', 'in', 'of', 'the', 'with', 'without', 'style', 'prepared', 'food', 'as', 'to',
]);

/**
 * USDA bookkeeping that narrows a label without changing the food: "Rice,
 * cooked, NFS" is still rice. These must not be charged like an extra
 * ingredient, or a plainly-worded row loses to a terser one from a
 * higher-priority data set.
 */
const QUALIFIER_WORDS = new Set([
  'nfs', 'ns', 'unspecified', 'form', 'salt', 'added', 'drained', 'includes',
  'commodity', 'usda', 'variety', 'varieties', 'type', 'types', 'product',
  'no', 'fresh', 'frozen',
]);

/**
 * Fat added during cooking, which USDA sometimes folds into the row. It is not
 * a different food, but it is a different calorie density, and the model lists
 * oil as its own ingredient — so an unrequested "cooked with oil" row would be
 * counted twice.
 */
const ADDED_FAT_WORDS = new Set(['oil', 'butter', 'fat', 'cream', 'cheese', 'sauce', 'gravy', 'dressing', 'margarine']);
const NO_ADDED_FAT = /\bno(?:t)? +(?:added +)?(?:fat|oil|butter)\b|\bwithout +(?:added +)?(?:fat|oil|butter)\b/;

function words(value) {
  return normalizeSearchTerm(value)
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter((word) => word && !LOW_INFORMATION_WORDS.has(word));
}

/**
 * Picks the USDA entry that best matches the search term.
 *
 * Ranking by data type alone was not enough: searching "broccoli" returns no
 * Foundation entry, so the first Survey row won — "Fried broccoli" at
 * 223 kcal/100 g — while "Broccoli, raw" sat two rows below. Relevance now
 * decides and the data type only breaks ties, because a precise match in a
 * lesser data set beats a confident match on the wrong food.
 */
export function chooseFoodMatch(foods, term = '') {
  const list = [...(foods || [])];
  if (!list.length) return { food: undefined, score: 0, margin: 0, confidence: 'low', cacheable: false };

  const target = normalizeSearchTerm(term);
  const targetWords = words(term);

  const rank = (food) => {
    const index = DATA_TYPE_PRIORITY.indexOf(food.dataType);
    return index === -1 ? DATA_TYPE_PRIORITY.length : index;
  };

  const score = (food) => {
    const description = normalizeSearchTerm(food.description);
    const descriptionWords = words(food.description);
    const descriptionSet = new Set(descriptionWords);
    const targetSet = new Set(targetWords);
    let value = Math.max(0, 12 - rank(food) * 3);

    if (!target) return value;

    if (description === target) value += 120;
    else if (description.startsWith(target)) value += 35;

    const covered = targetWords.filter((word) => descriptionSet.has(word)).length;
    const coverage = targetWords.length ? covered / targetWords.length : 0;
    const precision = descriptionWords.length ? covered / descriptionWords.length : 0;
    value += coverage * 65 + precision * 25;

    // Preparation changes calories dramatically. An unrequested "fried" result
    // must not beat a raw/cooked base food merely because one noun overlaps.
    for (const preparation of PREPARATION_WORDS) {
      if (descriptionSet.has(preparation) && !targetSet.has(preparation)) {
        value -= preparation === 'raw' || preparation === 'cooked' ? 5 : 35;
      }
      if (targetSet.has(preparation) && !descriptionSet.has(preparation)) value -= 18;
    }

    // An extra noun usually names a different food: "Rice noodles" is not
    // rice and "Broccoli raab" is not broccoli. Five points was not enough to
    // outweigh the data-type bonus, so both used to win. Bureaucratic
    // qualifiers stay free.
    const extras = descriptionWords.filter((word) => (
      !targetSet.has(word) && !PREPARATION_WORDS.has(word) && !QUALIFIER_WORDS.has(word)
    )).length;
    // 9 was measured against real USDA responses for ten common foods: 5 still
    // picked "Rice noodles" over rice, 11 dropped baked salmon and 14 dropped a
    // boiled egg.
    value -= Math.min(extras, 4) * 9;

    // Prefer the plainly cooked row over an unspecified one. "Broccoli, NS as
    // to form, cooked" is 63 kcal/100 g because it averages in cooking fat,
    // while "Broccoli, fresh, cooked, no added fat" is 41 — and the model
    // already reports the oil separately.
    const targetWantsFat = targetWords.some((word) => ADDED_FAT_WORDS.has(word));
    if (!targetWantsFat) {
      // 16, not 12: the vaguer row is also the shorter one, so it wins on
      // precision unless the explicit "no added fat" row is paid for.
      if (NO_ADDED_FAT.test(description)) value += 16;
      else if (descriptionWords.some((word) => ADDED_FAT_WORDS.has(word))) value -= 20;
    }

    return value;
  };

  // Ties must break on the data, not on the position USDA happened to return.
  // Two broccoli rows scored identically, so the same query picked a different
  // food depending on the order of the response.
  const ranked = list
    .map((food, index) => ({ food, index, score: score(food) }))
    .sort((a, b) => (
      b.score - a.score
      || rank(a.food) - rank(b.food)
      || String(a.food?.fdcId ?? '').localeCompare(String(b.food?.fdcId ?? ''))
      || a.index - b.index
    ));
  const winner = ranked[0];
  const margin = winner.score - (ranked[1]?.score ?? 0);
  const accepted = targetWords.length > 0 && winner.score >= 52;
  const confidence = accepted && winner.score >= 75 && (ranked.length === 1 || margin >= 8)
    ? 'high'
    : accepted
      ? 'medium'
      : 'low';

  return {
    food: accepted ? winner.food : undefined,
    score: Number(winner.score.toFixed(2)),
    margin: Number(margin.toFixed(2)),
    confidence,
    // Ambiguous matches may be usable for this review screen, but caching them
    // would amplify one uncertain lookup across every user for months.
    cacheable: confidence === 'high',
  };
}

export function chooseFood(foods, term = '') {
  return chooseFoodMatch(foods, term).food;
}

/**
 * Reduces a USDA search hit to the handful of values a meal item needs. This is
 * what gets cached; the raw search response is orders of magnitude larger and
 * carries nothing else we use.
 */
export function toFoodFacts(food, match = null) {
  if (!food) return null;
  return {
    provider: 'usda',
    referenceId: String(food.fdcId),
    label: `USDA FDC ${food.fdcId}`,
    description: String(food.description || ''),
    dataType: String(food.dataType || ''),
    matchConfidence: match?.confidence || 'high',
    matchScore: match?.score,
    matchMargin: match?.margin,
    calories: nutrient(food, [1008, 208]),
    protein: nutrient(food, [1003, 203]),
    carbs: nutrient(food, [1005, 205]),
    fat: nutrient(food, [1004, 204]),
    fiber: nutrient(food, [1079, 291]),
  };
}

/** Scales cached per-100g facts onto the portion the model estimated. */
/**
 * USDA describes most prepared foods as "cooked", almost never as "boiled" or
 * "steamed", so the model's preparation vocabulary misses entries that plainly
 * exist: "white rice boiled" returned mushrooms and beans and was rejected,
 * while "white rice cooked" finds the right row. Callers try the original term
 * first and fall back to these rewrites only when nothing acceptable matched.
 */
export function searchTermVariants(term) {
  const normalized = String(term ?? '').trim();
  if (!normalized) return [];
  const variants = [];
  const swapped = normalized.replace(/\b(?:boiled|steamed|poached|braised)\b/gi, 'cooked');
  if (swapped !== normalized) variants.push(swapped);
  // Dropping the preparation entirely is the last resort: less precise, but a
  // raw-vs-cooked mismatch is a smaller error than counting the food as zero.
  const bare = normalized.replace(/\b(?:boiled|steamed|poached|braised|cooked|grilled|fried|baked|roasted|raw)\b/gi, '').replace(/\s+/g, ' ').trim();
  if (bare && bare !== normalized && !variants.includes(bare)) variants.push(bare);
  return variants;
}

export function buildMealItem(item, facts, index) {
  if (!facts) {
    return {
      id: `detected-${index}`,
      name: item.name,
      amountG: item.estimatedGrams,
      baseAmountG: item.estimatedGrams,
      portionFactor: 1,
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      confidence: 'medium',
      optional: true,
      // Not included: an ingredient we could not price is worth zero calories
      // only in the arithmetic, never in reality. Counting it silently made a
      // plate of rice disappear from the day. The user sees it flagged on the
      // confirm screen and can add it once the value is corrected.
      included: false,
      source: { provider: 'usda', code: 'unmatched', label: '' },
    };
  }

  const factor = item.estimatedGrams / 100;
  const provider = facts.provider || 'usda';
  const referenceId = String(facts.referenceId || facts.fdcId || 'unknown');
  return {
    id: `${provider}-${referenceId}-${index}`,
    name: item.name,
    amountG: item.estimatedGrams,
    baseAmountG: item.estimatedGrams,
    portionFactor: 1,
    calories: Math.round(Number(facts.calories) * factor),
    protein: Math.round(Number(facts.protein) * factor),
    carbs: Math.round(Number(facts.carbs) * factor),
    fat: Math.round(Number(facts.fat) * factor),
    fiber: Math.round(Number(facts.fiber) * factor),
    confidence: item.confidence === 'medium' || facts.matchConfidence === 'medium' ? 'medium' : 'high',
    optional: item.optional,
    included: true,
    source: {
      provider,
      referenceId,
      label: facts.label || `USDA FDC ${referenceId}`,
    },
  };
}

export function mapUsdaFood(item, food, index) {
  return buildMealItem(item, toFoodFacts(food), index);
}

/**
 * Returns codes, not sentences: one deployed function serves every language,
 * so the app renders the wording from its own dictionary.
 */
export function buildAccuracyWarnings(detection, items) {
  const warnings = [];
  if (items.some((item) => item.calories === 0)) {
    warnings.push('unmatched_ingredient');
  }
  if (detection.items.some((item) => item.hiddenCaloriesRisk === 'high')) {
    warnings.push('hidden_calories');
  }
  const widePortionRange = detection.items.some((item) => {
    const low = Number(item.estimatedGramsLow || item.estimatedGrams);
    const high = Number(item.estimatedGramsHigh || item.estimatedGrams);
    return high - low > Math.max(40, Number(item.estimatedGrams) * 0.35);
  });
  if (widePortionRange) {
    warnings.push('wide_portion');
  }
  return warnings;
}
