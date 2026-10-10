/**
 * Nutrition-label reading ("Nährwerttabelle fotografieren").
 *
 * The model only transcribes what is printed on the pack. Every number then
 * passes the same deterministic checks on the server and in the app: unit
 * conversion (kJ → kcal, per serving → per 100 g), the Atwater energy check,
 * and physical limits (sugar ≤ carbohydrates, saturates ≤ fat, at most 100 g
 * of nutrients per 100 g). The user confirms or corrects every value before
 * anything is saved, so the stored values are the label the user photographed.
 *
 * Shared by supabase/functions/nutrition (route /v1/label) and the app
 * (src/services/customFoods.ts, src/components/LabelFoodForm.tsx).
 */

const nullableNumber = (maximum) => ({ type: ['number', 'null'], minimum: 0, maximum });
const nullableText = (maxLength) => ({ type: ['string', 'null'], maxLength });

export const LABEL_FIELDS = ['energyKcal', 'energyKj', 'fat', 'saturatedFat', 'carbs', 'sugar', 'fiber', 'protein', 'salt'];

export const labelSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['readable', 'basis', 'productName', 'brand', ...LABEL_FIELDS, 'servingSizeG', 'servingLabel', 'packageSizeG'],
  properties: {
    readable: { type: 'boolean' },
    basis: { type: 'string', enum: ['per_100g', 'per_100ml', 'per_serving', 'unclear'] },
    productName: nullableText(120),
    brand: nullableText(80),
    energyKcal: nullableNumber(5000),
    energyKj: nullableNumber(20000),
    fat: nullableNumber(2000),
    saturatedFat: nullableNumber(2000),
    carbs: nullableNumber(2000),
    sugar: nullableNumber(2000),
    fiber: nullableNumber(2000),
    protein: nullableNumber(2000),
    salt: nullableNumber(2000),
    servingSizeG: nullableNumber(5000),
    servingLabel: nullableText(60),
    packageSizeG: nullableNumber(20000),
  },
};

export function labelPrompt(language = 'de', withFront = false) {
  const lang = language === 'de' ? 'German' : 'English';
  return [
    'You transcribe the nutrition facts table of ONE packaged food from the photo' + (withFront ? 's (the first shows the table, the second the front of the pack).' : '.'),
    'Copy only numbers that are printed. Never estimate, never fill a value from general knowledge; use null for anything not legible or not printed.',
    'Prefer the "per 100 g" column. Use basis "per_100ml" when the table is per 100 ml, "per_serving" only when no per-100 column exists, "unclear" when the basis cannot be read.',
    'Energy: copy kcal and kJ separately as printed. Carbohydrates ("Kohlenhydrate"), of which sugars ("davon Zucker"), fat ("Fett"), of which saturates ("davon gesättigte Fettsäuren"), fibre ("Ballaststoffe"), protein ("Eiweiß"), salt ("Salz") in grams.',
    'servingSizeG: grams of one serving if printed as a weight (e.g. "1 Riegel = 40 g"), servingLabel: that serving in the printed words (max 60 characters), packageSizeG: net weight in grams if visible.',
    `productName and brand: as printed on the pack, in ${lang} if the pack shows that language, otherwise as printed; null if not visible.`,
    'readable: false when no nutrition table is visible or it cannot be read.',
  ].join('\n');
}

const round1 = (value) => Math.round(value * 10) / 10;
const isNumberOrNull = (value) => value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0);
const cleanText = (value, max) => typeof value === 'string' && value.replace(/\s+/g, ' ').trim()
  ? value.replace(/\s+/g, ' ').trim().slice(0, max)
  : null;

/** Structural validation of the model output; throws like the meal detector. */
export function validateLabelRead(raw) {
  const fail = () => { const error = new Error('provider_response_invalid'); error.code = 'provider_response_invalid'; throw error; };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail();
  if (typeof raw.readable !== 'boolean' || !['per_100g', 'per_100ml', 'per_serving', 'unclear'].includes(raw.basis)) fail();
  for (const field of [...LABEL_FIELDS, 'servingSizeG', 'packageSizeG']) if (!isNumberOrNull(raw[field])) fail();
  for (const field of ['productName', 'brand', 'servingLabel']) if (raw[field] !== null && typeof raw[field] !== 'string') fail();
  return raw;
}

/**
 * Turns a transcription into per-100 g values. Returns `{ code }` for a label
 * that cannot become a mass-based food (unreadable, per 100 ml), otherwise
 * `{ values, missing, serving, packageG, name, brand }` where values carry
 * only printed (or arithmetically converted) numbers.
 */
export function normalizeLabelRead(read) {
  if (!read?.readable || read.basis === 'unclear') return { code: 'label_unreadable' };
  // Like Open Food Facts volume products: never rename millilitres to grams.
  if (read.basis === 'per_100ml') return { code: 'label_volume_basis' };
  const serving = Number.isFinite(read.servingSizeG) && read.servingSizeG >= 1 && read.servingSizeG <= 2000 ? round1(read.servingSizeG) : null;
  let factor = 1;
  if (read.basis === 'per_serving') {
    if (!serving) return { code: 'label_unreadable' };
    factor = 100 / serving;
  }
  const scaled = (value) => (value === null || value === undefined ? null : round1(value * factor));
  const kj = scaled(read.energyKj);
  let calories = scaled(read.energyKcal);
  const energyFromKj = calories === null && kj !== null;
  if (energyFromKj) calories = round1(kj / 4.184);
  const values = {
    calories,
    protein: scaled(read.protein),
    carbs: scaled(read.carbs),
    sugar: scaled(read.sugar),
    fat: scaled(read.fat),
    saturatedFat: scaled(read.saturatedFat),
    fiber: scaled(read.fiber),
    salt: scaled(read.salt),
  };
  const missing = ['calories', 'protein', 'carbs', 'fat'].filter((key) => values[key] === null);
  const packageG = Number.isFinite(read.packageSizeG) && read.packageSizeG >= 1 && read.packageSizeG <= 10000 ? round1(read.packageSizeG) : null;
  const plausibility = labelPlausibility({ ...values, energyKj: kj });
  return {
    values,
    missing,
    energyFromKj,
    basis: read.basis,
    serving: serving ? { grams: serving, label: cleanText(read.servingLabel, 60) } : null,
    packageG,
    name: cleanText(read.productName, 80),
    brand: cleanText(read.brand, 60),
    plausibility,
  };
}

/**
 * Physical and Atwater plausibility of per-100 g values.
 *
 * Atwater (EU labelling factors, Regulation (EU) 1169/2011 Annex XIV):
 * protein 4, carbohydrate 4, fat 9, fibre 2 kcal/g. Alcohol and polyols are
 * not on every label, so a mismatch is a warning the user resolves with the
 * pack in hand, not a refusal. Impossible values block saving.
 */
export function labelPlausibility(values) {
  const n = (key) => (typeof values?.[key] === 'number' && Number.isFinite(values[key]) ? values[key] : null);
  const issues = [];
  const blocking = [];
  const calories = n('calories'); const protein = n('protein'); const carbs = n('carbs'); const fat = n('fat');
  const fiber = n('fiber') ?? 0; const salt = n('salt') ?? 0; const sugar = n('sugar'); const saturated = n('saturatedFat');
  for (const key of ['calories', 'protein', 'carbs', 'fat', 'sugar', 'saturatedFat', 'fiber', 'salt']) {
    const value = values?.[key];
    if (value !== null && value !== undefined && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) blocking.push('invalid_number');
  }
  if (calories !== null && calories > 950) blocking.push('energy_too_high');
  for (const value of [protein, carbs, fat, sugar, saturated, n('fiber'), n('salt')]) if (value !== null && value > 100) blocking.push('nutrient_over_100g');
  if (sugar !== null && carbs !== null && sugar > carbs + 0.5) blocking.push('sugar_exceeds_carbs');
  if (saturated !== null && fat !== null && saturated > fat + 0.5) blocking.push('saturated_exceeds_fat');
  if ((protein ?? 0) + (carbs ?? 0) + (fat ?? 0) + fiber + salt > 105) blocking.push('mass_exceeds_100g');
  let atwaterKcal = null;
  if (calories !== null && protein !== null && carbs !== null && fat !== null) {
    atwaterKcal = Math.round(protein * 4 + carbs * 4 + fat * 9 + fiber * 2);
    // Labels round each value; small foods need an absolute tolerance.
    if (Math.abs(calories - atwaterKcal) > Math.max(20, calories * 0.15)) issues.push('energy_macro_mismatch');
  }
  const kj = n('energyKj');
  if (kj !== null && calories !== null && kj > 0 && Math.abs(kj / 4.184 - calories) > Math.max(5, calories * 0.08)) issues.push('energy_units_mismatch');
  return { plausible: !issues.length && !blocking.length, issues, blocking: [...new Set(blocking)], atwaterKcal };
}

/** Parses "12,5", "12.5", "<0,5" (→ 0.5) or "" (→ null). Anything else is NaN. */
export function parseLabelNumber(text) {
  const value = String(text ?? '').trim().replace(/^[<≤~]\s*/, '').replace(',', '.');
  if (!value) return null;
  return /^\d+(?:\.\d+)?$/.test(value) ? Number(value) : Number.NaN;
}

/** Form field strings for a normalized read; decimal mark follows the language. */
export function labelFormDefaults(normalized, { barcode = null, language = 'de' } = {}) {
  const text = (value) => (value === null || value === undefined ? '' : String(round1(value)).replace('.', language === 'de' ? ',' : '.'));
  const values = normalized?.values ?? {};
  return {
    name: normalized?.name ?? '',
    brand: normalized?.brand ?? '',
    barcode: barcode && /^\d{7,14}$/.test(barcode) ? barcode : '',
    calories: text(values.calories),
    protein: text(values.protein),
    carbs: text(values.carbs),
    sugar: text(values.sugar),
    fat: text(values.fat),
    saturatedFat: text(values.saturatedFat),
    fiber: text(values.fiber),
    salt: text(values.salt),
    servingG: text(normalized?.serving?.grams ?? null),
    packageG: text(normalized?.packageG ?? null),
  };
}

/**
 * Validates a confirmed form. Returns `{ food }` (per-100 g values, rounded to
 * 0.1) or `{ errors }` listing field names / plausibility codes. Required:
 * name, kcal, protein, carbohydrates, fat. Optional fields may stay empty.
 */
export function customFoodFromForm(form) {
  const errors = [];
  const name = String(form?.name ?? '').replace(/\s+/g, ' ').trim();
  if (!name || name.length > 80) errors.push('name');
  const brand = String(form?.brand ?? '').replace(/\s+/g, ' ').trim();
  if (brand.length > 60) errors.push('brand');
  const barcode = String(form?.barcode ?? '').replace(/\D/g, '');
  if (barcode && !/^\d{7,14}$/.test(barcode)) errors.push('barcode');
  const values = {};
  for (const key of ['calories', 'protein', 'carbs', 'fat']) {
    const value = parseLabelNumber(form?.[key]);
    if (value === null || !Number.isFinite(value)) errors.push(key); else values[key] = round1(value);
  }
  for (const key of ['sugar', 'saturatedFat', 'fiber', 'salt']) {
    const value = parseLabelNumber(form?.[key]);
    if (value === null) continue;
    if (!Number.isFinite(value)) errors.push(key); else values[key] = round1(value);
  }
  const servingG = parseLabelNumber(form?.servingG);
  if (servingG !== null && (!Number.isFinite(servingG) || servingG < 1 || servingG > 2000)) errors.push('servingG');
  const packageG = parseLabelNumber(form?.packageG);
  if (packageG !== null && (!Number.isFinite(packageG) || packageG < 1 || packageG > 10000)) errors.push('packageG');
  const plausibility = labelPlausibility(values);
  if (errors.length || plausibility.blocking.length) return { errors: [...errors, ...plausibility.blocking], plausibility };
  return {
    food: {
      name,
      brand: brand || null,
      barcode: barcode || null,
      per100g: values,
      servingG: servingG === null ? null : round1(servingG),
      packageG: packageG === null ? null : round1(packageG),
    },
    plausibility,
  };
}
