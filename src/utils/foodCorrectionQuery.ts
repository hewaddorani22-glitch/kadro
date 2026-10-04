/**
 * A suggestion search, never an automatic nutrient match. Only a plain milk
 * name with one fat percentage is eligible. Preserve every other qualifier:
 * plant-based, lactose-free, flavoured and mixed foods need their own search.
 */
export function milkCorrectionQuery(name: string): 'Milch' | 'milk' | null {
  const text = name.toLowerCase().trim();
  const percentages = text.match(/\d+(?:[.,]\d+)?\s*%/g);
  if (percentages?.length !== 1) return null;
  const identity = text.replace(percentages[0], ' ')
    .replace(/\b(fettanteil|fett|fat|mit|with)\b/g, ' ')
    .replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
  if (identity === 'milch' || identity === 'kuhmilch') return 'Milch';
  if (identity === 'milk' || identity === 'cow milk' || identity === "cow's milk") return 'milk';
  return null;
}
