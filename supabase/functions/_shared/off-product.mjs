import {openFoodFactsNutrition} from './nutrition.mjs';

export function offMassNutrition(product) {
  // OFF's *_100g field also carries per-100ml labels. Field suffix alone is
  // not evidence of a mass basis. Reject explicit/likely volume products until
  // a verified mass reference/density is available; never rename ml to g.
  const basis=String(product?.nutrition_data_per??'').toLowerCase();
  const quantity=String(product?.quantity??'');
  const unit=String(product?.product_quantity_unit??'').toLowerCase();
  if (/ml|\bl\b/.test(basis)||['ml','l','cl','dl'].includes(unit)||/\d\s*(ml|cl|dl|l)\b/i.test(quantity)) return null;
  return openFoodFactsNutrition(product?.nutriments);
}
export function offMassPortions(product) {
  const label=String(product?.serving_size??'').trim();
  const unit=String(product?.serving_quantity_unit??'').toLowerCase();
  // Require source evidence of mass. Unknown unit is not a gram measurement.
  if(unit && unit!=='g')return [];
  if(!unit && !/\d(?:[.,]\d+)?\s*g\b/i.test(label))return [];
  if(/\d\s*(ml|cl|dl|l)\b/i.test(label))return [];
  const grams=Number(product?.serving_quantity);
  if(!Number.isFinite(grams)||grams<1||grams>2000)return [];
  return [{label:label.slice(0,40)||'1',grams}];
}

/** Fields requested from Open Food Facts; German name/brand fields included. */
export const OFF_PRODUCT_FIELDS = 'code,lang,lc,product_name,product_name_de,product_name_en,generic_name_de,brands,nutriments,serving_size,serving_quantity,serving_quantity_unit,nutrition_data_per,quantity,product_quantity,product_quantity_unit';

/**
 * Codes under which Open Food Facts may hold the same product: a UPC-A code
 * is stored as its 13-digit EAN form with a leading zero and vice versa.
 */
export function offBarcodeCandidates(barcode) {
  const code = String(barcode ?? '');
  if (!/^\d{7,14}$/.test(code)) return [];
  const out = [code];
  if (code.length === 12) out.push(`0${code}`);
  if (code.length === 13 && code.startsWith('0')) out.push(code.slice(1));
  if (code.length === 14 && code.startsWith('0')) out.push(code.slice(1));
  return out;
}

/** First listed brand, trimmed; null when Open Food Facts lists none. */
export function offBrand(product) {
  const raw = Array.isArray(product?.brands) ? product.brands[0] : String(product?.brands ?? '').split(',')[0];
  const brand = String(raw ?? '').replace(/\s+/g, ' ').trim();
  return brand && brand.length <= 60 ? brand : null;
}

/** Net package weight in grams, only when Open Food Facts states grams. */
export function offPackageGrams(product) {
  const unit = String(product?.product_quantity_unit ?? '').toLowerCase();
  const grams = Number(product?.product_quantity);
  if (unit && unit !== 'g') return null;
  if (!unit && !/\d(?:[.,]\d+)?\s*g\b/i.test(String(product?.quantity ?? ''))) return null;
  return Number.isFinite(grams) && grams >= 1 && grams <= 10000 ? grams : null;
}
