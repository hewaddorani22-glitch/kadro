export function validateAnalysisInput(input) {
  return input?.mimeType === 'image/jpeg'
    && typeof input?.imageBase64 === 'string'
    && input.imageBase64.length >= 100;
}

export function classifyDetection(detection) {
  if (!detection || detection.clarity === 'unclear' || !Array.isArray(detection.items) || detection.items.length === 0) {
    return {
      status: 422,
      body: {
        code: 'unclear_image',
        message: 'Das Foto ist für eine verlässliche Schätzung nicht eindeutig genug.',
      },
    };
  }
  if (detection.dishCount > 1) {
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

export function chooseFood(foods) {
  const priority = ['Foundation', 'SR Legacy', 'Survey (FNDDS)', 'Branded'];
  const rank = (food) => {
    const index = priority.indexOf(food.dataType);
    return index === -1 ? priority.length : index;
  };
  return [...foods].sort((a, b) => rank(a) - rank(b))[0];
}

export function mapUsdaFood(item, food, index) {
  if (!food) {
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
    id: `fdc-${food.fdcId}-${index}`,
    name: item.nameDe,
    amountG: item.estimatedGrams,
    baseAmountG: item.estimatedGrams,
    portionFactor: 1,
    calories: Math.round(nutrient(food, [1008, 208]) * factor),
    protein: Math.round(nutrient(food, [1003, 203]) * factor),
    carbs: Math.round(nutrient(food, [1005, 205]) * factor),
    fat: Math.round(nutrient(food, [1004, 204]) * factor),
    fiber: Math.round(nutrient(food, [1079, 291]) * factor),
    confidence: item.confidence,
    optional: item.optional,
    included: true,
    source: {
      provider: 'usda',
      referenceId: String(food.fdcId),
      label: `USDA FDC ${food.fdcId}`,
    },
  };
}
