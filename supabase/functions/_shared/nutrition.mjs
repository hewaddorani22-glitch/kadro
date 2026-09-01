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

const DATA_TYPE_PRIORITY = ['Foundation', 'SR Legacy', 'Survey (FNDDS)', 'Branded'];

function words(value) {
  return normalizeSearchTerm(value).split(/[\s,()]+/).filter(Boolean);
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
export function chooseFood(foods, term = '') {
  const list = [...(foods || [])];
  if (list.length < 2) return list[0];

  const target = normalizeSearchTerm(term);
  const targetWords = words(term);

  const rank = (food) => {
    const index = DATA_TYPE_PRIORITY.indexOf(food.dataType);
    return index === -1 ? DATA_TYPE_PRIORITY.length : index;
  };

  const score = (food) => {
    const description = normalizeSearchTerm(food.description);
    const descriptionWords = words(food.description);
    let value = rank(food) * 3;

    if (!target) return value;

    if (description === target) value -= 100;
    else if (description.startsWith(target)) value -= 40;

    const covered = targetWords.filter((word) => descriptionWords.includes(word)).length;
    value -= covered * 20;

    // Every word beyond the search term is a qualifier the user did not ask for
    // ("fried", "beef and", "with cheese sauce"). Capped so that verbose but
    // correct Foundation descriptions are not ruled out.
    value += Math.min(5, Math.max(0, descriptionWords.length - targetWords.length)) * 6;

    return value;
  };

  return list
    .map((food, index) => ({ food, index, score: score(food) }))
    .sort((a, b) => a.score - b.score || a.index - b.index)[0].food;
}

/**
 * Reduces a USDA search hit to the handful of values a meal item needs. This is
 * what gets cached; the raw search response is orders of magnitude larger and
 * carries nothing else we use.
 */
export function toFoodFacts(food) {
  if (!food) return null;
  return {
    fdcId: String(food.fdcId),
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
  return {
    id: `fdc-${facts.fdcId}-${index}`,
    name: item.nameDe,
    amountG: item.estimatedGrams,
    baseAmountG: item.estimatedGrams,
    portionFactor: 1,
    calories: Math.round(Number(facts.calories) * factor),
    protein: Math.round(Number(facts.protein) * factor),
    carbs: Math.round(Number(facts.carbs) * factor),
    fat: Math.round(Number(facts.fat) * factor),
    fiber: Math.round(Number(facts.fiber) * factor),
    confidence: item.confidence,
    optional: item.optional,
    included: true,
    source: {
      provider: 'usda',
      referenceId: facts.fdcId,
      label: `USDA FDC ${facts.fdcId}`,
    },
  };
}

export function mapUsdaFood(item, food, index) {
  return buildMealItem(item, toFoodFacts(food), index);
}
