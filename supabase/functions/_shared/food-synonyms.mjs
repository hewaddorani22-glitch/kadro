/**
 * Everyday German food words that the BLS source labels spell differently.
 *
 * People type "Hühnchen", BLS says "Hähnchen"; people type "Jogurt", the label
 * says "Joghurt"; Austrians type "Topfen" for the same Quark. These rewrites
 * only change the words of a query, never a label or a nutrient value, and a
 * rewrite only ever points at a word that exists in the reviewed BLS names.
 *
 * Shared by the gateway catalogue search (bls-search.mjs) and the instant
 * on-device suggestions (src/services/foodSuggest.ts).
 */

/** Lower-case, accents and umlaut spellings folded: "Hühnchen" = "huehnchen" = "huhnchen". */
export function synonymKey(word) {
  return String(word ?? '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u')
    .replace(/[^a-z0-9]+/g, '');
}

// Spelling, regional and compound variants. Values use the plain folded
// spelling of the BLS label words (ä → a, ß → ss), keys use synonymKey().
const SPELLING = {
  huhnchen: 'hahnchen', hunchen: 'hahnchen', hendl: 'hahnchen', poulet: 'hahnchen', huhnerfleisch: 'hahnchen', hahnchenfleisch: 'hahnchen',
  huhnchenbrust: 'hahnchen brustfilet', huhnerbrust: 'hahnchen brustfilet', huhnerbrustfilet: 'hahnchen brustfilet',
  hahnchenbrust: 'hahnchen brustfilet', hahnchenbrustfilet: 'hahnchen brustfilet', hahnchenfilet: 'hahnchen brustfilet', pouletbrust: 'hahnchen brustfilet',
  jogurt: 'joghurt', jogurts: 'joghurt', joghurts: 'joghurt', naturjogurt: 'naturjoghurt',
  quarks: 'quark', topfen: 'quark', magertopfen: 'magerquark',
  huttenkase: 'korniger frischkase', huttenkas: 'korniger frischkase',
  hack: 'hackfleisch', gehacktes: 'hackfleisch', faschiertes: 'hackfleisch', rinderhack: 'rind hackfleisch', rinderhackfleisch: 'rind hackfleisch',
  schweinehack: 'schwein hackfleisch', schweinehackfleisch: 'schwein hackfleisch',
  putenbrust: 'pute brust', putenbrustfilet: 'pute brust', putenfleisch: 'pute fleisch', truthahn: 'pute',
  lachsfilet: 'lachs', thunfischfilet: 'thunfisch',
  nudel: 'teigwaren', nudeln: 'teigwaren',
  erdapfel: 'kartoffel', erdapfeln: 'kartoffel', grumbeere: 'kartoffel',
  paradeiser: 'tomate', paradeisern: 'tomate',
  obers: 'sahne', schlagobers: 'schlagsahne', rahm: 'sahne',
  marille: 'aprikose', marillen: 'aprikose', ribisel: 'johannisbeere', karfiol: 'blumenkohl', kren: 'meerrettich',
  rubli: 'karotte', mohrrube: 'karotte', mohrruben: 'karotte', gelberube: 'karotte',
  kukuruz: 'mais', zuckermais: 'mais',
};

// English words a German reader types for a German food. Only applied when
// the app language is German, so English search keeps English ranking.
const ENGLISH_TO_GERMAN = {
  chicken: 'hahnchen', chickenbreast: 'hahnchen brustfilet', yogurt: 'joghurt', yoghurt: 'joghurt',
  cottagecheese: 'korniger frischkase', turkey: 'pute', salmon: 'lachs', tuna: 'thunfisch', mince: 'hackfleisch',
};

// English spellings that differ from the English BLS labels.
const ENGLISH_SPELLING = { yoghurt: 'yogurt', yoghurts: 'yogurt', yogurts: 'yogurt' };

/** The canonical words for one typed word, or null when it has none. */
export function foodSynonym(word, language = 'de') {
  const key = synonymKey(word);
  if (!key) return null;
  if (language === 'de') return SPELLING[key] ?? ENGLISH_TO_GERMAN[key] ?? null;
  return ENGLISH_SPELLING[key] ?? SPELLING[key] ?? null;
}

/**
 * Rewrites the words of an already folded query ("huhnchen gegrillt" →
 * "hahnchen gegrillt"). Two-word compounds ("chicken breast") are tried
 * joined first. Returns the input unchanged when nothing applies.
 */
export function applyFoodSynonyms(folded, language = 'de') {
  const words = String(folded ?? '').split(' ').filter(Boolean);
  const out = [];
  for (let index = 0; index < words.length; index += 1) {
    const pair = index + 1 < words.length ? foodSynonym(words[index] + words[index + 1], language) : null;
    if (pair) { out.push(pair); index += 1; continue; }
    out.push(foodSynonym(words[index], language) ?? words[index]);
  }
  return out.join(' ');
}

const SUFFIXES = ['en', 'n', 'e', 's'];

/**
 * Plural-tolerant comparison of one typed word with one label word:
 * "tomaten" = "tomate", "joghurts" = "joghurt". Only the typed word may carry
 * the extra ending (a shorter typed word is already a prefix match), and the
 * stem keeps at least four letters, so "eis" never becomes "ei" and "brie"
 * never becomes "bries".
 */
export function sameFoodWord(term, word) {
  if (term === word) return true;
  for (const suffix of SUFFIXES) {
    if (term.length - suffix.length >= 4 && term.endsWith(suffix) && term.slice(0, -suffix.length) === word) return true;
  }
  return false;
}
