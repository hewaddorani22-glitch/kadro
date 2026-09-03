import { getLocale } from '@/i18n/active';
import { deviceRegion } from '@/i18n';

/**
 * Body measurements are stored in centimetres and kilograms and only ever
 * displayed in something else. Storing what the user typed would mean every
 * calculation had to know which unit it was in, and a user switching units
 * would silently change their own targets.
 *
 * Three systems rather than two, because "imperial" is not one thing: an
 * American says 165 lb, a Brit says 11 stone 11.
 */
export type UnitSystem = 'metric' | 'us' | 'uk';

export const UNIT_SYSTEMS: UnitSystem[] = ['metric', 'us', 'uk'];

export function isUnitSystem(value: unknown): value is UnitSystem {
  return UNIT_SYSTEMS.includes(value as UnitSystem);
}

/**
 * A first guess from where the device says it is, never a lock-in — the profile
 * keeps whatever the user chooses. Only the US and the UK get a non-metric
 * default; everywhere else, including Ireland and Australia, weighs in
 * kilograms.
 *
 * This reads the region, not the app language. Deriving it from the language
 * tag gave every English speaker the British stone, Americans included.
 */
export function defaultUnitSystem(region = deviceRegion()): UnitSystem {
  const code = region?.toUpperCase();
  if (code === 'US') return 'us';
  if (code === 'GB') return 'uk';
  return 'metric';
}

const CM_PER_INCH = 2.54;
const KG_PER_POUND = 0.45359237;
const POUNDS_PER_STONE = 14;

export const usesMetricHeight = (system: UnitSystem) => system === 'metric';
export const usesMetricWeight = (system: UnitSystem) => system === 'metric';

// --- Height ----------------------------------------------------------------

export function cmToTotalInches(cm: number) {
  return Math.round(cm / CM_PER_INCH);
}

export function totalInchesToCm(inches: number) {
  return Math.round(inches * CM_PER_INCH);
}

export function formatHeight(cm: number, system: UnitSystem, locale = getLocale()) {
  if (usesMetricHeight(system)) return `${Math.round(cm)} cm`;
  const total = cmToTotalInches(cm);
  return `${Math.floor(total / 12)}′ ${total % 12}″`;
}

// --- Weight ----------------------------------------------------------------

export function kgToPounds(kg: number) {
  return kg / KG_PER_POUND;
}

export function poundsToKg(pounds: number) {
  return pounds * KG_PER_POUND;
}

/** Decimal separator follows the language, so 84.2 is not shown as 84,2 in English. */
function decimal(value: number, digits: number, locale: string) {
  if (!Number.isFinite(value)) return '0';
  try {
    return value.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  } catch {
    // Hermes hands Intl to the platform; a locale it rejects must not take a
    // screen down over a weight label.
    return value.toFixed(digits);
  }
}

export function formatWeight(kg: number, system: UnitSystem, locale = getLocale(), digits = 1) {
  if (usesMetricWeight(system)) return `${decimal(kg, digits, locale)} kg`;
  const pounds = kgToPounds(kg);
  if (system === 'us') return `${decimal(pounds, digits, locale)} lb`;
  const stone = Math.floor(pounds / POUNDS_PER_STONE);
  const rest = pounds - stone * POUNDS_PER_STONE;
  // Rounding the remainder to 14 would print "11 st 14 lb" instead of "12 st".
  const restRounded = Math.round(rest);
  return restRounded >= POUNDS_PER_STONE
    ? `${stone + 1} st 0 lb`
    : `${stone} st ${restRounded} lb`;
}

/** Just the number, for an input field that shows its unit separately. */
export function weightInputValue(kg: number, system: UnitSystem, locale = getLocale()) {
  return usesMetricWeight(system)
    ? decimal(kg, 1, locale)
    : decimal(kgToPounds(kg), 1, locale);
}

export function weightInputUnit(system: UnitSystem) {
  return usesMetricWeight(system) ? 'kg' : 'lb';
}

/** Parses what the user typed back to kilograms, accepting both separators. */
export function parseWeightInput(raw: string, system: UnitSystem): number | null {
  const value = Number(raw.replace(',', '.').trim());
  if (!Number.isFinite(value) || value <= 0) return null;
  const kg = usesMetricWeight(system) ? value : poundsToKg(value);
  return kg >= 25 && kg <= 400 ? Math.round(kg * 10) / 10 : null;
}

// --- Weekly rate -----------------------------------------------------------

/**
 * The stored rate stays in kilograms so targets never move when units change.
 * 0.25 kg reads as 0.5 lb and 0.5 kg as 1 lb — the rounding every fitness app
 * uses, and well inside the noise of a weekly weigh-in.
 */
export function formatWeeklyRate(kg: number, system: UnitSystem, locale = getLocale()) {
  if (usesMetricWeight(system)) return `${decimal(kg, 2, locale).replace(/[.,]?0+$/, '')} kg`;
  const pounds = Math.round(kgToPounds(kg) * 2) / 2;
  return `${decimal(pounds, pounds % 1 === 0 ? 0 : 1, locale)} lb`;
}

/** Splits kilograms into whole stone plus remaining pounds, for two inputs. */
export function kgToStoneParts(kg: number) {
  const pounds = kgToPounds(kg);
  let stone = Math.floor(pounds / POUNDS_PER_STONE);
  let rest = Math.round(pounds - stone * POUNDS_PER_STONE);
  if (rest >= POUNDS_PER_STONE) {
    stone += 1;
    rest = 0;
  }
  return { stone, pounds: rest };
}

export function stonePartsToKg(stone: number, pounds: number) {
  return Math.round(poundsToKg(stone * POUNDS_PER_STONE + pounds) * 10) / 10;
}

/** Validates a stone-and-pounds pair the same way parseWeightInput does. */
export function parseStoneInput(stoneRaw: string, poundsRaw: string): number | null {
  const stone = Number(stoneRaw.trim() || '0');
  const pounds = Number(poundsRaw.replace(',', '.').trim() || '0');
  if (!Number.isFinite(stone) || !Number.isFinite(pounds)) return null;
  if (stone < 0 || pounds < 0 || pounds >= POUNDS_PER_STONE) return null;
  const kg = stonePartsToKg(stone, pounds);
  return kg >= 25 && kg <= 400 ? kg : null;
}
