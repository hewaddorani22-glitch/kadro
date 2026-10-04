import { getDictionary } from '@/i18n/active';
import type { MealAnalysisResult } from '@/services/contracts';
import { matchFood, type FoodUsage } from '@/services/foodSuggest';
import { mealFromSearch } from '@/services/mealAnalysis';

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

export function parseLocalDescription(text: string, usage?: Map<string, FoodUsage>): MealAnalysisResult | null {
  const clean = text.trim();
  if (clean.length < 2 || clean.length > 200) return null;
  // "ohne", "halb so viel", percentages of a dish and similar nuance → AI.
  if (/\b(ohne|without|keine?n?|no|statt|instead|bis|to|oder|or)\b|%|\?/i.test(fold(clean))) return null;
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
