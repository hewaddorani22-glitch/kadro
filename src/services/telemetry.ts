import PostHog from 'posthog-react-native';

import { AnalysisErrorKind } from '@/services/contracts';
import { MealContext } from '@/types/nutrition';

type ScanSource = 'camera' | 'demo' | 'queued_retry';
type CountBucket = '1' | '2-3' | '4+';
type BillingMode = 'preview' | 'test_store' | 'native_store' | 'web';

type AnalyticsEventMap = {
  'onboarding completed': { completion: 'finished' | 'skipped' };
  'meal scan started': { scan_source: ScanSource };
  'meal analysis completed': {
    confidence: 'high' | 'medium';
    detected_item_count: CountBucket;
    scan_source: ScanSource;
    warning_present: boolean;
  };
  'meal analysis failed': {
    failure_reason: AnalysisErrorKind;
    queued_for_retry: boolean;
    scan_source: ScanSource;
  };
  'meal confirmed': {
    confidence: 'high' | 'medium';
    correction_applied: boolean;
    included_item_count: CountBucket;
  };
  'meal saved': { next_destination: 'today' | 'recommendations' };
  'recommendation set viewed': { meal_context: MealContext };
  'recommendation selected': { meal_context: MealContext; rank: 1 | 2 | 3 };
  'paywall viewed': { billing_mode: BillingMode };
  'subscription purchase completed': { billing_mode: BillingMode; plan: 'yearly' | 'monthly' };
  'subscription restore completed': { active: boolean; billing_mode: BillingMode };
};

export type AnalyticsEventName = keyof AnalyticsEventMap;

type ErrorContext = {
  area: 'analysis' | 'cloud_sync' | 'subscription' | 'ui';
  operation: string;
  code?: string;
  fatal?: boolean;
};

const projectToken = process.env.EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim();
const host = process.env.EXPO_PUBLIC_POSTHOG_HOST?.trim() || 'https://eu.i.posthog.com';
const defaultOptIn = process.env.EXPO_PUBLIC_POSTHOG_ENABLED?.trim().toLowerCase() === 'true';
const allowedEvents = new Set<string>([
  ...([
    'onboarding completed',
    'meal scan started',
    'meal analysis completed',
    'meal analysis failed',
    'meal confirmed',
    'meal saved',
    'recommendation set viewed',
    'recommendation selected',
    'paywall viewed',
    'subscription purchase completed',
    'subscription restore completed',
  ] satisfies AnalyticsEventName[]),
  '$exception',
]);
const blockedAutomaticProperties = new Set([
  '$device_manufacturer',
  '$device_model',
  '$device_name',
  '$locale',
  '$screen_height',
  '$screen_width',
  '$timezone',
]);

function sanitizeAutomaticProperties<Event extends { properties?: Record<string, unknown> }>(event: Event) {
  if (!event.properties) return event;
  for (const property of blockedAutomaticProperties) delete event.properties[property];
  return event;
}

const posthog = projectToken
  ? new PostHog(projectToken, {
      host,
      defaultOptIn,
      personProfiles: 'never',
      captureAppLifecycleEvents: false,
      capturePushNotificationOpened: false,
      capturePushNotificationSubscriptions: false,
      disableGeoip: true,
      disableRemoteFeatureFlags: true,
      disableSurveys: true,
      enablePersistSessionIdAcrossRestart: false,
      enableSessionReplay: false,
      errorTracking: {
        autocapture: false,
        exceptionSteps: { enabled: false },
      },
      preloadFeatureFlags: false,
      sendFeatureFlagEvent: false,
      setDefaultPersonProperties: false,
      before_send: (event) => event && allowedEvents.has(event.event) ? sanitizeAutomaticProperties(event) : null,
    })
  : null;

export const isTelemetryConfigured = Boolean(posthog);

export function countBucket(count: number): CountBucket {
  if (count <= 1) return '1';
  if (count <= 3) return '2-3';
  return '4+';
}

export function trackEvent<Name extends AnalyticsEventName>(name: Name, properties: AnalyticsEventMap[Name]) {
  posthog?.capture(name, properties);
}

export function captureOperationalError(error: unknown, context: ErrorContext) {
  if (!posthog) return;
  const original = error instanceof Error ? error : null;
  const safeError = new Error(`${context.area}:${context.operation}:${context.code ?? original?.name ?? 'unknown'}`);
  safeError.name = original?.name || 'KadroOperationalError';
  if (original?.stack) {
    const [, ...frames] = original.stack.split('\n');
    safeError.stack = `${safeError.name}: ${safeError.message}\n${frames.join('\n')}`;
  }
  posthog.captureException(safeError, {
    error_area: context.area,
    error_code: context.code ?? 'unknown',
    fatal: context.fatal ?? false,
    operation: context.operation,
  });
}

export async function getAnalyticsCollectionEnabled() {
  if (!posthog) return false;
  await posthog.ready();
  return !posthog.optedOut;
}

export async function setAnalyticsCollectionEnabled(enabled: boolean) {
  if (!posthog) return false;
  if (enabled) await posthog.optIn();
  else await posthog.optOut();
  return enabled;
}

export function toBillingMode(mode: 'unconfigured' | 'test-store' | 'native-store' | 'web' | undefined): BillingMode {
  if (mode === 'test-store') return 'test_store';
  if (mode === 'native-store') return 'native_store';
  if (mode === 'web') return 'web';
  return 'preview';
}
