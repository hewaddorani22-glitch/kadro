import { getDictionary } from '@/i18n/active';

/**
 * Database codes ("BLS 4.0 F503100", "USDA 171705") mean nothing to people.
 * Show the trusted source by name; the code stays in the stored item.
 */
export function friendlySource(label: string | null | undefined) {
  if (!label) return null;
  const t = getDictionary().sources;
  if (/^BLS\b/i.test(label)) return t.bls;
  if (/^USDA\b/i.test(label)) return t.usda;
  if (/open\s*food\s*facts/i.test(label)) return t.off;
  if (/schätzung|estimate/i.test(label)) return t.estimate;
  if (/^kandro/i.test(label)) return t.kandro;
  if (/manual|selbst|own/i.test(label)) return t.manual;
  return /\d{4,}/.test(label) ? null : label;
}
