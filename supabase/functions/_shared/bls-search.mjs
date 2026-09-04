import { BLS_SEARCH_ROWS } from './bls-search-data.mjs';

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

const INDEX = BLS_SEARCH_ROWS.map((row) => Object.freeze({
  row,
  de: fold(row[1]),
  en: fold(row[2]),
  deWords: fold(row[1]).split(' '),
  enWords: fold(row[2]).split(' '),
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
]);

function scoreName(name, words, query, terms) {
  if (!name || !query) return 0;
  let base = 0;
  if (name === query) {
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
  // A bare everyday name means the ordinary food. "Banana" should lead with
  // raw banana, not dried banana or nectar; asking for "banana dried" still
  // finds the processed row because the modifier is then part of the query.
  const unrequestedProcessing = words.filter((word) => PROCESSED_WORDS.has(word) && !terms.includes(word)).length;
  const plainBonus = words.some((word) => word === 'raw' || word === 'roh') ? 10 : 0;
  return base + plainBonus
    - Math.min(extraWords, 25) * 4
    - unrequestedProcessing * 90;
}

export function searchBlsCatalog(query, language = 'en', limit = 15) {
  const needle = fold(query);
  if (needle.length < 2) return [];
  const terms = needle.split(' ').filter(Boolean);
  const preferred = language === 'de' ? 'de' : 'en';

  return INDEX
    .map((entry) => {
      const localScore = scoreName(entry[preferred], entry[`${preferred}Words`], needle, terms);
      const otherScore = preferred === 'de'
        ? scoreName(entry.en, entry.enWords, needle, terms)
        : scoreName(entry.de, entry.deWords, needle, terms);
      const code = String(entry.row[0]);
      const matchedScore = Math.max(localScore + (localScore ? 8 : 0), otherScore);
      const score = matchedScore + (matchedScore && COMMON_REFERENCE_CODES.has(code) ? 75 : 0);
      return score ? { entry, score } : null;
    })
    .filter(Boolean)
    .sort((a, b) => (
      b.score - a.score
      || String(a.entry.row[preferred === 'de' ? 1 : 2]).localeCompare(String(b.entry.row[preferred === 'de' ? 1 : 2]))
      || String(a.entry.row[0]).localeCompare(String(b.entry.row[0]))
    ))
    .slice(0, limit)
    .map(({ entry }) => {
      const [code, nameDe, nameEn, calories, protein, carbs, fat, fiber] = entry.row;
      return {
        code,
        nameDe,
        nameEn,
        per100g: { calories, protein, carbs, fat, fiber },
      };
    });
}
