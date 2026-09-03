/**
 * German food words to the English USDA uses.
 *
 * The nutrition database is English, so "banane" found nothing and the app
 * apologised for it with a hint to type English instead — which is asking the
 * user to do the translation. Everyday German food words are a closed enough
 * set to translate here, and everything this misses still reaches Open Food
 * Facts, which is indexed in German.
 *
 * Values are what USDA calls the food, not the dictionary translation:
 * "Quark" is closest to "quark cheese" in FDC, and "Rührei" is "scrambled
 * egg", not "stirred egg".
 */
export const GERMAN_FOOD_TERMS = {
  // --- Obst ---------------------------------------------------------------
  apfel: 'apple', äpfel: 'apple', apfelmus: 'apple sauce', birne: 'pear',
  banane: 'banana', bananen: 'banana', orange: 'orange', apfelsine: 'orange',
  mandarine: 'tangerine', clementine: 'tangerine', zitrone: 'lemon', limette: 'lime',
  traube: 'grape', trauben: 'grapes', weintrauben: 'grapes', erdbeere: 'strawberry',
  erdbeeren: 'strawberries', himbeere: 'raspberry', himbeeren: 'raspberries',
  heidelbeere: 'blueberry', heidelbeeren: 'blueberries', blaubeeren: 'blueberries',
  brombeere: 'blackberry', johannisbeere: 'currant', kirsche: 'cherry', kirschen: 'cherries',
  pfirsich: 'peach', nektarine: 'nectarine', aprikose: 'apricot', pflaume: 'plum',
  zwetschge: 'plum', ananas: 'pineapple', mango: 'mango', melone: 'melon',
  wassermelone: 'watermelon', honigmelone: 'honeydew melon', kiwi: 'kiwifruit',
  avocado: 'avocado', dattel: 'dates', datteln: 'dates', feige: 'fig', rosine: 'raisins',
  rosinen: 'raisins', granatapfel: 'pomegranate', grapefruit: 'grapefruit',

  // --- Gemüse -------------------------------------------------------------
  kartoffel: 'potato', kartoffeln: 'potatoes', süßkartoffel: 'sweet potato',
  suesskartoffel: 'sweet potato', tomate: 'tomato', tomaten: 'tomatoes',
  gurke: 'cucumber', karotte: 'carrot', karotten: 'carrots', möhre: 'carrot',
  moehre: 'carrot', möhren: 'carrots', zwiebel: 'onion', zwiebeln: 'onions',
  knoblauch: 'garlic', paprika: 'bell pepper', brokkoli: 'broccoli', broccoli: 'broccoli',
  blumenkohl: 'cauliflower', spinat: 'spinach', salat: 'lettuce', kopfsalat: 'lettuce',
  feldsalat: 'lettuce', rucola: 'arugula', zucchini: 'zucchini', aubergine: 'eggplant',
  champignon: 'mushroom', champignons: 'mushrooms', pilze: 'mushrooms', pilz: 'mushroom',
  erbse: 'peas', erbsen: 'peas', bohne: 'beans', bohnen: 'beans',
  kichererbsen: 'chickpeas', linsen: 'lentils', linse: 'lentils',
  mais: 'corn', kürbis: 'pumpkin', kuerbis: 'pumpkin', rotkohl: 'red cabbage',
  weißkohl: 'cabbage', weisskohl: 'cabbage', sauerkraut: 'sauerkraut', kohl: 'cabbage',
  grünkohl: 'kale', gruenkohl: 'kale', rosenkohl: 'brussels sprouts', spargel: 'asparagus',
  sellerie: 'celery', lauch: 'leek', porree: 'leek', radieschen: 'radish',
  beete: 'beets', rotebeete: 'beets', kohlrabi: 'kohlrabi', oliven: 'olives',

  // --- Getreide, Brot, Beilagen -------------------------------------------
  brot: 'bread', brötchen: 'roll', broetchen: 'roll', semmel: 'roll',
  vollkornbrot: 'whole wheat bread', roggenbrot: 'rye bread', toast: 'toast bread',
  knäckebrot: 'crispbread', reis: 'rice', vollkornreis: 'brown rice', basmatireis: 'rice',
  nudeln: 'pasta', nudel: 'pasta', spaghetti: 'spaghetti', vollkornnudeln: 'whole wheat pasta',
  haferflocken: 'oats', hafer: 'oats', müsli: 'muesli', muesli: 'muesli',
  cornflakes: 'corn flakes', couscous: 'couscous', bulgur: 'bulgur', quinoa: 'quinoa',
  mehl: 'flour', grieß: 'semolina', kartoffelpüree: 'mashed potatoes',
  pommes: 'french fries', bratkartoffeln: 'fried potatoes', knödel: 'dumpling',
  klöße: 'dumpling', semmelknödel: 'bread dumpling', spätzle: 'spaetzle',

  // --- Fleisch und Fisch ---------------------------------------------------
  hähnchen: 'chicken', haehnchen: 'chicken', huhn: 'chicken', hühnchen: 'chicken',
  hähnchenbrust: 'chicken breast', hühnerbrust: 'chicken breast', pute: 'turkey',
  putenbrust: 'turkey breast', truthahn: 'turkey', rind: 'beef', rindfleisch: 'beef',
  steak: 'beef steak', hackfleisch: 'ground beef', rinderhack: 'ground beef',
  gehacktes: 'ground beef', schwein: 'pork', schweinefleisch: 'pork',
  schnitzel: 'pork cutlet', kotelett: 'pork chop', speck: 'bacon', bacon: 'bacon',
  schinken: 'ham', salami: 'salami', wurst: 'sausage', bratwurst: 'bratwurst',
  wiener: 'frankfurter', frikadelle: 'meatball', bulette: 'meatball', lamm: 'lamb',
  ente: 'duck', gans: 'goose', leber: 'liver', fisch: 'fish', lachs: 'salmon',
  thunfisch: 'tuna', forelle: 'trout', kabeljau: 'cod', dorsch: 'cod', seelachs: 'pollock',
  hering: 'herring', matjes: 'herring', makrele: 'mackerel', garnelen: 'shrimp',
  shrimps: 'shrimp', krabben: 'shrimp', muscheln: 'mussels', tintenfisch: 'squid',

  // --- Milchprodukte und Eier ---------------------------------------------
  milch: 'milk', vollmilch: 'whole milk', magermilch: 'skim milk',
  hafermilch: 'oat milk', mandelmilch: 'almond milk', sojamilch: 'soy milk',
  joghurt: 'yogurt', jogurt: 'yogurt', naturjoghurt: 'plain yogurt',
  griechischerjoghurt: 'greek yogurt', quark: 'quark cheese', magerquark: 'quark cheese',
  skyr: 'skyr', käse: 'cheese', kaese: 'cheese', gouda: 'gouda cheese',
  emmentaler: 'swiss cheese', mozzarella: 'mozzarella cheese', feta: 'feta cheese',
  frischkäse: 'cream cheese', hüttenkäse: 'cottage cheese', huettenkaese: 'cottage cheese',
  parmesan: 'parmesan cheese', camembert: 'camembert cheese', butter: 'butter',
  margarine: 'margarine', sahne: 'cream', schlagsahne: 'whipped cream',
  schmand: 'sour cream', sauerrahm: 'sour cream', ei: 'egg', eier: 'eggs',
  rührei: 'scrambled egg', ruehrei: 'scrambled egg', spiegelei: 'fried egg',
  omelett: 'omelet', pudding: 'pudding',

  // --- Nüsse, Fette, Süßes ------------------------------------------------
  nuss: 'nuts', nüsse: 'nuts', walnuss: 'walnuts', haselnuss: 'hazelnuts',
  mandel: 'almonds', mandeln: 'almonds', cashew: 'cashew nuts', erdnuss: 'peanuts',
  erdnüsse: 'peanuts', erdnussbutter: 'peanut butter', pistazien: 'pistachio nuts',
  sonnenblumenkerne: 'sunflower seeds', kürbiskerne: 'pumpkin seeds', leinsamen: 'flaxseed',
  chiasamen: 'chia seeds', öl: 'oil', oel: 'oil', olivenöl: 'olive oil',
  rapsöl: 'canola oil', sonnenblumenöl: 'sunflower oil', kokosöl: 'coconut oil',
  zucker: 'sugar', honig: 'honey', marmelade: 'jam', konfitüre: 'jam', nutella: 'nutella',
  schokolade: 'chocolate', vollmilchschokolade: 'milk chocolate',
  zartbitterschokolade: 'dark chocolate', kekse: 'cookies', keks: 'cookie',
  kuchen: 'cake', torte: 'cake', apfelkuchen: 'apple cake', muffin: 'muffin',
  donut: 'doughnut', eis: 'ice cream', speiseeis: 'ice cream', chips: 'potato chips',
  gummibärchen: 'gummy candy', bonbon: 'candy', riegel: 'candy bar',
  proteinriegel: 'protein bar', müsliriegel: 'granola bar',

  // --- Getränke ------------------------------------------------------------
  wasser: 'water', mineralwasser: 'water', kaffee: 'coffee', espresso: 'espresso',
  cappuccino: 'cappuccino', latte: 'latte', tee: 'tea', schwarztee: 'black tea',
  grüntee: 'green tea', saft: 'juice', apfelsaft: 'apple juice',
  orangensaft: 'orange juice', limonade: 'lemonade', cola: 'cola', bier: 'beer',
  wein: 'wine', rotwein: 'red wine', weißwein: 'white wine', sekt: 'sparkling wine',
  smoothie: 'smoothie', kakao: 'cocoa', trinkschokolade: 'hot chocolate',

  // --- Gerichte ------------------------------------------------------------
  suppe: 'soup', gemüsesuppe: 'vegetable soup', hühnersuppe: 'chicken soup',
  eintopf: 'stew', gulasch: 'goulash', auflauf: 'casserole', lasagne: 'lasagna',
  pizza: 'pizza', burger: 'hamburger', hamburger: 'hamburger',
  cheeseburger: 'cheeseburger', pommesfrites: 'french fries', döner: 'doner kebab',
  doener: 'doner kebab', kebab: 'kebab', sandwich: 'sandwich', wrap: 'wrap',
  salatteller: 'salad', currywurst: 'currywurst',
  risotto: 'risotto', paella: 'paella', sushi: 'sushi', curry: 'curry',
  chili: 'chili con carne', pfannkuchen: 'pancake', waffel: 'waffle',
  brezel: 'pretzel', brezn: 'pretzel', tofu: 'tofu', hummus: 'hummus',
  falafel: 'falafel', pesto: 'pesto', ketchup: 'ketchup', mayonnaise: 'mayonnaise',
  senf: 'mustard', essig: 'vinegar', salz: 'salt', pfeffer: 'pepper spice',

  // --- Zubereitung (Zusatzwörter, die USDA als Modifier kennt) -------------
  gekocht: 'cooked', roh: 'raw', gebraten: 'fried', gegrillt: 'grilled',
  gebacken: 'baked', gedünstet: 'steamed', paniert: 'breaded', geräuchert: 'smoked',
  mager: 'lean', fettarm: 'low fat', vollfett: 'whole', ungesüßt: 'unsweetened',
  gesalzen: 'salted', ungesalzen: 'unsalted', frisch: 'fresh', tiefgekühlt: 'frozen',
};

/**
 * Rewrite a German query into English, word by word.
 *
 * Returns null when nothing was recognised — a query that is already English,
 * or a brand name, must reach USDA unchanged rather than half-translated.
 */
export function translateGermanQuery(query) {
  const words = String(query ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  let hits = 0;
  const out = words.map((word) => {
    const bare = word.replace(/[^a-zäöüß]/g, '');
    const term = GERMAN_FOOD_TERMS[bare];
    if (term) {
      hits += 1;
      return term;
    }
    return word;
  });
  if (!hits) return null;
  const translated = out.join(' ');
  return translated === words.join(' ') ? null : translated;
}
