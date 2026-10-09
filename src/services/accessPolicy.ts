export type AccessRecord = {
  experiment: 'paywall_access_v1';
  variant: 'A' | 'B' | 'excluded' | 'unassigned';
  source: 'qa' | 'public';
  environment: 'production' | 'local' | 'testflight' | 'review';
  hard: boolean;
  access: 'free' | 'active' | 'inactive' | 'unknown';
  validUntil: string | null;
  enrollmentOpen?: boolean;
};
export const FREE_ACCESS: AccessRecord = { experiment: 'paywall_access_v1', variant: 'excluded', source: 'public', environment: 'production', hard: false, access: 'free', validUntil: null };

export const UNRESOLVED_ACCESS: AccessRecord = { ...FREE_ACCESS, variant: 'unassigned', access: 'unknown' };

export function parseAccessRecord(value: unknown): AccessRecord {
  const v = value as AccessRecord;
  if (!v || v.experiment !== 'paywall_access_v1' || !['A', 'B', 'excluded', 'unassigned'].includes(v.variant)
    || !['qa', 'public'].includes(v.source) || !['production', 'local', 'testflight', 'review'].includes(v.environment)
    || typeof v.hard !== 'boolean' || !['free', 'active', 'inactive', 'unknown'].includes(v.access)
    || (v.hard && v.variant !== 'B') || (v.hard && v.access === 'free')
    || (v.validUntil !== null && (typeof v.validUntil !== 'string' || !Number.isFinite(Date.parse(v.validUntil))))) throw Error('access_response_invalid');
  return v;
}

/** Assignment never follows StoreKit intro eligibility after enrollment. */
export function resolveAccess(record: AccessRecord, paymentPending = false, now = Date.now()) {
  if (record.access === 'active' && record.validUntil && Date.parse(record.validUntil) > now) return 'active' as const;
  if (!record.hard) return record.access === 'unknown' ? 'verification' as const : 'free' as const;
  if (paymentPending) return 'pending' as const;
  if (record.access === 'inactive') return 'locked' as const;
  return 'verification' as const;
}

// '/first-scan' only offers choices; the scan it leads to is checked as usual.
const availableWithoutNewUse = new Set(['/paywall', '/account-help', '/saved-meals', '/privacy', '/terms', '/sources', '/account-deletion', '/data-consent', '/onboarding', '/reminder-setup', '/access-setup', '/first-scan']);
export function routeRequiresAccess(path: string) { return !availableWithoutNewUse.has(path); }

// Return intent is a navigation allowlist, never a URL or an automatic mutation.
const destinations = new Set(['/capture', '/scan', '/today', '/plan', '/progress']);
let returnPath: string | null = null;
export function rememberAccessDestination(path: string) { if (destinations.has(path)) returnPath ??= path; }
export function takeAccessDestination() { const path = returnPath ?? '/today'; returnPath = null; return path; }
export function clearAccessDestination() { returnPath = null; }
