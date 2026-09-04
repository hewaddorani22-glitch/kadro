import { getDictionary } from '@/i18n/active';
import {
  functionsBaseUrl,
  getAccessSession,
  supabaseAnonKey,
} from '@/services/supabaseClient';

const REFRESH_TIMEOUT_MS = 8_000;
const REFRESH_RESULT_CACHE_MS = 20_500;
let refreshInFlight: { userId: string; promise: Promise<boolean> } | null = null;
let lastRefreshResult: { userId: string; checkedAt: number; active: boolean } | null = null;

/**
 * Confirms the SDK-reported purchase against Kandro's server authority.
 * The device never decides Pro access and never receives a RevenueCat secret.
 */
export function refreshServerEntitlement(): Promise<boolean> {
  return (async () => {
    const failureMessage = getDictionary().errors.entitlementConfirmationPending;
    if (!functionsBaseUrl || !supabaseAnonKey) throw new Error(failureMessage);

    const access = await getAccessSession().catch(() => null);
    if (!access) throw new Error(failureMessage);
    const now = Date.now();
    if (lastRefreshResult?.userId === access.userId && now - lastRefreshResult.checkedAt < REFRESH_RESULT_CACHE_MS) {
      return lastRefreshResult.active;
    }
    if (refreshInFlight?.userId === access.userId) return refreshInFlight.promise;

    const operation = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REFRESH_TIMEOUT_MS);
      try {
        const response = await fetch(`${functionsBaseUrl}/nutrition/v1/entitlement/refresh`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${access.accessToken}`,
            apikey: supabaseAnonKey,
          },
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => null) as { active?: unknown } | null;
        if (!response.ok || typeof payload?.active !== 'boolean') throw new Error(failureMessage);
        lastRefreshResult = { userId: access.userId, active: payload.active, checkedAt: Date.now() };
        return payload.active;
      } catch {
        throw new Error(failureMessage);
      } finally {
        clearTimeout(timeout);
      }
    })();
    refreshInFlight = { userId: access.userId, promise: operation };
    return operation.finally(() => {
      if (refreshInFlight?.promise === operation) refreshInFlight = null;
    });
  })();
}
