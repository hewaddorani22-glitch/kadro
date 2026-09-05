/**
 * Curated German composite dishes from Bundeslebensmittelschlüssel (BLS) 4.0.
 *
 * Values are per 100 g. The compact snapshot keeps the deployed function small
 * and, more importantly, makes a known German dish deterministic: the model
 * identifies the dish and portion, but never invents its nutrient values.
 *
 * Source: Max Rubner-Institut, BLS 4.0 (2025), CC BY 4.0
 * DOI: https://doi.org/10.25826/Data20251217-134202-0
 */
import { BLS_SEARCH_ROWS } from './bls-search-data.mjs';

export const BLS_SOURCE = Object.freeze({
  name: 'Bundeslebensmittelschlüssel 4.0',
  version: '4.0 (2025)',
  license: 'CC BY 4.0',
  doi: '10.25826/Data20251217-134202-0',
  url: 'https://blsdb.de/download',
});

const rows = String.raw`
currywurst_pommes|Y944062|Currywurst mit Pommes frites|450|217|6.58|17.44|13.04|1.42
doner_chicken|Y921162|Döner Kebab mit Geflügel, Rohkost und Sauce|400|199|13.08|18|7.9|1.6
doner_beef|Y921062|Döner Kebab mit Kalb/Rind, Rohkost und Sauce|400|177|11.2|20|5.3|1.7
pizza_margherita|X912033|Pizza Margherita|350|238|7.77|20|13.55|1.9
pizza_funghi|X912133|Pizza Funghi|370|202|7.29|17|11.24|2
pizza_salame|X914133|Pizza Salami|380|251|9.6|16|16|1.7
pizza_tonno|X915233|Pizza Tonno|400|228|11.16|15|13.3|1.6
pizza_hawaii|X9A5010|Pizza Hawaii|380|207|9.89|17|10.52|1.6
pizza_prosciutto|X912412|Pizza Prosciutto|380|224|11.36|16|12.17|1.6
pizza_special|X9A5020|Pizza Spezial mit Schinken und Salami|400|247|12.98|15|14.48|1.5
lasagna_al_forno|X730033|Lasagne al forno|450|197|9.69|8.9|13.3|1.2
pasta_bolognese|X740433|Eierteigwaren mit Bologneser Sauce|450|164|8.3|13.9|8|1.2
wholegrain_pasta_bolognese|X702412|Vollkorn-Eierteigwaren mit Bologneser Sauce|450|166|9.16|9|9.8|2.2
kaesespaetzle|X711412|Käsespätzle|400|155|8|16.6|5.84|1.6
maultaschen_cooked|X760112|Schwäbische Maultaschen mit Hackfleisch, gegart|350|132|10.4|8.032|6.02|2.2
maultaschen_onions|X760312|Schwäbische Maultaschen mit gebratenen Zwiebeln|350|116|8.186|8.38|4.95|2.2
maultaschen_spinach|X7A3000|Maultaschen mit Spinatfüllung, gegart|350|96|4.4|13|2.53|1.7
pork_schnitzel_breaded|Y332132|Schweineschnitzel paniert, gebraten|200|220|22.65|7.59|10.6|0.69
turkey_schnitzel_breaded|Y583312|Putenschnitzel paniert, gebraten|200|204|22.72|7.07|9.1|0.63
currywurst_roll|Y943062|Currywurst mit Curryketchup und Brötchen|350|222|9.11|19.95|11.36|1.45
bratwurst_potato_salad|Y942132|Bratwurst mit Kartoffelsalat und Senf|450|188|5.6|6.43|15.2|1
meatball_potato_salad|Y912130|Frikadelle mit Kartoffelsalat und Senf|450|198|8.4|7.77|14.5|1.1
koenigsberger_klopse|Y036333|Königsberger Klopse mit Kapernsauce|400|140|9.4|3.52|9.7|0.4
beef_roulade_sauce|Y151112|Rinderroulade geschmort mit Sauce|300|133|12|1.8|8.5|0.4
goulash_soup|X456133|Ungarische Gulaschsuppe mit Rindfleisch und Kartoffeln|500|59|2.8|3|3.8|0.5
goulash_beef|Y1A1000|Gulasch mit Rindfleisch (keine Suppe)|300|124|12.95|4.2|5.9|1
goulash_pork|Y341023|Gulasch mit Schweinefleisch (keine Suppe)|300|150|18.2|0.6|8.3|0.2
chili_con_carne|X469753|Chili con carne mit Rinderhackfleisch|450|158|9.9|9|7.9|4.9
lentil_soup|X462513|Linsensuppe mit Gemüse|500|82|4.53|10|1.9|3.4
lentil_soup_sausage|X4A8050|Linsensuppe mit Gemüse und Wiener Würstchen|500|115|5.78|9|5.5|2.8
pea_soup_sausage|X464433|Erbsensuppe mit Speck und Wiener Würstchen|500|103|5.38|5|6.3|2.5
chicken_soup|X4A1020|Hühnersuppe mit Hühnerfleisch und Suppengemüse|500|56|5.5|0.4|3.5|0.5
potato_soup|X449613|Gebundene Kartoffelsuppe mit Gemüsebrühe|500|62|1.11|10|1.8|0.7
potato_soup_sausage|X450033|Kartoffelsuppe mit Gemüsebrühe und Brühwurst|500|93|2.95|8|5.4|0.5
tomato_soup|X444343|Gebundene Tomatensuppe|450|44|0.49|1.89|3.68|0.5
scrambled_eggs|Y720143|Rührei gebraten|180|203|12.88|0.39|16.61|0.1
fried_egg|Y710142|Spiegelei gebraten|120|210|13.419|0.353|17.193|0
omelette|Y730163|Omelett gebraten|200|197|12.23|0.66|16.21|0
potato_pancakes|X655022|Kartoffelpuffer oder Reibekuchen, gebraten|300|206|4.23|18.08|12.61|1.5
potato_gratin|X640053|Kartoffelgratin|350|128|3.42|15|5.77|1.14
pancakes|X925012|Ungesüßte Pfannkuchen mit Milch, gebraten|300|211|8.75|31.6|5|2.15
milk_rice_cinnamon|X810123|Milchreis mit Zucker und Zimt|400|142|4.83|23.2|3.18|0.6
semolina_pudding|X951113|Grießbrei gesüßt|400|100|4.29|12.94|3.39|0.35
porridge_milk|X9A2100|Ungesüßtes Porridge mit Vollmilch|350|134|6.29|15|4.9|2.232
muesli_yogurt_fruit|X092510|Ungesüßtes Müsli mit Joghurt und Früchten|350|117|5.03|12.7|4.3|2.4
bircher_muesli|X0A5000|Bircher-Müsli mit Apfel, Rosinen, Sahne und Nüssen|350|114|1.8|14.6|4.7|2.4
milk_rice_red_fruit|Y8A4080|Milchreis mit roter Grütze|400|123|3.8|20.7|2.4|1.2
apple_strudel|D540200|Apfelstrudel aus Strudelteig|180|220|3.3|30.4|8.6|3.5
berliner_jam|D7A6200|Berliner oder Krapfen mit Konfitüre|75|329|6.2|44|13.7|2.4
germknoedel|X985162|Germknödel mit Pflaumenmus und Mohn|250|287|7.13|41|9.7|3.33
dampfnudel|Y813442|Süße Dampfnudel, gebraten|250|348|7.67|42|16.05|2.53
hamburger|Y911060|Hamburger|220|190|10.01|19.72|7.31|1.7
cheeseburger|Y911160|Cheeseburger|250|202|10.6|18.1|9.1|1.5
chicken_wrap|Y599112|Wrap mit Salat und gebratener Hähnchenbrust|350|153|12.18|15.9|4.2|1.3
falafel_wrap|Y9A1060|Falafel im Fladenbrot mit vegetarischer Füllung|400|156|5.4|14|7.8|2.8
beef_burrito|X9A4000|Burrito mit Gemüse, Rinderhackfleisch und Käse|450|289|11.5|35|11|1.8
salmon_sushi|Y627112|Sushi mit Lachs|300|126|7.3|16.4|3.19|0.8
lahmacun_chicken|Y9A1080|Lahmacun mit Geflügel, Rohkost und Sauce|450|186|9.1|17|8.5|2.2
couscous_vegetables|X9A1000|Gebratener Couscous mit Gemüse|400|118|3.03|14.4|4.8|2.3
vegetable_rice_cheese|X880213|Gemüsereis mit Wurzelgemüse und Käse|400|134|3.8|18|4.6|2.2
nasi_goreng|X891133|Nasi Goreng mit Gemüse und Schweinefleisch|450|110|10.2|14|1|2
fish_fingers_oven|T930162|Fischstäbchen aus dem Ofen|250|206|13.75|16.32|9.33|0.909
hamburg_pannfisch|Y695623|Hamburger Pannfisch mit Bratkartoffeln und Senfsauce|450|181|8.4|9.79|11.59|1.8
salmon_vegetables|Y640112|Gedünsteter Lachs auf Gemüse|400|136|11.64|1.9|8.6|1.6
chicken_vegetables|Y562112|Gebratene Hähnchenbrust mit gedünstetem Kaisergemüse|400|98|13.94|2.5|3.3|1.4
gyros|Y384112|Schweine-Gyros, gebraten|250|230|24.35|0.5|14.48|0.3
`.trim();

const englishNameByCode = new Map(BLS_SEARCH_ROWS.map((row) => [row[0], row[2]]));

export const BLS_REFERENCE_MEALS = Object.freeze(rows.split('\n').map((row) => {
  const [key, code, nameDe, defaultGrams, calories, protein, carbs, fat, fiber] = row.split('|');
  return Object.freeze({
    key,
    code,
    nameDe,
    nameEn: englishNameByCode.get(code) ?? nameDe,
    defaultGrams: Number(defaultGrams),
    per100g: Object.freeze({
      calories: Number(calories),
      protein: Number(protein),
      carbs: Number(carbs),
      fat: Number(fat),
      fiber: Number(fiber),
    }),
  });
}));

export const BLS_REFERENCE_KEYS = Object.freeze(BLS_REFERENCE_MEALS.map((meal) => meal.key));

/** Short prompt catalog: the schema enforces the key; this explains its dish. */
export const BLS_MODEL_CATALOG = BLS_REFERENCE_MEALS
  .map((meal) => `${meal.key}=${meal.nameDe}`)
  .join('; ');

const byKey = new Map(BLS_REFERENCE_MEALS.map((meal) => [meal.key, meal]));
const byCode = new Map(BLS_REFERENCE_MEALS.map((meal) => [meal.code, meal]));

export function getBlsReference(referenceKey) {
  return byKey.get(String(referenceKey ?? '')) ?? null;
}

export function getBlsReferenceByCode(code) {
  return byCode.get(String(code ?? '')) ?? null;
}

export function resolveBlsFacts(item) {
  const meal = getBlsReference(item?.referenceKey);
  if (!meal) return resolveExactBlsFacts(item?.searchTermEn);
  return {
    provider: 'bls',
    referenceId: meal.code,
    label: `BLS 4.0 ${meal.code}`,
    description: meal.nameDe,
    ...meal.per100g,
  };
}

// Exact identity and preparation only. Never use fuzzy search rankings to
// silently substitute another food or turn dried food into fresh food.
const exactFoodKey = (text) => String(text ?? '').toLowerCase().replace(/\bpitted\b/g, '').replace(/[^a-z0-9 ]/g, ' ')
  .split(/\s+/).filter(Boolean).map(word => word.length > 3 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word).sort().join(' ');
const exactBlsRows = new Map();
for (const row of BLS_SEARCH_ROWS) {
  const key = exactFoodKey(row[2]);
  // Ambiguous names must fall back to USDA, not select an arbitrary row.
  exactBlsRows.set(key, exactBlsRows.has(key) ? null : row);
}
export function resolveExactBlsFacts(term) {
  const row = exactBlsRows.get(exactFoodKey(term));
  if (!row) return null;
  const [code, , description, calories, protein, carbs, fat, fiber] = row;
  if (![calories, protein, carbs, fat].every(value => Number.isFinite(value) && value >= 0)) return null;
  return { provider: 'bls', referenceId: code, label: `BLS 4.0 ${code}`, description,
    calories, protein, carbs, fat, fiber, matchConfidence: 'high' };
}

/**
 * Free-text search over the German dish references.
 *
 * USDA is an English database, so a German user typing "Hähnchen" finds
 * nothing there. These 64 dishes are the part of the catalogue that answers in
 * German — and their values are vetted rather than matched, so they belong at
 * the top of a result list, not below it.
 */
export function searchBlsReferences(query, limit = 6, language = 'de') {
  const needle = String(query ?? '').trim().toLowerCase();
  if (needle.length < 2) return [];
  const stopWords = new Set(['and', 'or', 'the', 'with', 'und', 'oder', 'mit', 'der', 'die', 'das']);
  const terms = needle.split(/\s+/).filter((term) => term && !stopWords.has(term));
  if (!terms.length) return [];
  return BLS_REFERENCE_MEALS
    .map((meal) => {
      const localName = (language === 'de' ? meal.nameDe : meal.nameEn).toLowerCase();
      const otherName = (language === 'de' ? meal.nameEn : meal.nameDe).toLowerCase();
      const localMatched = terms.filter((term) => localName.includes(term)).length;
      const otherMatched = terms.filter((term) => otherName.includes(term)).length;
      const matched = Math.max(localMatched, otherMatched);
      if (matched !== terms.length) return null;
      // Prefer the dish whose name is mostly the query rather than one that
      // merely contains it: "Reis" should not lead with a rice pudding.
      const name = localMatched >= otherMatched ? localName : otherName;
      return { meal, score: matched / terms.length + needle.length / name.length + (localMatched ? 0.02 : 0) };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || (language === 'de' ? a.meal.nameDe : a.meal.nameEn).localeCompare(language === 'de' ? b.meal.nameDe : b.meal.nameEn))
    .slice(0, limit)
    .map(({ meal }) => meal);
}
