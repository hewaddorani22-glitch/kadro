import {resolveExactBlsFacts} from './bls-reference.mjs';

/** Temporary source spans; never persisted in telemetry or a shared cache. */
const number = '(\\d+\\s+\\d+\\s*/\\s*\\d+|\\d+\\s*/\\s*\\d+|\\d+(?:[.,]\\d+)?|[.,]\\d+)';
const multiplier = `(?:${number}\\s*(?:[×x*]|(?:Portionen?|portions?|servings?|pieces?)\\s+(?:à|a|of|je|each(?:\\s+of)?))\\s*)?`;
const mass = new RegExp(`${multiplier}${number}\\s*(kg|kilograms?|kilogramm|g|grams?|gramm|oz|ounces?|lb|lbs|pounds?)\\b`, 'gi');
const volume = new RegExp(`${multiplier}${number}\\s*(ml|millilit(?:er|re)s?|cl|dl|l|lit(?:er|re)s?)\\b`, 'gi');
const fold = value => String(value).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g,'ss').replace(/(\d),(\d)/g,'$1.$2').replace(/,/g,' ')
  .replace(/\b(?:haferflocken|haferfloken|oat flakes|rolled oats)\b/g,'oats').replace(/\bolivenol\b/g,'olive oil')
  .replace(/\bgekocht(?:e|er|es|en|em)?\b/g,'cooked').replace(/\b(?:eier|ei|eggs)\b/g,'egg')
  .replace(/\b(?:hahnchenfleisch|hahnchen|chicken meat)\b/g,'chicken')
  .replace(/\bmilch\b/g,'milk')
  .replace(/\breis\b/g,'rice').replace(/(\d)\s+%/g,'$1%')
  .replace(/\b(?:mit|with)\s+(?=\d+(?:\.\d+)?%\s*(?:fett|fat)\b)/g,'')
  .replace(/[^a-z0-9%.,]+/g,' ').replace(/\s+/g,' ').trim();
const gramsPerUnit = {kg:1000,kilogram:1000,kilograms:1000,kilogramm:1000,g:1,gram:1,grams:1,gramm:1,oz:28.349523125,ounce:28.349523125,ounces:28.349523125,lb:453.59237,lbs:453.59237,pound:453.59237,pounds:453.59237};

// FAO/INFOODS Density Database v2, "Milk, liquid, whole" (TB): 1.030 g/ml;
// milk's reported specific-gravity range is 1.02–1.05. This is a labelled
// portion estimate, not a measured mass or a universal 1 ml = 1 g conversion.
// https://www.fao.org/4/ap815e/ap815e.pdf
// Powder, condensed/flavoured/plant milk and mixtures deliberately do not match.
function isPlainDairyMilk(identity) {
  const name = fold(identity).replace(/\b\d+(?:\.\d+)?%(?:\s*(?:fett|fat|milkfat)\b)?/g,' ').replace(/\s+/g,' ').trim();
  return /^(?:(?:whole|skimmed|skim|semi skimmed|low fat|fat free|cow|cows|fettarme|fettarm|entrahmte|frische|frisch|h) )?(?:milk|kuhmilch|vollmilch|magermilch)$/.test(name) || /^milk (?:whole|skimmed|skim|low fat)$/.test(name);
}
// Everyday drinks logged by volume. Densities are rounded typical values
// (water/coffee/tea 1.00, beer 1.01, wine 0.99, juices/soft drinks 1.04,
// smoothies/cocoa 1.05); the result is a labelled estimate the user can edit.
// Oils, plant milks and mixtures are deliberately absent and keep the model's
// own estimate instead (see applyDescriptionAmountsTolerant).
const DRINK_DENSITY = [
  [/^(?:(?:still(?:es)?|sparkling|mineral|tap|leitungs) )?(?:water|wasser|mineralwasser|sprudel|sprudelwasser)$/, 1.0],
  [/^(?:(?:black|schwarz(?:er|en)?|filter|iced|eis) )?(?:coffee|kaffee|espresso|americano|tea|tee|grunt?ee|green tea|krautertee|herbal tea|fruchtetee)$/, 1.0],
  [/^(?:(?:fresh|frisch(?:er|en)?) )?(?:(?:orange|apple|apfel|multivitamin|grapefruit|traube|grape|tomato|tomaten|cranberry|ananas|pineapple|mango) ?)?(?:saft|juice|nektar|nectar|schorle|saftschorle)$/, 1.04],
  [/^(?:apfelsaftschorle|apfelschorle|orangensaft|apfelsaft|multivitaminsaft|traubensaft|tomatensaft)$/, 1.04],
  [/^(?:(?:zero|light|diet) )?(?:cola|coke|limo|limonade|lemonade|soda|fanta|sprite|eistee|iced tea|energy drink|energydrink|ginger ale|tonic|tonic water)(?: (?:zero|light))?$/, 1.04],
  [/^(?:(?:alkoholfrei(?:es)?|alcohol free|non alcoholic) )?(?:bier|beer|pils|weizen|weissbier|radler|lager)$/, 1.01],
  [/^(?:(?:rot|weiss|red|white|rose) ?)?(?:wein|wine|sekt|prosecco|champagner|champagne)$/, 0.99],
  [/^(?:smoothie|kakao|cocoa|hot chocolate|trinkschokolade|heisse schokolade)$/, 1.05],
];
function drinkDensity(identity) {
  const name = fold(identity).replace(/\b(?:\d+(?:\.\d+)?|ein|eine|einen|a|an|of|glas|glaser|glass|glasses|flasche|flaschen|bottle|bottles|dose|dosen|can|cans|becher|cup|cups|tasse|tassen|mug|mugs)\b/g, ' ').replace(/\s+/g, ' ').trim();
  for (const [pattern, density] of DRINK_DENSITY) if (pattern.test(name)) return density;
  return null;
}

function milkKind(identity) {
  const name=fold(identity);
  if (/\b(?:whole|vollmilch)\b/.test(name)) return 'whole';
  if (/\b(?:low fat|semi skimmed|fettarm|fettarme)\b/.test(name)) return 'lowFat';
  if (/\b(?:skimmed|skim|fat free|entrahmte|magermilch)\b/.test(name)) return 'skim';
  return null;
}

function quantityNumber(value) {
  const normalized=value.replace(/\s*\/\s*/g,'/').trim();
  const fraction=normalized.match(/^(?:(\d+)\s+)?(\d+)\/(\d+)$/);
  if (fraction) {
    if (Number(fraction[3])===0) throw new Error('amount_out_of_range');
    return Number(fraction[1] ?? 0)+Number(fraction[2])/Number(fraction[3]);
  }
  // Without a locale, 1.000 / 1,000 can mean one or one thousand. Never
  // silently choose the smaller amount. The user can enter 1000 or 1.0.
  if (/\d[.,]\d{3,}$/.test(normalized) && !/^0[.,]/.test(normalized)) throw new Error('amount_ambiguous');
  return Number(normalized.replace(',','.'));
}

function quantityMatches(clause) {
  return [...clause.matchAll(mass),...clause.matchAll(volume)];
}

function countedFood(value) {
  const match=value.trim().replace(/,\s*$/,'').match(new RegExp(`^${number}\\s+(.+)$`,'i'));
  if (!match) return null;
  const identity=match[2].replace(/^(?:Portionen?|portions?|servings?|pieces?)\b\s*(?:of\s+)?/i,'').trim();
  if (!identity || /\b(?:and|und|with|mit|plus|or|oder)\b|[+&]/i.test(identity)) return null;
  return {count:quantityNumber(match[1]),identity};
}

function perPieceClause(clause) {
  const quantities=quantityMatches(clause);
  if (quantities.length!==1) return clause;
  const quantity=quantities[0];
  const before=clause.slice(0,quantity.index).trim();
  const after=clause.slice(quantity.index+quantity[0].length).trim();
  const prefix=before.match(/^(.*?)\s+(?:à|je|jeweils|each)$/i);
  const suffix=/^(?:each|jeweils)$/i.test(after);
  if (!prefix && !suffix) return clause;
  const owner=countedFood(prefix ? prefix[1] : before);
  if (!owner || quantity[1] || (after && !suffix)) throw new Error('amount_ambiguous');
  return `${owner.count} × ${quantity[0]} ${owner.identity}`;
}

function amountClauses(text, exclusions=[]) {
  const normalized=text.replace(/[−–—]/g,'-').replace(/⁄/g,'/').replace(/([0-9]?)([½¼¾])/g,(_,whole,fraction)=>`${whole ? whole+' ' : ''}${{'½':'1/2','¼':'1/4','¾':'3/4'}[fraction]}`);
  // Only digit-comma-digit is potentially decimal. A list does not need a
  // space after the comma ("100 g oats,150 g yogurt").
  const clauses=normalized.split(/\s+(?:und|and)(?:\s+|(?=\d))|;|\n|(?<!\d),|,(?!\d)/i);
  return clauses.flatMap(clause=>{
    // Do not resurrect an explicitly excluded constituent as an unresolved
    // positive row. Preserve unweighed qualifiers such as "without sugar".
    const exclusion=clause.match(/\b(?:ohne|without|no)(?:\s+|(?=\d))/i);
    if (exclusion) {
      // "ohne Sauce mit 200 g Reis": the exclusion ends at the next connector;
      // what follows is a positive constituent again and keeps its amount.
      const rest=clause.slice(exclusion.index+exclusion[0].length);
      const connector=rest.match(/\s+(?:mit|with|plus|und|and)\s+/i);
      const excluded=connector ? rest.slice(0,connector.index) : rest;
      const tail=connector ? rest.slice(connector.index+connector[0].length) : '';
      const quantities=quantityMatches(excluded);
      if (quantities.length>1) throw new Error('amount_ambiguous');
      const quantity=quantities[0];
      const identity=quantity ? excluded.slice(0,quantity.index)+' '+excluded.slice(quantity.index+quantity[0].length) : excluded;
      if (fold(identity)) exclusions.push(fold(identity));
      if (quantity || tail) clause=clause.slice(0,exclusion.index).trimEnd()+(tail ? ' mit '+tail : '');
    }
    const parts=clause.split(/\s+(?:mit|with|plus)\s+|\s*[+&]\s*/i);
    // A connector is safe only when both sides name their own quantity.
    // "100 g rice with chicken" deliberately retains the ambiguity check.
    return parts.length>1 && parts.every(part=>quantityMatches(part).length===1) ? parts : [clause];
  });
}

/** German adjective/plural endings do not change a food's identity. */
const strip = word => word.length > 5 ? word.replace(/(?:e|en|em|er|es)$/, '') : word;
const sameWord = (a, b) => a === b || strip(a) === b || a === strip(b) || strip(a) === strip(b);
const wordsWithin = (inner, outer) => inner.split(' ').filter(Boolean).every(word => outer.split(' ').some(other => sameWord(word, other)));

function chickenCompatible(identity, item) {
  if (!/\b(?:chicken|hahnchenbrust|hahnchenkeule|hahnchenschenkel)\b/.test(identity)) return true;
  const labels=[fold(item.name),fold(item.searchTermEn)];
  // The plain-meat alias must not bind a composite food such as chicken
  // soup merely because its English query contains the word "chicken".
  const plainMeatWord=/^(?:chicken|hahnchenbrust|hahnchenkeule|hahnchenschenkel|meat|breast|thigh|leg|boneless|skinless|raw|cooked|boiled|fried|grilled|steamed|roasted|roh(?:e|er|es|en|em)?|gebraten(?:e|er|es|en|em)?|gegrillt(?:e|er|es|en|em)?|gedampft(?:e|er|es|en|em)?)$/;
  if (identity.split(' ').every(word=>plainMeatWord.test(word)) && labels.some(label=>/\bchicken\b/.test(label) && !label.split(' ').every(word=>plainMeatWord.test(word)))) return false;
  const part=value=>/\b(?:breast|hahnchenbrust)\b/.test(value) ? 'breast' : /\b(?:thigh|leg|hahnchenkeule|hahnchenschenkel)\b/.test(value) ? 'leg' : null;
  const sourcePart=part(identity);
  if (sourcePart && (!labels.some(label=>part(label)===sourcePart) || labels.some(label=>part(label) && part(label)!==sourcePart))) return false;
  const preparation=value=>{
    for (const [kind,pattern] of [['raw',/\b(?:raw|roh(?:e|er|es|en|em)?)\b/],['fried',/\b(?:fried|gebraten(?:e|er|es|en|em)?)\b/],['grilled',/\b(?:grilled|gegrillt(?:e|er|es|en|em)?)\b/],['boiled',/\bboiled\b/],['steamed',/\b(?:steamed|gedampft(?:e|er|es|en|em)?)\b/],['roasted',/\broasted\b/],['cooked',/\bcooked\b/]]) if(pattern.test(value)) return kind;
    return null;
  };
  const sourcePreparation=preparation(identity);
  if (!sourcePreparation) return true;
  const detected=labels.concat(item.preparation).map(preparation).filter(Boolean);
  return detected.length>0 && detected.every(kind=>kind===sourcePreparation || (kind!=='raw' && sourcePreparation!=='raw' && (kind==='cooked' || sourcePreparation==='cooked')));
}

function positiveMention(clause, identity) {
  // This guard recognizes an affirmative mention, not a spoon-to-gram
  // conversion. A separate positive oil portion makes global removal unsafe.
  const affirmative=fold(clause.split(/\b(?:ohne|without|no)(?:\s+|(?=\d))/i)[0]);
  if (affirmative===identity || affirmative.endsWith(' '+identity)) return true;
  if (!affirmative.startsWith(identity+' ')) return false;
  return /^(?:\d+(?:[.,]\d+)?\s+)+(?:tbsp|tsp|tablespoons?|teaspoons?|el|tl|essloffel|teeloffel|cups?)$/.test(affirmative.slice(identity.length+1));
}

function exactOmissionQuery(identity, items) {
  const facts=resolveExactBlsFacts(identity);
  if (!facts || facts.matchConfidence!=='high' || facts.estimatedReference || facts.description.length>160 || fold(facts.description)!==identity) return 'unknown';
  // Recover a genuinely omitted exact food, not a competing interpretation of
  // an existing row (e.g. white vs brown rice). Even a possible overlap keeps
  // the existing explicit correction path instead of completing a double meal.
  const words=new Set(identity.split(' '));
  if (items.some(item=>[item.name,item.searchTermEn].some(label=>fold(label).split(' ').some(word=>words.has(word))))) return 'unknown';
  return facts.description;
}

export function descriptionAmounts(text) {
  const out = [];
  const clauses = amountClauses(text);
  for (let index=0; index<clauses.length; index++) {
    let clause=clauses[index];
    let explicitCount;
    // A comma does not detach "2 eggs, 110 g in total" from its food.
    // Only a single counted constituent may own a following total; never
    // assign a combined rice/chicken weight to whichever item came last.
    const next=clauses[index+1];
    if (next && [...next.matchAll(mass)].length===1) {
      const remainder=next.replace(mass,' ').trim();
      if (/^(?:zusammen|insgesamt|gesamt|in total|total|altogether)$/i.test(remainder)) {
        if ([...clause.matchAll(mass)].length || !/^\s*\d+(?:[.,]\d+)?\s+\S/.test(clause)) throw new Error('amount_ambiguous');
        explicitCount=countedFood(clause)?.count;
        clause+=', '+next; index++;
      } else if (/^(?:each|jeweils)$/i.test(remainder)) {
        const owner=countedFood(clause);
        if (!owner || quantityMatches(clause).length || (index>0 && !quantityMatches(clauses[index-1]).length && countedFood(clauses[index-1]))) throw new Error('amount_ambiguous');
        clause+=', '+next; index++;
      }
    }
    clause=perPieceClause(clause);
    const volumeMatches = [...clause.matchAll(volume)];
    const matches = [...clause.matchAll(mass), ...volumeMatches];
    if (!matches.length) continue;
    if (matches.length !== 1) throw new Error('amount_ambiguous');
    const match = matches[0];
    const prefix=clause.slice(0,match.index).trimEnd();
    if (prefix.endsWith('-')) throw new Error('amount_out_of_range');
    // A range, percentage or unparsed numerical prefix is not the final
    // number's measured weight. Do not accept a partial numeric expression.
    if (/(?:\d\s*(?:to|bis|or|oder|e[+-]?)|\d[.,/]*|\d\s*%\s*(?:of|von)|(?:half|half of|hälfte von))$/i.test(prefix)) throw new Error('amount_ambiguous');
    const identity = (clause.slice(0,match.index)+' '+clause.slice(match.index+match[0].length)).trim();
    const isVolume = volumeMatches.length > 0;
    const isMilk = isVolume && isPlainDairyMilk(identity);
    const density = isVolume ? (isMilk ? 1.03 : drinkDensity(identity)) : 1;
    if (isVolume && density === null) throw new Error('mass_required');
    const unit = match[3].toLowerCase();
    const mlPerUnit = unit === 'cl' ? 10 : unit === 'dl' ? 100 : unit === 'l' || unit.startsWith('lit') ? 1000 : 1;
    const quantity = quantityNumber(match[1] ?? '1') * quantityNumber(match[2]);
    explicitCount ??= match[1] ? quantityNumber(match[1]) : undefined;
    const exact = quantity * (isVolume ? mlPerUnit * density : gramsPerUnit[unit]);
    if (exact < 1 || exact > 5000) throw new Error('amount_out_of_range');
    const grams = Math.round(exact * 10) / 10;
    if (/^(g|grams?|gramm|kg|kilograms?|kilogramm)$/.test(match[3].toLowerCase()) && Math.abs(exact-grams)>1e-7) throw new Error('amount_out_of_range');
    const withoutFatQualifier=identity.replace(/\b(?:mit|with)\s+\d+(?:[.,]\d+)?\s*%\s*(?:fett|fat)\b/gi,' ');
    if (!identity || /\b(?:mit|with|plus|or|oder|each|je|jeweils)\b|[+&]/i.test(withoutFatQualifier) || /^(?:zusammen|insgesamt|gesamt|in total|total|altogether)$/i.test(identity)) throw new Error('amount_ambiguous');
    out.push({identity,grams,span:clause,...(explicitCount===undefined ? {} : {pieceCount:explicitCount}),...(isMilk ? {milkVolumeMl:quantity * mlPerUnit} : isVolume ? {drinkVolumeMl:quantity * mlPerUnit} : {})});
  }
  return out;
}

/** Match each quantity to a unique identity, never to model array order. */
export function applyDescriptionAmounts(detection, text) {
  const amounts=descriptionAmounts(text);
  const exclusions=[];
  const positiveClauses=amountClauses(text,exclusions);
  const excludedRows=new Set();
  for (const identity of new Set(exclusions)) {
    // Exact food identity only: excluding sugar cannot delete a yogurt row
    // whose product name says "without sugar", or an oil-based dressing.
    if (amounts.some(amount=>fold(amount.identity)===identity) || positiveClauses.some(clause=>positiveMention(clause,identity))) throw new Error('amount_ambiguous');
    const matches=detection.items.map((item,index)=>({item,index})).filter(({item})=>{
      const labels=[fold(item.name),fold(item.searchTermEn)];
      return labels.some(label=>label===identity) && labels.every(label=>label===identity || label==='unknown');
    });
    if (matches.length>1) throw new Error('amount_ambiguous');
    if (matches.length===1) excludedRows.add(matches[0].index);
  }
  const items = detection.items.filter((_,index)=>!excludedRows.has(index)).map(item=>({...item}));
  const assigned = new Set();
  for (const amount of amounts) {
    const identity=fold(amount.identity);
    const percentages=identity.match(/\d+(?:\.\d+)?%/g) ?? [];
    const matches=items.map((item,index)=>({item,index})).filter(({item})=>chickenCompatible(identity,item) && [item.name,item.searchTermEn].some(label=>{
      const name=fold(label);
      if (!percentages.every(value=>name.split(' ').includes(value))) return false;
      if (amount.milkVolumeMl) return isPlainDairyMilk(label) && (!milkKind(identity) || milkKind(identity)===milkKind(label));
      // Inflection-tolerant: "gebratene Hähnchenbrust" names "Hähnchenbrust gebraten".
      return name===identity || wordsWithin(name, identity) || wordsWithin(identity, name);
    }));
    if (!matches.length && items.length < 12 && amount.identity.length <= 160) {
      // An explicitly named, weighed constituent cannot disappear just because
      // the model omitted it. A unique exact BLS name may restore its lookup;
      // all other omissions/conflicts retain the unresolved correction row.
      const unresolved={name:amount.identity,searchTermEn:exactOmissionQuery(identity,items),referenceKey:'other',estimatedGrams:amount.grams,estimatedGramsLow:amount.grams,estimatedGramsHigh:amount.grams,preparation:'unknown',hiddenCaloriesRisk:'low',confidence:'medium',optional:false,pieceCount:null,pieceLabel:null};
      const milkRows=amount.milkVolumeMl ? items.map((item,index)=>({item,index})).filter(({item,index})=>!assigned.has(index) && [item.name,item.searchTermEn].some(isPlainDairyMilk)) : [];
      if (milkRows.length>1) throw new Error('amount_ambiguous');
      // A model's conflicting fat variety must not survive beside a second
      // milk row. Keep one source-labelled correction with the given volume.
      const index=milkRows.length===1 ? milkRows[0].index : items.length;
      items[index]=unresolved;
      assigned.add(index);
      if (amount.milkVolumeMl) applyMilkVolume(unresolved, amount);
      if (amount.drinkVolumeMl) unresolved.drinkVolumeEstimated=true;
      continue;
    }
    if (matches.length !== 1 || assigned.has(matches[0].index)) throw new Error('amount_ambiguous');
    const {item,index}=matches[0]; assigned.add(index);
    item.estimatedGrams=item.estimatedGramsLow=item.estimatedGramsHigh=amount.grams;
    // Pure olive oil with an explicitly stated mass has no hidden quantity.
    // This changes only the cloned text item, never photo/mixture uncertainty.
    if (!amount.milkVolumeMl && identity==='olive oil' && [item.name,item.searchTermEn].every(label=>fold(label)==='olive oil')) item.hiddenCaloriesRisk='low';
    if (amount.pieceCount!==undefined) {
      const valid=amount.pieceCount>=0.5 && amount.pieceCount<=99 && typeof item.pieceLabel==='string' && item.pieceLabel.trim();
      item.pieceCount=valid ? amount.pieceCount : null;
      if (!valid) item.pieceLabel=null;
    }
    item.optional=false;
    if (amount.milkVolumeMl) applyMilkVolume(item, amount);
    if (amount.drinkVolumeMl) { item.drinkVolumeEstimated=true; item.pieceCount=null; item.pieceLabel=null; item.confidence='medium'; }
  }
  items.forEach((item,index)=>{if (!assigned.has(index)) item.confidence='medium';});
  return {...detection,items,...(excludedRows.size && items.length ? {title:items.map(item=>item.name).join(', ').slice(0,160)} : {}),...(excludedRows.size || items.some(item=>item.confidence==='medium') ? {confidence:'medium'} : {})};
}

function applyMilkVolume(item, amount) {
  item.milkVolumeEstimated = true;
  item.pieceCount = null;
  item.pieceLabel = null;
  item.confidence = 'medium';
  item.estimatedGramsLow = Math.max(1, Math.round(amount.milkVolumeMl * 1.02 * 10) / 10);
  item.estimatedGramsHigh = Math.min(5000, Math.round(amount.milkVolumeMl * 1.05 * 10) / 10);
}

const AMOUNT_ERRORS = new Set(['mass_required', 'amount_ambiguous', 'amount_out_of_range']);
/**
 * Owner decision 04.10.2026: a description must never fail just because one
 * stated amount cannot be bound safely ("100 g Reis mit Hähnchen", "200 ml
 * Öl"). Unambiguous amounts still bind exactly; otherwise every row keeps the
 * model's own estimate at medium confidence and the result says so, so the
 * user checks the grams on the confirmation screen instead of retyping.
 */
export function applyDescriptionAmountsTolerant(detection, text) {
  try {
    return applyDescriptionAmounts(detection, text);
  } catch (error) {
    if (!(error instanceof Error) || !AMOUNT_ERRORS.has(error.message)) throw error;
    return {...detection, confidence:'medium', amountFallback:true, items:detection.items.map(item=>({...item, confidence:'medium'}))};
  }
}
