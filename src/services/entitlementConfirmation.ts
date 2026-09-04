export const ENTITLEMENT_CONFIRMATION_DELAYS_MS = [1_500, 19_500] as const;

type EntitlementProbe = () => Promise<boolean>;
type Wait = (milliseconds: number) => Promise<void>;

const waitFor: Wait = (milliseconds) => new Promise((resolve) => {
  setTimeout(resolve, milliseconds);
});

/**
 * RevenueCat can briefly lag behind StoreKit after a positive purchase or
 * restore. Probe immediately, once for an arriving webhook, and once after
 * the server's 20-second per-user refresh cooldown. A local StoreKit result
 * never grants Pro by itself.
 */
export async function confirmServerEntitlementWithRetry(
  probe: EntitlementProbe,
  wait: Wait = waitFor,
): Promise<boolean> {
  for (let attempt = 0; attempt <= ENTITLEMENT_CONFIRMATION_DELAYS_MS.length; attempt += 1) {
    if (attempt > 0) await wait(ENTITLEMENT_CONFIRMATION_DELAYS_MS[attempt - 1]);
    try {
      if (await probe()) return true;
    } catch {
      // A bounded later probe handles a transient timeout without trusting the
      // device. The caller displays one fixed, actionable failure if all fail.
    }
  }
  return false;
}
