/** Search lists and automatic identity matching deliberately have separate gates. */
export const SEARCH_VERSION='2026-10-03-v5';
export function isSearchQuery(term) {
  const text=String(term??'').trim().toLowerCase();
  return text.length>=2 && text.length<=120 && /[a-zäöüß]/i.test(text)
    && !/^(other|unknown|none|n\/a|null|undefined|food|meal|dish|ingredient)$/.test(text);
}
export function searchIdentity(value) {
  return String(value).toLowerCase().replace(/(\d),(\d)/g,'$1.$2').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/ß/g,'ss').replace(/\bgekocht(?:e|er|es|en|em)\b/g,'gekocht').replace(/\broh(?:e|er|es|en|em)\b/g,'roh');
}
/** A list may contain alternatives, but must not contradict explicit qualifiers. */
export function compatibleSearchIdentity(query, names) {
  const q=searchIdentity(query),text=searchIdentity(names);
  const percentages=q.match(/\d+(?:\.\d+)?\s*%/g)??[];
  const actualPercentages=(text.match(/\d+(?:\.\d+)?\s*%/g)??[]).map(p=>Number(p.replace('%','').trim()));
  if(percentages.length && !percentages.every(p=>actualPercentages.includes(Number(p.replace('%','').trim())))) return false;
  const opposed=[[/\b(raw|roh|trocken|dry|uncooked)\b/,/\b(gekocht|boiled|cooked|fried|gebraten|steamed)\b/],
    [/\b(gekocht|boiled|cooked|gebraten|fried)\b/,/\b(raw|roh|trocken|dry|uncooked)\b/],
    [/\b(ungesusst|unsweetened|ohne zucker|no sugar)\b/,/\b(gesusst|sweetened|sugared)\b/]];
  if(opposed.some(([wanted,wrong])=>wanted.test(q)&&wrong.test(text)))return false;
  if(/\b(ohne|without)\s+(sauce|sosse)\b/.test(q)&&/\b(sauce|sosse)\b/.test(text)&&!/\b(ohne|without)\s+(sauce|sosse)\b/.test(text))return false;
  return true;
}
