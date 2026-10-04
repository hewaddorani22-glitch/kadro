import * as Sentry from '@sentry/react-native';

/**
 * Crash and error reports only: no session replay, no screenshots, no user
 * identity, no meal or body data. Inactive until a DSN is configured, so
 * development and builds without it behave exactly as before.
 */
const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';
export const crashReportingEnabled = /^https:\/\/[^@\s]+@[^/\s]+\/\d+$/.test(dsn);

const SENSITIVE = /(meal|description|image|photo|weight|age|email|name|token|password)/i;

if (crashReportingEnabled) {
  Sentry.init({
    dsn,
    sendDefaultPii: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
    enableAutoSessionTracking: true,
    tracesSampleRate: 0,
    maxBreadcrumbs: 30,
    beforeBreadcrumb(breadcrumb) {
      // Console, navigation params and network bodies can carry user input.
      if (breadcrumb.category === 'console' || breadcrumb.category === 'xhr' || breadcrumb.category === 'fetch') return null;
      return breadcrumb;
    },
    beforeSend(event) {
      delete event.user;
      if (event.request) delete event.request.data;
      if (event.extra) for (const key of Object.keys(event.extra)) if (SENSITIVE.test(key)) delete event.extra[key];
      return event;
    },
  });
}

export function reportError(error: unknown, context?: string) {
  if (!crashReportingEnabled) return;
  Sentry.captureException(error, context ? { tags: { area: context } } : undefined);
}

export const wrapRoot = <T,>(component: T): T => (crashReportingEnabled ? Sentry.wrap(component as never) as T : component);
