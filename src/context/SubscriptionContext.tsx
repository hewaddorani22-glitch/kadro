import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import {
  isSubscriptionPurchaseCancelled,
  isSubscriptionPurchasePending,
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

type SubscriptionStatus = 'loading' | 'unconfigured' | 'ready' | 'active' | 'pending' | 'error';

type SubscriptionContextValue = {
  status: SubscriptionStatus;
  snapshot: SubscriptionSnapshot | null;
  busy: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  purchase: (planId: SubscriptionPlanId) => Promise<'active' | 'cancelled' | 'failed' | 'pending' | 'interrupted'>;
  restore: () => Promise<'active' | 'none' | 'failed' | 'pending' | 'interrupted'>;
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
  const billingGenerationRef = useRef<number | null>(null);

  const refresh = useCallback(() => {
    const generation = refreshGenerationRef.current;
    if (billingGenerationRef.current === generation) return Promise.resolve();
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
        // The server may already confirm a buyer while the device SDK still
        // reports an older Free snapshot. Never make that snapshot authoritative.
        const serverActive = visible.configured && visible.mode === 'native-store'
          ? await refreshServerEntitlement() : false;
        if (!isCurrent()) return;
        if (visible.entitlementActive && !serverActive) {
          setSnapshot({ ...visible, entitlementActive: false });
          setStatus('pending');
          setError(getDictionary().errors.entitlementConfirmationPending);
          return;
        }
        setSnapshot({ ...visible, entitlementActive: serverActive });
        setError(null);
        setStatus(serverActive ? 'active' : visible.configured ? 'ready' : 'unconfigured');
      } catch (failure) {
        if (!isCurrent()) return;
        setSnapshot((current) => current ? { ...current, entitlementActive: false } : current);
        setStatus('error');
        setError(getDictionary().errors.entitlementStatusUnavailable);
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
    billingGenerationRef.current = null;
    setBusy(false);
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
        billingGenerationRef.current = null;
        setBusy(false);
        setSnapshot(null);
        setError(null);
        setStatus('loading');
      }
      void refresh();
    });
    return () => data.subscription.unsubscribe();
  }, [refresh, wellnessConsentGranted]);

  useEffect(() => () => { refreshGenerationRef.current += 1; }, []);

  const purchase = useCallback(async (planId: SubscriptionPlanId) => {
    if (billingGenerationRef.current !== null || !wellnessConsentGranted) return 'interrupted';
    const plan = snapshot?.plans[planId];
    if (!plan) {
      setError(getDictionary().errors.packageUnavailable);
      return 'failed';
    }
    refreshGenerationRef.current += 1;
    const generation = refreshGenerationRef.current;
    const isCurrent = () => generation === refreshGenerationRef.current;
    billingGenerationRef.current = generation;
    refreshInFlightRef.current = null;
    setBusy(true);
    setError(null);
    try {
      const active = await purchaseSubscription(plan);
      if (!isCurrent()) return 'interrupted';
      if (active) {
        const serverActive = await confirmServerEntitlementWithRetry(() => isCurrent() ? refreshServerEntitlement() : Promise.resolve(false));
        if (!isCurrent()) return 'interrupted';
        if (!serverActive) {
          setSnapshot((current) => current ? { ...current, entitlementActive: false } : current);
          setStatus('pending');
          setError(getDictionary().errors.entitlementConfirmationPending);
          return 'pending';
        }
        setSnapshot((current) => current ? { ...current, entitlementActive: true } : current);
        setError(null);
        setStatus('active');
        return 'active';
      }
      setStatus('pending');
      setError(getDictionary().errors.entitlementStatusUnavailable);
      return 'pending';
    } catch (failure) {
      if (!isCurrent()) return 'interrupted';
      if (isSubscriptionPurchaseCancelled(failure)) return 'cancelled';
      if (isSubscriptionPurchasePending(failure)) {
        setStatus('pending');
        setError(getDictionary().errors.purchasePending);
        return 'pending';
      }
      setSnapshot((current) => current ? { ...current, entitlementActive: false } : current);
      setStatus('error');
      setError(subscriptionErrorMessage(failure));
      captureOperationalError(failure, { area: 'subscription', operation: `purchase_${planId}` });
      return 'failed';
    } finally {
      if (isCurrent()) { billingGenerationRef.current = null; setBusy(false); }
    }
  }, [snapshot, wellnessConsentGranted]);

  const restore = useCallback(async () => {
    if (billingGenerationRef.current !== null || !wellnessConsentGranted) return 'interrupted';
    refreshGenerationRef.current += 1;
    const generation = refreshGenerationRef.current;
    const isCurrent = () => generation === refreshGenerationRef.current;
    billingGenerationRef.current = generation;
    refreshInFlightRef.current = null;
    setBusy(true);
    setError(null);
    try {
      const active = await restoreSubscription();
      if (!isCurrent()) return 'interrupted';
      // With no SDK entitlement, a server timeout cannot establish "no purchase".
      const serverActive = active
        ? await confirmServerEntitlementWithRetry(() => isCurrent() ? refreshServerEntitlement() : Promise.resolve(false))
        : await refreshServerEntitlement();
      if (!isCurrent()) return 'interrupted';
      if (!active && !serverActive) {
        setSnapshot((current) => current ? { ...current, entitlementActive: false } : current);
        setStatus('ready');
        return 'none';
      }
      if (!serverActive) {
        setSnapshot((current) => current ? { ...current, entitlementActive: false } : current);
        setStatus('pending');
        setError(getDictionary().errors.entitlementConfirmationPending);
        return 'pending';
      }
      setSnapshot((current) => current ? { ...current, entitlementActive: true } : current);
      setError(null);
      setStatus('active');
      return 'active';
    } catch (failure) {
      if (!isCurrent()) return 'interrupted';
      setSnapshot((current) => current ? { ...current, entitlementActive: false } : current);
      setStatus('error');
      setError(subscriptionErrorMessage(failure));
      captureOperationalError(failure, { area: 'subscription', operation: 'restore' });
      return 'failed';
    } finally {
      if (isCurrent()) { billingGenerationRef.current = null; setBusy(false); }
    }
  }, [wellnessConsentGranted]);

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
