import type { AccessRecord } from '@/services/accessPolicy';

export const REVENUECAT_EXPERIMENT_CONSENT_VERSION = 'rc_experiment_v1';
export type ExperimentInstallOrigin = 'production' | 'test' | 'unknown';
export type ExperimentVariant = 'A' | 'B';
export const REVENUECAT_EXPERIMENT_KEYS = ['kandro_experiment', 'kandro_variant', 'kandro_measurement_consent'] as const;
export type ExperimentAttributes = Record<typeof REVENUECAT_EXPERIMENT_KEYS[number], string>;

/** The functional server assignment is the source of truth, never a new draw. */
export function experimentMeasurementEligible(age: number | null, record: AccessRecord | null) {
  return typeof age === 'number' && Number.isFinite(age) && age >= 18
    && record?.experiment === 'paywall_access_v1' && record.source === 'public'
    && record.environment === 'production' && (record.variant === 'A' || record.variant === 'B');
}

export function experimentAttributes(input: {
  consent: boolean; age: number | null; record: AccessRecord | null;
  origin: ExperimentInstallOrigin; originalVariant: ExperimentVariant | null;
}): ExperimentAttributes | null {
  if (!input.consent || input.origin !== 'production' || !experimentMeasurementEligible(input.age, input.record)) return null;
  const variant = input.record!.variant as ExperimentVariant;
  // An unexpected later server variant must not rewrite the original ITT group.
  if (input.originalVariant && input.originalVariant !== variant) return null;
  return { kandro_experiment: 'paywall_access_v1', kandro_variant: variant,
    kandro_measurement_consent: REVENUECAT_EXPERIMENT_CONSENT_VERSION };
}

export function clearedExperimentAttributes(): ExperimentAttributes {
  return { kandro_experiment: '', kandro_variant: '', kandro_measurement_consent: '' };
}
