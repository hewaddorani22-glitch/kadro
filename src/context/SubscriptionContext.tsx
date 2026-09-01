import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  isSubscriptionPurchaseCancelled,
  loadSubscriptionSnapshot,
  purchaseSubscription,
  restoreSubscription,
  SubscriptionPlanId,
  SubscriptionSnapshot,
  subscriptionErrorMessage,
} from '@/services/subscription';
import { supabase } from '@/services/supabaseClient';
import { captureOperationalError } from '@/services/telemetry';

type SubscriptionStatus = 'loading' | 'unconfigured' | 'ready' | 'active' | 'error';

type SubscriptionContextValue = {
  status: SubscriptionStatus;
  snapshot: SubscriptionSnapshot | null;
  busy: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  purchase: (planId: SubscriptionPlanId) => Promise<'active' | 'cancelled' | 'failed'>;
  restore: () => Promise<'active' | 'none' | 'failed'>;
};

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: PropsWithChildren) {
  const [snapshot, setSnapshot] = useState<SubscriptionSnapshot | null>(null);
  const [status, setStatus] = useState<SubscriptionStatus>('loading');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const next = await loadSubscriptionSnapshot();
      setSnapshot(next);
      setStatus(next.entitlementActive ? 'active' : next.configured ? 'ready' : 'unconfigured');
    } catch (failure) {
      setStatus('error');
      setError(subscriptionErrorMessage(failure));
      captureOperationalError(failure, { area: 'subscription', operation: 'refresh' });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange(() => {
      void refresh();
    });
    return () => data.subscription.unsubscribe();
  }, [refresh]);

  const purchase = useCallback(async (planId: SubscriptionPlanId) => {
    const plan = snapshot?.plans[planId];
    if (!plan) {
      setError('Dieses Paket ist im aktuellen RevenueCat Offering noch nicht verfügbar.');
      return 'failed';
    }
    setBusy(true);
    setError(null);
    try {
      const active = await purchaseSubscription(plan);
      if (active) {
        setSnapshot((current) => current ? { ...current, entitlementActive: true } : current);
        setStatus('active');
        return 'active';
      }
      setError('Der Kauf wurde abgeschlossen, aber „kandro_pro“ ist noch nicht aktiv. Prüfe die Entitlement-Zuordnung.');
      return 'failed';
    } catch (failure) {
      if (isSubscriptionPurchaseCancelled(failure)) return 'cancelled';
      setError(subscriptionErrorMessage(failure));
      captureOperationalError(failure, { area: 'subscription', operation: `purchase_${planId}` });
      return 'failed';
    } finally {
      setBusy(false);
    }
  }, [snapshot]);

  const restore = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const active = await restoreSubscription();
      setSnapshot((current) => current ? { ...current, entitlementActive: active } : current);
      setStatus(active ? 'active' : 'ready');
      return active ? 'active' : 'none';
    } catch (failure) {
      setError(subscriptionErrorMessage(failure));
      captureOperationalError(failure, { area: 'subscription', operation: 'restore' });
      return 'failed';
    } finally {
      setBusy(false);
    }
  }, []);

  const value = useMemo<SubscriptionContextValue>(() => ({
    status,
    snapshot,
    busy,
    error,
    refresh,
    purchase,
    restore,
  }), [busy, error, purchase, refresh, restore, snapshot, status]);

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription() {
  const value = useContext(SubscriptionContext);
  if (!value) throw new Error('useSubscription must be used inside SubscriptionProvider');
  return value;
}
