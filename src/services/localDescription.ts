import { getDictionary } from '@/i18n/active';
import type { MealAnalysisResult } from '@/services/contracts';
import { matchFood, type FoodUsage } from '@/services/foodSuggest';
import { mealFromSearch, type FoodSearchResult } from '@/services/mealAnalysis';
import type { MealItem } from '@/types/nutrition';
import { needsIngredientCorrection } from '@/utils/ingredientCorrection';

/**
 * Simple descriptions ("2 Toast und 300 ml Milch", "eine Banane", "150 g Reis
 * mit Hähnchenbrust") are resolved on the device: instant, offline and free.
 * Only when every part names a food unambiguously (exact word or reviewed
 * everyday alias) and has a usable amount is a result returned; anything else
 * returns null and goes to the AI analysis as before. Values are the same BLS
 * references the gateway uses; typical portions are labelled as estimates.
 */
const NUMBER_WORDS: Record<string, number> = {
  ein: 1, eine: 1, einen: 1, einem: 1, einer: 1, a: 1, an: 1, one: 1,
  zwei: 2, two: 2, drei: 3, three: 3, vier: 4, four: 4, funf: 5, fuenf: 5, five: 5,
  halbe: 0.5, halber: 0.5, halbes: 0.5, halb: 0.5, half: 0.5,
};
type Unit = 'g' | 'kg' | 'ml' | 'l' | 'slice' | 'glass' | 'cup' | 'pot' | 'can' | 'bottle' | 'tbsp' | 'tsp' | 'piece' | 'portion';
const UNITS: Record<string, Unit> = {
  g: 'g', gr: 'g', gramm: 'g', gram: 'g', grams: 'g', kg: 'kg', ml: 'ml', l: 'l', liter: 'l', litre: 'l',
  scheibe: 'slice', scheiben: 'slice', slice: 'slice', slices: 'slice',
  glas: 'glass', glaser: 'glass', glass: 'glass', glasses: 'glass',
  tasse: 'cup', tassen: 'cup', cup: 'cup', cups: 'cup', becher: 'pot', pot: 'pot',
  dose: 'can', dosen: 'can', can: 'can', cans: 'can', flasche: 'bottle', flaschen: 'bottle', bottle: 'bottle',
  el: 'tbsp', essloffel: 'tbsp', tbsp: 'tbsp', tl: 'tsp', teeloffel: 'tsp', tsp: 'tsp',
  stuck: 'piece', stk: 'piece', piece: 'piece', pieces: 'piece', portion: 'portion', portionen: 'portion', serving: 'portion', servings: 'portion',
};
const fold = (value: string) => value.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss');

// Approximation and linking words that carry no amount or food identity.
const FILLER: Record<string, true> = { von: true, of: true, x: true, ca: true, circa: true, etwa: true, about: true, ungefahr: true, rund: true, approx: true };

type Part = { quantity: number | null; unit: Unit | null; name: string };

function parsePart(raw: string): Part | null {
  const words = fold(raw).replace(/½/g, ' 0.5 ').replace(/(\d),(\d)/g, (_match: string, whole: string, part: string) => whole + '.' + part).replace(/(\d)(?=[a-z])/g, (digit: string) => digit + ' ').replace(/[^a-z0-9.% ]+/g, ' ').split(/\s+/).filter(Boolean);
  let quantity: number | null = null;
  let unit: Unit | null = null;
  while (words.length) {
    const word = words[0];
    if (/^\d+(?:\.\d+)?$/.test(word) && quantity === null) { quantity = Number(word); words.shift(); continue; }
    if (word in NUMBER_WORDS && quantity === null) { quantity = NUMBER_WORDS[word]; words.shift(); continue; }
    if (word in UNITS && unit === null && (quantity !== null || !['l', 'g'].includes(word))) { unit = UNITS[word]; words.shift(); continue; }
    if (word in FILLER) { words.shift(); continue; }
    break;
  }
  const name = words.join(' ').trim();
  if (!name || name.length > 60 || (quantity !== null && (!Number.isFinite(quantity) || quantity <= 0))) return null;
  return { quantity, unit, name };
}

function splitParts(clean: string) {
  // A comma between digits is a decimal ("100,5 g"), never a list separator.
  // Separators are kept so additions after "mit/with" can be told apart.
  const tokens = clean.split(/\s*((?<!\d),|,(?!\d)|;|\+|&|\n|\bund\b|\band\b|\bmit\b|\bwith\b|\bdazu\b)\s*/i);
  const parts: string[] = [];
  const addition: boolean[] = [];
  for (let index = 0; index < tokens.length; index += 2) {
    if (!tokens[index]?.trim()) continue;
    parts.push(tokens[index]);
    addition.push(index > 0 && /^(mit|with|dazu)$/i.test(tokens[index - 1] ?? ''));
  }
  return { parts, addition };
}

export function parseLocalDescription(text: string, usage?: Map<string, FoodUsage>): MealAnalysisResult | null {
  const clean = text.trim();
  if (clean.length < 2 || clean.length > 200) return null;
  // "ohne", "halb so viel", percentages of a dish and similar nuance → AI.
  if (/\b(ohne|without|keine?n?|no|statt|instead|bis|to|oder|or)\b|%|\?/i.test(fold(clean))) return null;
  const { parts, addition } = splitParts(clean);
  if (!parts.length || parts.length > 8) return null;
  const items: MealAnalysisResult['items'] = [];
  let estimated = false;
  for (const [position, raw] of parts.entries()) {
    const part = parsePart(raw);
    if (!part) return null;
    // "Kaffee mit Milch" means a splash, not a glass: unquantified additions
    // after "mit/with" go to the AI path instead of a full default portion.
    if (addition[position] && part.quantity === null && part.unit === null) return null;
    const food = matchFood(part.name, usage);
    if (!food) return null;
    let grams: number | null = null;
    if (part.unit === 'g') grams = part.quantity ?? null;
    else if (part.unit === 'kg') grams = part.quantity !== null ? part.quantity * 1000 : null;
    else if (part.unit === 'ml' || part.unit === 'l') {
      // Drinks only; a volume of a solid food goes to the AI path.
      if (!food.portions?.some(portion => ['glass', 'cup', 'can', 'bottle'].includes(portion.kind ?? ''))) return null;
      // Same labelled density as the gateway: milk 1.03 g/ml, other drinks about 1.
      const density = /^M11/.test(food.source.referenceId ?? '') ? 1.03 : 1;
      grams = (part.quantity ?? 1) * (part.unit === 'l' ? 1000 : 1) * density;
    } else {
      const count = part.quantity ?? 1;
      // "2 Kartoffeln" counts pieces; "Kartoffeln" alone means one serving.
      const countable = ['piece', 'egg', 'slice', 'fillet', 'ball', 'half', 'glass', 'cup', 'can', 'bottle', 'pot'];
      const portion = (part.unit && food.portions?.find(entry => entry.kind === part.unit))
        || (part.quantity !== null && !part.unit ? food.portions?.find(entry => countable.includes(entry.kind ?? '')) : undefined)
        || food.portions?.[0];
      if (!portion) return null;
      grams = count * portion.grams;
      estimated = true;
    }
    if (grams === null || grams < 1 || grams > 5000) return null;
    const rounded = Math.round(grams * 10) / 10;
    const [item] = mealFromSearch(food, rounded).items;
    items.push({ ...item, id: `${item.id}-${items.length}`, confidence: 'medium' });
  }
  const t = getDictionary().errors;
  return {
    // The user's own words are the clearest title ("3l Milch und 2 Toast").
    title: (clean.charAt(0).toUpperCase() + clean.slice(1)).slice(0, 160),
    confidence: 'medium',
    items,
    warnings: [estimated ? t.warnAmountEstimated : t.warnGenericReference],
  };
}

const COUNTABLE = ['piece', 'egg', 'slice', 'fillet', 'ball', 'half', 'glass', 'cup', 'can', 'bottle', 'pot'];

/** One usual serving, or n pieces when the user counted them ("2 Eier"). */
function typicalGrams(food: FoodSearchResult, part: Part | null) {
  const piece = part?.quantity && !part.unit ? food.portions?.find(entry => COUNTABLE.includes(entry.kind ?? '')) : undefined;
  const grams = piece ? part!.quantity! * piece.grams : food.portions?.[0]?.grams ?? food.defaultGrams;
  return Math.round(Math.min(5000, Math.max(1, grams)) * 10) / 10;
}

/** An ingredient Kandro could not name a food for: the user picks it on Confirm. */
function unmatchedRow(name: string, index: number): MealItem {
  return {
    id: `estimate-unmatched-${index}`, name: name.slice(0, 160), amountG: 100, baseAmountG: 100, portionFactor: 1,
    calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, confidence: 'medium', included: true,
    source: { code: 'unmatched', provider: 'kandro-catalog', label: getDictionary().errors.sourceUnmatched },
  };
}

/**
 * "Amount unclear" must not end the flow. When the gateway cannot bind the
 * stated amounts (an older gateway answers 422 mass_required /
 * amount_ambiguous / amount_out_of_range), every food the catalogue knows is
 * prefilled at a typical portion and the rest is left for the user to pick.
 * Returns null when not a single food is recognisable.
 */
export function estimateDescriptionPortions(text: string, usage?: Map<string, FoodUsage>): MealAnalysisResult | null {
  const clean = text.trim();
  if (clean.length < 2 || clean.length > 500) return null;
  const { parts } = splitParts(clean);
  if (!parts.length || parts.length > 8) return null;
  const items: MealItem[] = [];
  let matched = 0;
  for (const raw of parts) {
    const part = parsePart(raw);
    const name = part?.name ?? fold(raw).replace(/[^a-z ]+/g, ' ').replace(/\s+/g, ' ').trim();
    const food = name ? matchFood(name, usage) : null;
    if (food) {
      const [item] = mealFromSearch(food, typicalGrams(food, part)).items;
      items.push({ ...item, id: `${item.id}-${items.length}`, confidence: 'medium' });
      matched += 1;
    } else if (name) {
      items.push(unmatchedRow(raw.trim(), items.length));
    }
  }
  if (!matched) return null;
  const t = getDictionary().errors;
  return {
    title: (clean.charAt(0).toUpperCase() + clean.slice(1)).slice(0, 160),
    confidence: 'medium',
    correctionRequired: true,
    estimatedPortion: true,
    items,
    warnings: [t.warnAmountEstimated, ...(matched < items.length ? [t.warnUnmatched] : [])],
  };
}

/**
 * An ingredient the gateway returned without values is looked up in the
 * on-device catalogue at its detected amount. Only an unambiguous match
 * (exact word or reviewed alias) is used; the ids are returned so Confirm can
 * mark those rows "Bitte prüfen".
 */
export function resolveUnmatchedItems(items: MealItem[], usage?: Map<string, FoodUsage>): { items: MealItem[]; matchedIds: string[] } {
  const matchedIds: string[] = [];
  const next = items.map((item) => {
    if (item.source?.code !== 'unmatched' || !needsIngredientCorrection(item)) return item;
    const food = matchFood(item.name, usage);
    if (!food) return item;
    const grams = Number.isFinite(item.amountG) && item.amountG >= 1 && item.amountG <= 5000 ? item.amountG : typicalGrams(food, null);
    const [replacement] = mealFromSearch(food, grams).items;
    matchedIds.push(item.id);
    return { ...replacement, id: item.id, included: true, confidence: 'medium' as const };
  });
  return { items: next, matchedIds };
}
