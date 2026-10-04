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
