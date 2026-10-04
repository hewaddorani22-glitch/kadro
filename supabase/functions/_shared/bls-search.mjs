import { compatibleSearchIdentity } from './search-policy.mjs';
import { BLS_SEARCH_ROWS } from './bls-search-data.mjs';
import { blsEnglishName } from './bls-names.mjs';
import { resolveReviewedStapleFacts } from './bls-reference.mjs';

/**
 * Full-text search over the compact BLS 4.0 snapshot.
 *
 * The complete source has 7,140 foods and prepared dishes with native German
 * and English names. Keeping both names beside the same source code fixes two
 * problems at once: a German query no longer returns an English USDA label,
 * and international dishes can be found by either name without an AI call.
 */

function fold(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

// Bounded bilingual word forms, applied to source labels and queries alike.
// Preparation is retained as a token; inflection/order must not turn a boiled
// egg into a sauce that merely contains one. Display labels stay unchanged.
function componentFold(value) {
  const words = value.replace(/\bchicken egg(s)?\b/g, 'egg').replace(/\bchick peas?\b/g, 'chickpea').split(' ');
  const forms = {
    ei:'egg', eier:'egg', eggs:'egg', huhnerei:'egg', huhnereier:'egg',
    chickpeas:'chickpea',
    karotte:'carrot', karotten:'carrot', mohre:'carrot', mohren:'carrot', carrots:'carrot',
    brokkoli:'broccoli',
    milch:'milk', vollmilch:'whole milk', fett:'fat', fettarm:'low fat', fettarme:'low fat',
    walnuss:'walnut', walnusse:'walnut', walnuts:'walnut',
    linse:'lentil', linsen:'lentil', lentils:'lentil',
    rot:'red', rote:'red', roter:'red', rotes:'red', roten:'red',
    // Search-only wording: offer the explicitly labelled boiled reference for
    // a generic cooked query. No source label or stored preparation changes.
    cooked:'boiled',
    reis:'rice', kartoffel:'potato', kartoffeln:'potato', potatoes:'potato',
    roh:'raw', rohe:'raw', roher:'raw', rohes:'raw', rohen:'raw',
    gekocht:'boiled', gekochte:'boiled', gekochter:'boiled', gekochtes:'boiled', gekochten:'boiled',
  };
  return words.map(word => forms[word] ?? word).join(' ');
}

// Normalize source spelling and common everyday queries, not nutrition data.
function searchFold(value) {
  const text = fold(value).replace(/\bhafer flocken\b/g, 'haferflocken');
  const aliases = { 'naturjoghurt ungesusst':'yogurt', 'plain yogurt unsweetened':'yogurt', mandelmilch:'almond drink', 'almond milk':'almond drink', hafermilch:'oat drink', 'oat milk':'oat drink', raisins:'raisin', almonds:'almond', haferfloken: 'haferflocken', ei: 'chicken egg', eier: 'chicken egg', egg: 'chicken egg', eggs: 'chicken egg', ol: 'oil', mandeln: 'almond', rosinen: 'raisin', naturjoghurt: 'yogurt', oats: 'oat flakes', 'rolled oats': 'oat flakes', bananas: 'banana', bananen: 'banane', kartoffelchips: 'potato crisps', 'potato chips': 'potato crisps' };
  return componentFold(Object.hasOwn(aliases, text) ? aliases[text] : text);
}

const INDEX = BLS_SEARCH_ROWS.map((row) => Object.freeze({
  row,
  de: searchFold(row[1]),
  en: searchFold(blsEnglishName(row)),
  deWords: searchFold(row[1]).split(' '),
  enWords: searchFold(blsEnglishName(row)).split(' '),
}));

const PROCESSED_WORDS = new Set([
  'chips', 'compote', 'dried', 'flour', 'juice', 'nectar', 'powder', 'semolina', 'starch',
  'gesusst', 'getrocknet', 'kompott', 'mehl', 'nektar', 'pulver', 'saft', 'starke',
]);

// Representative everyday rows win ties between dozens of preparation and
// product variants. The boost never creates a match; it only orders rows that
// already match the user's words.
const COMMON_REFERENCE_CODES = new Set([
  'C133000', // oat flakes
  'C559032', // rice noodles, boiled
  'F503100', // banana, raw
  'G750100', // edamame
  'H861000', // tofu
  'H960000', // hummus
  'K110132', // potato, boiled
  'K280100', // ordinary packaged potato crisps, not calorie-reduced or fries
  'M713100', // low-fat quark
  'V416172', // chicken breast, grilled
  'X574512', // edamame, prepared
  'X820162', // rice, boiled
  'X891133', // nasi goreng
  'X9A2100', // porridge with milk, unsweetened
  'Y627112', // salmon sushi
  'Y693932', // fish and chips
  'Y720143', // scrambled eggs
  'Y911060', // hamburger
  'Y921062', // beef/veal doner
  'Y921162', // chicken doner
  'Y9A1050', // falafel
  'Y9A1070', // lahmacun
  'X925012', // plain pancakes, milk 1.5%
  'X929212', // plain pancakes, milk 3.5%
  'Y1A1000', // ordinary beef goulash, not soup
  'Y341023', // ordinary pork goulash
]);

// Bare category names should lead with foods people can actually log, not
// breadcrumbs, milk chocolate or yogurt dressing. These are existing BLS rows;
// explicit requests such as 'milk chocolate' never receive this ordering.
const EVERYDAY_QUERY_CODES = {
  raisin: ['F840100'],
  almond: ['H210100','H210200','H210600'],
  bread: ['B101000', 'B221000', 'B710500'],
  milk: ['M111200', 'M111300', 'M111100'],
  yogurt: ['M141300', 'M141200'],
  // Compound German names (Weizentoastbrot) otherwise lose to gluten-free toast.
  toast: ['B314000', 'B314072', 'B111200', 'B254000', 'B314200'],
};

function scoreName(name, words, query, terms) {
  if (!name || !query) return 0;
  let base = 0;
  // BLS sometimes writes German compounds with a space ("Hafer Flocken"),
  // while people type the ordinary compound ("Haferflocken"). Treat those
  // spellings as the same exact food. This is deliberately equality-only:
  // collapsing arbitrary substrings would make "Reis" match "Milchreis".
  const compoundExact = terms.length === 1 && name.replace(/\s+/g, '') === query;
  if (name === query || compoundExact || (words.length === terms.length && terms.every(term => words.includes(term)))) {
    base = 1200;
  } else if (name.startsWith(`${query} `)) {
    base = 900 - Math.min(words.length, 20);
  } else {
    let exact = 0;
    let prefix = 0;
    for (const term of terms) {
      if (words.includes(term)) {
        exact += 1;
        continue;
      }
      // German compounds are common: "Hähnchen" must find
      // "Hähnchenbrustfilet", but "Reis" must not match "Milchreis".
      if (term.length >= 3 && words.some((word) => word.startsWith(term))) {
        prefix += 1;
        continue;
      }
      return 0;
    }
    const phrase = name.includes(query) ? 120 : 0;
    base = 420 + exact * 70 + prefix * 35 + phrase;
  }

  const extraWords = Math.max(0, words.length - terms.length);
  // A simple preparation of the actual food comes before recipes containing
  // it: banana raw/dried before banana quark; oats dry/boiled before cookies.
  // Explicit compound queries still use their own full phrase normally.
  const basicVariant = terms.every(term => words.includes(term))
    && words.filter(word => !terms.includes(word)).every(word =>
      /^(raw|roh|fresh|frisch|boiled|gekocht|dried|getrocknet|steamed|gedampft|mature|reif)$/.test(word));
  // A bare everyday name means the ordinary food. "Banana" should lead with
  // raw banana, not dried banana or nectar; asking for "banana dried" still
  // finds the processed row because the modifier is then part of the query.
  const unrequestedProcessing = words.filter((word) => PROCESSED_WORDS.has(word) && !terms.includes(word)).length;
  const plainBonus = words.some((word) => word === 'raw' || word === 'roh') ? 10 : 0;
  // Filled dishes and casseroles must not outrank the base food merely
  // because the source name is shorter. Explicit modifiers still win.
  const compoundDish = /\b(gefullt|filled|stuffed|auflauf|casserole)\b/.test(name)
    && !terms.some((term) => /^(gefullt|filled|stuffed|auflauf|casserole)$/.test(term))
    && terms.length === 1;
  // Source word order ("lentil red mature") must not make a full ingredient
  // lose to a dish with a matching prefix ("red lentil soup ...").
  return (basicVariant ? Math.max(base, 1050) : base) + plainBonus + (basicVariant ? 160 : 0) - (compoundDish ? 140 : 0)
    - Math.min(extraWords, 25) * 4
    - unrequestedProcessing * 90;
}

export function searchBlsCatalog(query, language = 'en', limit = 15) {
  const folded = searchFold(query);
  // A bare German category also needs its English word: 'Brot' otherwise
  // misses compounds such as Vollkornbrot and Roggenbrot entirely.
  const aliases = { brot: 'bread', brote: 'bread', milch: 'milk', joghurt: 'yogurt', yoghurt: 'yogurt', toastbrot: 'toast', toasts: 'toast' };
  const needle = Object.hasOwn(aliases, folded) ? aliases[folded] : folded;
  if (needle.length < 2) return [];
  const terms = needle.split(' ').filter(Boolean);
  // A fat-qualified milk query still means dairy, not porridge or chocolate
  // that happens to mention the same percentage. Only rank existing matches;
  // compatibleSearchIdentity retains the exact requested fat percentage.
  const plainMilkQuery = terms.includes('milk') && terms.every(term => /^(milk|whole|low|fat|skimmed|\d+)$/.test(term));
  // The exact, preparation-aware staple vocabulary also applies to the list:
  // "pasta cooked" must not favour a shorter egg-pasta source label, and
  // "gekochte Nudeln" must find the existing Teigwaren row. This does not
  // remove modifiers or introduce a match for an unreviewed query.
  const reviewedStaple = resolveReviewedStapleFacts(query)?.referenceId;
  const preferred = language === 'de' ? 'de' : 'en';

  /**
   * Whether the entry answered the question or merely began with the same
   * letters. "pho" prefix-matches the phosphate in a curing salt, and a hit
   * like that used to end the search before Open Food Facts was ever asked.
   */
  const isStrong = (name, words) => {
    if (!name) return false;
    if (name === needle || name.startsWith(`${needle} `)) return true;
    if (terms.length === 1 && name.replace(/\s+/g, '') === needle) return true;
    return terms.every((term) => {
      if (words.includes(term)) return true;
      // German compounds are answers: "hähnchenbrust" means
      // "Hähnchenbrustfilet". Three letters inside "phosphat" are a
      // coincidence. What separates them is how much of the word the query
      // actually covers.
      return words.some((word) => word.startsWith(term)
        && (term.length >= 5 || term.length / word.length >= 0.6));
    });
  };

  return INDEX
    .map((entry) => {
      if (plainMilkQuery && terms.length > 1 && !String(entry.row[0]).startsWith('M11')) return null;
      if (!compatibleSearchIdentity(query, `${entry.row[1]} ${entry.row[2]}`)) return null;
      const localScore = scoreName(entry[preferred], entry[`${preferred}Words`], needle, terms);
      const otherScore = preferred === 'de'
        ? scoreName(entry.en, entry.enWords, needle, terms)
        : scoreName(entry.de, entry.deWords, needle, terms);
      const code = String(entry.row[0]);
      const reviewedMatch = code === reviewedStaple;
      const matchedScore = Math.max(localScore + (localScore ? 8 : 0), otherScore);
      const everydayRank = Object.hasOwn(EVERYDAY_QUERY_CODES, needle) ? EVERYDAY_QUERY_CODES[needle].indexOf(code) : plainMilkQuery ? EVERYDAY_QUERY_CODES.milk.indexOf(code) : -1;
      const score = reviewedMatch ? 2000 : matchedScore && everydayRank >= 0
        ? 1800 - everydayRank * 10
        : matchedScore + (matchedScore && COMMON_REFERENCE_CODES.has(code) ? 75 : 0);
      const strong = reviewedMatch || isStrong(entry[preferred], entry[`${preferred}Words`])
        || isStrong(entry[preferred === 'de' ? 'en' : 'de'], entry[`${preferred === 'de' ? 'en' : 'de'}Words`]);
      return score ? { entry, score, strong } : null;
    })
    .filter(Boolean)
    .sort((a, b) => (
      b.score - a.score
      || String(a.entry.row[preferred === 'de' ? 1 : 2]).localeCompare(String(b.entry.row[preferred === 'de' ? 1 : 2]))
      || String(a.entry.row[0]).localeCompare(String(b.entry.row[0]))
    ))
    .slice(0, limit)
    .map(({ entry, strong }) => {
      const [code, nameDe, , calories, protein, carbs, fat, fiber] = entry.row;
      const nameEn = blsEnglishName(entry.row);
      return {
        code,
        nameDe,
        nameEn,
        // Lets the caller tell "this is the food" from "this begins with those
        // letters", so a weak hit does not stand in for a real search.
        strong,
        per100g: { calories, protein, carbs, fat, fiber },
      };
    });
}
