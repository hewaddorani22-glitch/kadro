import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

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
import { refreshServerEntitlement } from '@/services/serverEntitlement';
import { confirmServerEntitlementWithRetry } from '@/services/entitlementConfirmation';
import { captureOperationalError } from '@/services/telemetry';
import { getDictionary } from '@/i18n/active';
import { useApp } from '@/context/AppContext';

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
  const { hydrationReady, wellnessConsentGranted } = useApp();
  const [snapshot, setSnapshot] = useState<SubscriptionSnapshot | null>(null);
  const [status, setStatus] = useState<SubscriptionStatus>('loading');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshGenerationRef = useRef(0);
  const refreshInFlightRef = useRef<{ generation: number; promise: Promise<void> } | null>(null);
  const authUserIdRef = useRef<string | null>(null);

  const refresh = useCallback(() => {
    const generation = refreshGenerationRef.current;
    const existing = refreshInFlightRef.current;
    if (existing?.generation === generation) return existing.promise;

    let operation: Promise<void>;
    operation = (async () => {
      const isCurrent = () => refreshGenerationRef.current === generation;
      if (!wellnessConsentGranted) {
        if (!isCurrent()) return;
        setSnapshot(null);
        setError(null);
        setStatus('unconfigured');
        return;
      }
      if (isCurrent()) setError(null);
      try {
        const next = await loadSubscriptionSnapshot();
        // Expo Go uses RevenueCat Test Store. Its CustomerInfo can simulate an
        // entitlement, but it must never be presented as hosted Pro access.
        const visible = next.mode === 'test-store' && next.entitlementActive
          ? { ...next, entitlementActive: false }
          : next;
        const serverActive = !visible.entitlementActive || await refreshServerEntitlement();
        if (!isCurrent()) return;
        if (!serverActive) {
          setSnapshot({ ...visible, entitlementActive: false });
          setStatus('error');
          setError(getDictionary().errors.entitlementConfirmationPending);
          return;
        }
        setSnapshot(visible);
        setError(null);
        setStatus(visible.entitlementActive ? 'active' : visible.configured ? 'ready' : 'unconfigured');
      } catch (failure) {
        if (!isCurrent()) return;
        setStatus('error');
        setError(subscriptionErrorMessage(failure));
        captureOperationalError(failure, { area: 'subscription', operation: 'refresh' });
      }
    })().finally(() => {
      if (refreshInFlightRef.current?.promise === operation) refreshInFlightRef.current = null;
    });
    refreshInFlightRef.current = { generation, promise: operation };
    return operation;
  }, [wellnessConsentGranted]);

  useEffect(() => {
    refreshGenerationRef.current += 1;
    if (!wellnessConsentGranted) {
      setSnapshot(null);
      setError(null);
      setStatus('unconfigured');
    }
  }, [wellnessConsentGranted]);

  useEffect(() => {
    if (hydrationReady) void refresh();
  }, [hydrationReady, refresh]);

  useEffect(() => {
    if (!supabase || !wellnessConsentGranted) return;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const userId = session?.user.id ?? null;
      if (userId !== authUserIdRef.current) {
        authUserIdRef.current = userId;
        refreshGenerationRef.current += 1;
        refreshInFlightRef.current = null;
        setSnapshot(null);
        setError(null);
        setStatus('loading');
      }
      void refresh();
    });
    return () => data.subscription.unsubscribe();
  }, [refresh, wellnessConsentGranted]);

  const purchase = useCallback(async (planId: SubscriptionPlanId) => {
    const plan = snapshot?.plans[planId];
    if (!plan) {
      setError(getDictionary().errors.packageUnavailable);
      return 'failed';
    }
    refreshGenerationRef.current += 1;
    refreshInFlightRef.current = null;
    setBusy(true);
    setError(null);
    try {
      const active = await purchaseSubscription(plan);
      if (active) {
        const serverActive = await confirmServerEntitlementWithRetry(refreshServerEntitlement);
        if (!serverActive) {
          setSnapshot((current) => current ? { ...current, entitlementActive: false } : current);
          setStatus('error');
          setError(getDictionary().errors.entitlementConfirmationPending);
          return 'failed';
        }
        setSnapshot((current) => current ? { ...current, entitlementActive: true } : current);
        setError(null);
        setStatus('active');
        return 'active';
      }
      setError(getDictionary().paywall.entitlementMissing);
      return 'failed';
    } catch (failure) {
      if (isSubscriptionPurchaseCancelled(failure)) return 'cancelled';
      setSnapshot((current) => current ? { ...current, entitlementActive: false } : current);
      setStatus('error');
      setError(subscriptionErrorMessage(failure));
      captureOperationalError(failure, { area: 'subscription', operation: `purchase_${planId}` });
      return 'failed';
    } finally {
      setBusy(false);
    }
  }, [snapshot]);

  const restore = useCallback(async () => {
    refreshGenerationRef.current += 1;
    refreshInFlightRef.current = null;
    setBusy(true);
    setError(null);
    try {
      const active = await restoreSubscription();
      if (!active) {
        setSnapshot((current) => current ? { ...current, entitlementActive: false } : current);
        setStatus('ready');
        return 'none';
      }
      const serverActive = await confirmServerEntitlementWithRetry(refreshServerEntitlement);
      if (!serverActive) {
        setSnapshot((current) => current ? { ...current, entitlementActive: false } : current);
        setStatus('error');
        setError(getDictionary().errors.entitlementConfirmationPending);
        return 'failed';
      }
      setSnapshot((current) => current ? { ...current, entitlementActive: true } : current);
      setError(null);
      setStatus('active');
      return 'active';
    } catch (failure) {
      setSnapshot((current) => current ? { ...current, entitlementActive: false } : current);
      setStatus('error');
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
