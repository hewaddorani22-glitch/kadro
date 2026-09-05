/** Accept either decimal separator, never partial parses or silent clamping. */
export function parseDecimalInput(text: string, min: number, max: number): number | null {
  const normalized = text.trim().replace(',', '.');
  if (!/^\d+(?:\.\d)?$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) && value >= min && value <= max ? value : null;
}
