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

/** Changing the matcher invalidates previous choices without deleting data. */
export const USDA_MATCHER_VERSION = 2;

export function usdaCacheKey(term) {
  return `v${USDA_MATCHER_VERSION}:${normalizeSearchTerm(term)}`;
}

const DATA_TYPE_PRIORITY = ['Foundation', 'SR Legacy', 'Survey (FNDDS)', 'Branded'];

const PREPARATION_WORDS = new Set([
  'baked', 'boiled', 'breaded', 'canned', 'cooked', 'dried', 'fried', 'grilled',
  'raw', 'roasted', 'steamed', 'stewed', 'sweetened', 'unsweetened',
]);

const LOW_INFORMATION_WORDS = new Set([
  'and', 'in', 'of', 'the', 'with', 'without', 'style', 'prepared', 'food',
]);

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

    // Extra food nouns often indicate a different composite dish ("beef and
    // broccoli", "rice pudding"). Cap the penalty for verbose USDA labels.
    const extras = descriptionWords.filter((word) => !targetSet.has(word) && !PREPARATION_WORDS.has(word)).length;
    value -= Math.min(extras, 5) * 5;

    return value;
  };

  const ranked = list
    .map((food, index) => ({ food, index, score: score(food) }))
    .sort((a, b) => b.score - a.score || a.index - b.index);
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
export function buildMealItem(item, facts, index) {
  if (!facts) {
    return {
      id: `detected-${index}`,
      name: item.nameDe,
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
      included: true,
      source: { provider: 'usda', label: 'USDA: nicht gefunden' },
    };
  }

  const factor = item.estimatedGrams / 100;
  const provider = facts.provider || 'usda';
  const referenceId = String(facts.referenceId || facts.fdcId || 'unknown');
  return {
    id: `${provider}-${referenceId}-${index}`,
    name: item.nameDe,
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

export function buildAccuracyWarnings(detection, items) {
  const warnings = [];
  if (items.some((item) => item.calories === 0)) {
    warnings.push('Mindestens eine Zutat konnte keiner verlässlichen Referenz zugeordnet werden. Bitte prüfe sie.');
  }
  if (detection.items.some((item) => item.hiddenCaloriesRisk === 'high')) {
    warnings.push('Öl oder Sauce ist auf dem Foto schwer messbar. Prüfe Menge und Zutaten besonders genau.');
  }
  const widePortionRange = detection.items.some((item) => {
    const low = Number(item.estimatedGramsLow || item.estimatedGrams);
    const high = Number(item.estimatedGramsHigh || item.estimatedGrams);
    return high - low > Math.max(40, Number(item.estimatedGrams) * 0.35);
  });
  if (widePortionRange) {
    warnings.push('Die Portionsgröße ist optisch unsicher. Passe die Grammangabe kurz an.');
  }
  return warnings;
}
