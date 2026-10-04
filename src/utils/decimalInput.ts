/** Accept either decimal separator, never partial parses or silent clamping. */
export function parseDecimalInput(text: string, min: number, max: number): number | null {
  const normalized = text.trim().replace(',', '.');
  if (!/^\d+(?:\.\d)?$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) && value >= min && value <= max ? value : null;
}

/** Whole-unit shortcuts preserve an entered tenth and respect the unit's bounds. */
export function stepWeightInput(value: number, direction: -1 | 1, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round((value + direction) * 10) / 10));
}
