import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useApp } from '@/context/AppContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { AccessRecord, UNRESOLVED_ACCESS, applyHardWall, clearAccessDestination, hardWallApplies, resolveAccess } from '@/services/accessPolicy';
import { getHardWallSnapshot, markHardWallUsed } from '@/services/hardWall';
import { useHardWall } from '@/hooks/useHardWall';
import { accessPaywallSeen, completeAccessEnrollment, excludeUnassignedAccess, hasAccessEnrollmentPending, invalidateAppAccess, isAppAccessMeasurementVerified, markAccessPaywallSeen, refreshAppAccess, subscribeAppAccess } from '@/services/appAccess';
import { getCurrentSessionUserId, supabase } from '@/services/supabaseClient';
import { setReminderAccessAllowed } from '@/services/reminders';
import { RevenueCatExperimentAnalytics } from '@/components/RevenueCatExperimentAnalytics';
import { invalidateRevenueCatExperimentMeasurement } from '@/services/revenueCatExperimentAnalytics';

type AccessContextValue = {
  /** `record` includes the install's hard wall (applyHardWall). */
  ready: boolean; record: AccessRecord; state: ReturnType<typeof resolveAccess>;
  canUse: boolean; enrollmentPending: boolean; entryPaywall: boolean;
  /** Hard paywall after the first scan applies to this install/account. */
  hardWall: boolean;
  refresh: () => Promise<void>; enroll: (firstUse: boolean) => Promise<void>; markSeen: () => Promise<void>;
};
const AccessContext = createContext<AccessContextValue | null>(null);
export function AccessProvider({ children }: PropsWithChildren) {
  const { hydrationReady, wellnessConsentGranted, profile, mealHistory } = useApp();
  const wall = useHardWall();
  const { status } = useSubscription();
  const [record, setRecord] = useState<AccessRecord>(UNRESOLVED_ACCESS);
  const [ready, setReady] = useState(false);
  const [recordOwner, setRecordOwner] = useState<string | null>(null);
  const [measurementVerified, setMeasurementVerified] = useState(false);
  const [enrollmentPending, setEnrollmentPending] = useState(false);
  const [seen, setSeen] = useState(true);
  const generation = useRef(0); const owner = useRef<string | null>(null);
  const flight = useRef<{ epoch: number; promise: Promise<void> } | null>(null);
  const refresh = useCallback(() => {
    if (!hydrationReady || !wellnessConsentGranted || !profile.completedAt) return Promise.resolve();
    const epoch = generation.current;
    if (flight.current?.epoch === epoch) return flight.current.promise;
    setMeasurementVerified(false);
    const promise = (async () => {
      const requestOwner = await getCurrentSessionUserId();
      let next = await refreshAppAccess();
      const pending = await hasAccessEnrollmentPending();
      if (next.variant === 'unassigned' && (!pending || !next.enrollmentOpen)) {
        next = await excludeUnassignedAccess();
      }
      const wasSeen = await accessPaywallSeen();
      if (epoch !== generation.current || requestOwner !== await getCurrentSessionUserId()) return;
      const needsEnrollment = pending && next.variant === 'unassigned' && next.enrollmentOpen === true;
      setReminderAccessAllowed(!needsEnrollment && ['free', 'active'].includes(resolveAccess(applyHardWall(next, getHardWallSnapshot()))));
      setRecord(next); setRecordOwner(requestOwner); setMeasurementVerified(isAppAccessMeasurementVerified(requestOwner)); setEnrollmentPending(needsEnrollment); setSeen(wasSeen); setReady(true);
    })().catch(() => {
      // Never erase a known B on a configuration or storage failure.
      if (epoch === generation.current) setReady(true);
    }).finally(() => { if (flight.current?.promise === promise) flight.current = null; });
    flight.current = { epoch, promise }; return promise;
  }, [hydrationReady, wellnessConsentGranted, profile.completedAt]);
  useEffect(() => {
    if (!hydrationReady || !wellnessConsentGranted) { setReady(false); setReminderAccessAllowed(false); return; }
    void refresh();
  }, [hydrationReady, wellnessConsentGranted, refresh, status]);
  useEffect(() => {
    const auth = supabase?.auth.onAuthStateChange((_event, session) => {
      const next = session?.user.id ?? null;
      if (next === owner.current) return;
      invalidateRevenueCatExperimentMeasurement();
      owner.current = next; generation.current++; invalidateAppAccess(); clearAccessDestination();
      setReady(false); setRecordOwner(null); setMeasurementVerified(false); setRecord(UNRESOLVED_ACCESS); setSeen(true); setEnrollmentPending(false); setReminderAccessAllowed(false);
      // Keep Supabase callbacks synchronous; no nested auth operations here.
      setTimeout(() => { void refresh(); }, 0);
    }).data.subscription;
    const app = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    const remove = subscribeAppAccess(() => { void refresh(); });
    return () => { auth?.unsubscribe(); app.remove(); remove(); };
  }, [refresh]);
  // Any saved meal ends the free scope of a hard-wall install (sticky).
  const mealSaved = mealHistory.length > 0;
  useEffect(() => { if (mealSaved && !wall.used) void markHardWallUsed(); }, [mealSaved, wall.used]);
  const local = { cohort: wall.cohort, used: wall.used || mealSaved };
  const hardWall = hardWallApplies(record, local);
  const effective = applyHardWall(record, local);
  const state = resolveAccess(effective, status === 'pending');
  const canUse = ready && !enrollmentPending && ['free', 'active'].includes(state);
  // The first saved meal can lock a hard-wall install between refreshes.
  useEffect(() => { if (ready && hardWall) setReminderAccessAllowed(canUse); }, [ready, hardWall, canUse]);
  useEffect(() => {
    if (!record.validUntil) return;
    const delay = Date.parse(record.validUntil) - Date.now();
    if (delay <= 0) return;
    const timer = setTimeout(() => { setRecord(v => ({ ...v, access: 'unknown', validUntil: null })); setReminderAccessAllowed(false); void refresh(); }, Math.min(delay, 2_147_483_647));
    return () => clearTimeout(timer);
  }, [record.validUntil, refresh]);
  const enroll = async (firstUse: boolean) => { await completeAccessEnrollment(firstUse); await refresh(); };
  const markSeen = async () => { await markAccessPaywallSeen(); setSeen(true); };
  return <AccessContext.Provider value={{ record: effective, ready, state, canUse, enrollmentPending, hardWall, entryPaywall: !seen && ['A', 'B'].includes(record.variant) && state !== 'active', refresh, enroll, markSeen }}>
    <RevenueCatExperimentAnalytics owner={recordOwner} ready={ready && hydrationReady && wellnessConsentGranted} serverVerified={measurementVerified} age={profile.completedAt ? profile.age : null} record={record} />
    {children}
  </AccessContext.Provider>;
}
export function useAccess() { const context = useContext(AccessContext); if (!context) throw Error('AccessProvider missing'); return context; }
