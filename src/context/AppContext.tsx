import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { AnalysisErrorKind, MealAnalysisInput } from '@/services/contracts';
import { analyzeBarcode, analyzeDescription, analyzePreparedPhoto, deleteTemporaryPhoto, FoodSearchResult, MealAnalysisError, mealFromSearch, prepareMealPhoto } from '@/services/mealAnalysis';
import {
  beginLocalAccountSwitch,
  clearLocalKandroData,
  completeLocalAccountSwitch,
  loadAllStoredScans,
  loadAnalysisQueue,
  loadLifetimeScanCount,
  loadMeals,
  loadProfile,
  loadWeightEntries,
  queueAnalysis,
  removeQueuedAnalysis,
  saveLifetimeScanCount,
  saveProfile,
  saveWeightEntry,
  clearAnalysisQueue,
  countLifetimeScanOnce,
  loadLocalAccountSwitch,
  replaceLocalAccountData,
} from '@/services/localRepository';
import {
  createPlannedMeal,
  createScannedMeal,
  DEFAULT_TARGETS,
  DETECTED_ITEMS,
  getRemaining,
  nutritionFromItems,
  sumMeals,
} from '@/services/mockNutrition';
import { FREE_SCAN_ALLOWANCE } from '@/constants/product';
import { calculateDailyTargets, DEFAULT_PROFILE } from '@/services/personalization';
import { availableRepeats, RepeatCandidate } from '@/services/repeatMeals';
import { deleteSyncedMeal, hydrateCloudState, hydrateExistingCloudAccount, saveSyncedMeal, syncUserSetup, SyncMode } from '@/services/syncRepository';
import { getCurrentSessionUserId, isSupabaseConfigured, startSupabaseAuthLifecycle } from '@/services/supabaseClient';
import { applyAnalyticsAgePolicy, captureOperationalError, clearTelemetryForAccountSwitch, countBucket, trackEvent } from '@/services/telemetry';
import { DailyTargets, Meal, MealItem, MealSuggestion, Nutrition, PortionFactor, UserProfile, WeightEntry } from '@/types/nutrition';
import { localDateKey } from '@/utils/date';
import { getDictionary } from '@/i18n/active';
import type { UnitSystem } from '@/utils/units';
import { clearLocalWellnessConsent, forgetLocalWellnessConsent, hasCurrentWellnessConsent, recordWellnessConsent, withdrawWellnessConsent as withdrawStoredWellnessConsent } from '@/services/consent';
import { clearRemindersForAccountSwitch, setEveningReminderEnabled } from '@/services/reminders';
import { formatClockTime } from '@/utils/format';
import { newAnalysisRequestId } from '@/utils/requestId';
import { AccountLinkState, signInToExistingAccount } from '@/services/accountLinking';

export type AnalysisStatus = 'idle' | 'analyzing' | 'ready' | 'queued' | 'error';
type ScanMode = 'live' | 'demo' | 'queued' | 'description' | 'barcode' | 'search';

/**
 * Inputs that never reach the model, and therefore never spend one of the
 * three free meals. Search is the reason this exists: it is a database lookup
 * the sheet openly labels as free.
 */
const FREE_ANALYSIS_MODES = new Set<ScanMode>(['demo', 'search', 'barcode']);

function telemetryScanSource(mode: ScanMode) {
  if (mode === 'live') return 'camera' as const;
  if (mode === 'queued') return 'queued_retry' as const;
  if (mode === 'description') return 'description' as const;
  if (mode === 'barcode') return 'barcode' as const;
  if (mode === 'search') return 'search' as const;
  return 'demo' as const;
}

type AppContextValue = {
  userName: string;
  profile: UserProfile;
  hydrationReady: boolean;
  wellnessConsentGranted: boolean;
  targets: DailyTargets;
  meals: Meal[];
  mealHistory: Meal[];
  weightEntries: WeightEntry[];
  consumed: Nutrition;
  remaining: Nutrition;
  detectedItems: MealItem[];
  scannedMeal: Meal;
  photoUri: string | null;
  scanMode: ScanMode;
  hasLoggedScan: boolean;
  hasEverLoggedScan: boolean;
  lifetimeScanCount: number;
  freeScansLeft: number;
  isCurrentScanLogged: boolean;
  mealPortion: PortionFactor | null;
  analysisStatus: AnalysisStatus;
  analysisError: AnalysisErrorKind | null;
  analysisMessage: string | null;
  pendingAnalysisCount: number;
  syncMode: SyncMode;
  refreshCloudState: () => Promise<void>;
  loadExistingAccount: (email: string, password: string) => Promise<AccountLinkState>;
  retryAccountRecovery: () => Promise<void>;
  grantWellnessConsent: (age?: number) => Promise<void>;
  withdrawWellnessConsent: () => Promise<void>;
  completeOnboarding: (profile: UserProfile) => Promise<void>;
  setUnitSystem: (unitSystem: UnitSystem) => Promise<void>;
  addWeightEntry: (weightKg: number) => Promise<void>;
  setCapturedPhoto: (uri: string) => void;
  startDemoScan: () => void;
  startDescriptionScan: (description: string) => void;
  startBarcodeScan: (barcode: string) => void;
  applySearchResult: (result: FoodSearchResult, grams: number) => void;
  analyzeCurrentPhoto: (forceDemo?: boolean) => Promise<void>;
  resumeLatestAnalysis: () => Promise<boolean>;
  adjustItem: (id: string, direction: -1 | 1) => void;
  setItemAmount: (id: string, grams: number) => void;
  setMealPortion: (factor: PortionFactor) => void;
  toggleItem: (id: string) => void;
  resetScan: () => void;
  resetAfterAccountDeletion: () => void;
  logScannedMeal: () => Promise<void>;
  logPlannedMeal: (suggestion: MealSuggestion, portion: PortionFactor) => Promise<Meal>;
  repeatMeals: RepeatCandidate[];
  logRepeatMeal: (candidate: RepeatCandidate) => Promise<Meal>;
  deleteLoggedMeal: (id: string) => Promise<void>;
  adjustLoggedMealPortion: (id: string, factor: PortionFactor) => Promise<void>;
  setLoggedMealType: (id: string, type: Meal['type']) => Promise<void>;
  /** Slot chosen before scanning, so a late breakfast is not filed as lunch. */
  plannedMealType: Meal['type'] | null;
  setPlannedMealType: (type: Meal['type'] | null) => void;
};

const AppContext = createContext<AppContextValue | null>(null);

function countScans(meals: Meal[]) {
  return meals.filter((meal) => meal.origin === 'scan').length;
}

function makeScanId() {
  return newAnalysisRequestId();
}

function scaleItem(item: MealItem, nextAmount: number): MealItem {
  // A provider that reports a zero amount would otherwise turn every macro into
  // Infinity or NaN on the first correction tap.
  const ratio = item.amountG > 0 ? nextAmount / item.amountG : 0;
  return {
    ...item,
    amountG: nextAmount,
    portionFactor: nextAmount / item.baseAmountG,
    calories: Math.round(item.calories * ratio),
    protein: Math.round(item.protein * ratio),
    carbs: Math.round(item.carbs * ratio),
    fat: Math.round(item.fat * ratio),
    fiber: Math.round((item.fiber ?? 0) * ratio),
  };
}

export function AppProvider({ children }: PropsWithChildren) {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [hydrationReady, setHydrationReady] = useState(false);
  const [wellnessConsentGranted, setWellnessConsentGranted] = useState(false);
  const [targets, setTargets] = useState(DEFAULT_TARGETS);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [mealHistory, setMealHistory] = useState<Meal[]>([]);
  const [lifetimeScanCount, setLifetimeScanCount] = useState(0);
  const [weightEntries, setWeightEntries] = useState<WeightEntry[]>([]);
  const [detectedItems, setDetectedItems] = useState<MealItem[]>(DETECTED_ITEMS);
  const [mealTitle, setMealTitle] = useState(getDictionary().errors.demoMealTitle);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [scanId, setScanId] = useState(makeScanId);
  const [scanMode, setScanMode] = useState<ScanMode>('demo');
  const photoUriRef = useRef<string | null>(null);
  const scanModeRef = useRef<ScanMode>('demo');
  const [plannedMealType, setPlannedMealTypeState] = useState<Meal['type'] | null>(null);
  const plannedMealTypeRef = useRef<Meal['type'] | null>(null);
  const [queuedInput, setQueuedInput] = useState<MealAnalysisInput | null>(null);
  const [descriptionInput, setDescriptionInput] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [mealPortion, setMealPortionState] = useState<PortionFactor | null>(1);
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>('idle');
  const [analysisError, setAnalysisError] = useState<AnalysisErrorKind | null>(null);
  const [analysisMessage, setAnalysisMessage] = useState<string | null>(null);
  const [pendingAnalysisCount, setPendingAnalysisCount] = useState(0);
  const [syncMode, setSyncMode] = useState<SyncMode>(isSupabaseConfigured ? 'syncing' : 'local');
  const loadedDayRef = useRef(localDateKey());
  // Each new input invalidates every older async analysis. The provider call
  // may still finish (and its successful quota spend still has to be counted),
  // but a late response must never replace a newer meal on screen.
  const analysisGenerationRef = useRef(0);
  // Separate from screen-generation: a successful request may spend a credit
  // after the user starts another scan, but never after the Supabase identity
  // changes underneath it.
  const analysisIdentityGenerationRef = useRef(0);
  const inFlightAnalysisIdsRef = useRef<Set<string>>(new Set());

  /** Raises the persisted lifetime counter to whatever we just observed. */
  const adoptScanCount = useCallback(async (observedScans: number) => {
    const stored = await loadLifetimeScanCount();
    const next = Math.max(stored, observedScans);
    setLifetimeScanCount(next > stored ? await saveLifetimeScanCount(next) : stored);
  }, []);

  /** Adopt age privacy policy before exposing or persisting a hydrated profile. */
  const adoptProfile = useCallback(async (nextProfile: UserProfile) => {
    await applyAnalyticsAgePolicy(nextProfile.completedAt ? nextProfile.age : null);
    await saveProfile(nextProfile);
    setProfile(nextProfile);
  }, []);

  const adoptExistingAccountState = useCallback(async (cloudState: NonNullable<Awaited<ReturnType<typeof hydrateExistingCloudAccount>>>) => {
    const observedScans = Math.max(countScans(cloudState.mealHistory), cloudState.hasEverLoggedScan ? 1 : 0);
    const storedCount = await replaceLocalAccountData(cloudState.profile, cloudState.mealHistory, observedScans);
    await Promise.all([
      clearLocalWellnessConsent(),
      clearRemindersForAccountSwitch(),
    ]);
    setMeals(cloudState.meals);
    setMealHistory(cloudState.mealHistory);
    setLifetimeScanCount(storedCount);
    setWeightEntries([]);
    setTargets(cloudState.targets);
    await adoptProfile(cloudState.profile);
    setPendingAnalysisCount(0);
    setWellnessConsentGranted(false);
    setSyncMode('local');
    await completeLocalAccountSwitch();
  }, [adoptProfile]);

  const restoreLocalStateAfterFailedLogin = useCallback(async () => {
    const [storedMeals, storedHistory, queue, storedProfile, storedWeights, storedScanCount, hasConsent] = await Promise.all([
      loadMeals(),
      loadAllStoredScans(),
      loadAnalysisQueue(),
      loadProfile(),
      loadWeightEntries(),
      loadLifetimeScanCount(),
      hasCurrentWellnessConsent(),
    ]);
    setMeals(storedMeals);
    setMealHistory(storedHistory);
    setLifetimeScanCount(Math.max(storedScanCount, countScans(storedHistory)));
    setPendingAnalysisCount(queue.length);
    setProfile(storedProfile);
    setWeightEntries(storedWeights);
    setTargets(storedProfile.completedAt ? calculateDailyTargets(storedProfile) : DEFAULT_TARGETS);
    await applyAnalyticsAgePolicy(storedProfile.completedAt ? storedProfile.age : null);
    setWellnessConsentGranted(hasConsent);
    setSyncMode('local');
  }, []);

  const retryAccountRecovery = useCallback(async () => {
    analysisGenerationRef.current += 1;
    analysisIdentityGenerationRef.current += 1;
    setHydrationReady(false);
    setWellnessConsentGranted(false);
    setSyncMode('syncing');
    let destinationConfirmed = false;
    try {
      const [pendingSwitch, currentUserId] = await Promise.all([
        loadLocalAccountSwitch(),
        getCurrentSessionUserId(),
      ]);
      if (!pendingSwitch) {
        throw new Error(getDictionary().errors.permanentAccountNotLoaded);
      }
      if (!currentUserId || currentUserId === pendingSwitch.previousUserId) {
        // The first cold-start session read may have failed even though auth
        // never changed. A successful retry can now prove that this was only a
        // pre-login interruption, so restore A's local state and retire the
        // crash marker instead of trapping the user in the recovery gate.
        await restoreLocalStateAfterFailedLogin();
        await completeLocalAccountSwitch();
        setHydrationReady(true);
        return;
      }
      destinationConfirmed = true;
      await clearTelemetryForAccountSwitch();
      await Promise.all([clearLocalWellnessConsent(), clearRemindersForAccountSwitch()]);
      const cloudState = await hydrateExistingCloudAccount();
      if (!cloudState) throw new Error(getDictionary().errors.permanentAccountNotLoaded);
      await adoptExistingAccountState(cloudState);
      setHydrationReady(true);
    } catch (error) {
      // Keep the durable switch marker. A transient fetch failure after auth
      // must never open onboarding under the new identity, where defaults from
      // this device could overwrite the account being restored.
      if (destinationConfirmed) {
        await Promise.all([
          clearLocalKandroData(),
          clearLocalWellnessConsent(),
          clearRemindersForAccountSwitch(),
          clearTelemetryForAccountSwitch(),
        ]).catch(() => undefined);
      }
      setProfile(DEFAULT_PROFILE);
      setTargets(DEFAULT_TARGETS);
      setMeals([]);
      setMealHistory([]);
      setLifetimeScanCount(0);
      setWeightEntries([]);
      setPendingAnalysisCount(0);
      setWellnessConsentGranted(false);
      setSyncMode('error');
      setHydrationReady(false);
      throw error;
    }
  }, [adoptExistingAccountState, restoreLocalStateAfterFailedLogin]);

  const loadExistingAccount = useCallback(async (email: string, password: string) => {
    const previousUserId = await getCurrentSessionUserId();
    if (!previousUserId) throw new Error(getDictionary().errors.sessionNotLoaded);
    analysisGenerationRef.current += 1;
    analysisIdentityGenerationRef.current += 1;
    setHydrationReady(false);
    setWellnessConsentGranted(false);
    setSyncMode('syncing');
    // A durable marker precedes the auth mutation. Launch recovery then knows
    // that the local data belongs to the previous identity even after a crash.
    let identityChanged = false;
    try {
      await beginLocalAccountSwitch(previousUserId);
      await clearTelemetryForAccountSwitch();
      const account = await signInToExistingAccount(email, password);
      identityChanged = true;
      // Stop exposing the old identity synchronously before the first cloud
      // read under the new Supabase session.
      deleteTemporaryPhoto(photoUriRef.current);
      photoUriRef.current = null;
      scanModeRef.current = 'demo';
      setProfile(DEFAULT_PROFILE);
      setTargets(DEFAULT_TARGETS);
      setMeals([]);
      setMealHistory([]);
      setLifetimeScanCount(0);
      setWeightEntries([]);
      setPhotoUri(null);
      setQueuedInput(null);
      setPendingAnalysisCount(0);

      await retryAccountRecovery();
      setDetectedItems(DETECTED_ITEMS);
      setMealTitle(getDictionary().errors.demoMealTitle);
      setScanId(makeScanId());
      setScanMode('demo');
      setDescriptionInput('');
      setBarcodeInput('');
      setMealPortionState(1);
      setAnalysisStatus('idle');
      setAnalysisError(null);
      setAnalysisMessage(null);
      setHydrationReady(true);
      return account;
    } catch (error) {
      if (identityChanged) {
        // retryAccountRecovery already cleared the old local state and kept
        // the crash marker. Leave hydration closed until retry succeeds.
        setHydrationReady(false);
      } else {
        await completeLocalAccountSwitch().catch(() => undefined);
        await restoreLocalStateAfterFailedLogin();
        setHydrationReady(true);
      }
      throw error;
    }
  }, [restoreLocalStateAfterFailedLogin, retryAccountRecovery]);

  const refreshCloudState = useCallback(async () => {
    if (!wellnessConsentGranted) {
      setSyncMode('local');
      return;
    }
    if (!isSupabaseConfigured) {
      setSyncMode('local');
      return;
    }
    setSyncMode('syncing');
    try {
      const cloudState = await hydrateCloudState();
      if (!cloudState) {
        setSyncMode('local');
        return;
      }
      setMeals(cloudState.meals);
      setMealHistory(cloudState.mealHistory);
      await adoptScanCount(Math.max(countScans(cloudState.mealHistory), cloudState.hasEverLoggedScan ? 1 : 0));
      setTargets(cloudState.targets);
      await adoptProfile(cloudState.profile);
      setSyncMode('cloud');
    } catch (error) {
      setSyncMode('error');
      captureOperationalError(error, { area: 'cloud_sync', operation: 'refresh_cloud_state' });
      throw error;
    }
  }, [adoptProfile, adoptScanCount, wellnessConsentGranted]);

  useEffect(() => {
    let active = true;
    let stopAuthLifecycle: () => void = () => undefined;
    void (async () => {
      const [storedMeals, storedHistory, queue, storedProfile, storedWeights, storedScanCount, hasConsent, pendingAccountSwitch] = await Promise.all([
        loadMeals(),
        loadAllStoredScans(),
        loadAnalysisQueue(),
        loadProfile(),
        loadWeightEntries(),
        loadLifetimeScanCount(),
        hasCurrentWellnessConsent(),
        loadLocalAccountSwitch(),
      ]);
      if (!active) return;
      if (pendingAccountSwitch) {
        let currentUserId: string | null;
        try {
          currentUserId = await getCurrentSessionUserId();
        } catch (error) {
          // An unreadable session is not evidence that auth never changed.
          // Preserve the marker and block every account-scoped mutation until
          // the user retries from the recovery gate.
          setSyncMode('error');
          setHydrationReady(false);
          captureOperationalError(error, { area: 'cloud_sync', operation: 'read_account_switch_session' });
          return;
        }
        // Auth never changed (or no destination session survived), so this was
        // a pre-login interruption. Keep the old local data instead of treating
        // its anonymous account as the destination.
        if (!currentUserId || currentUserId === pendingAccountSwitch.previousUserId) {
          await completeLocalAccountSwitch();
        } else {
        stopAuthLifecycle = startSupabaseAuthLifecycle();
        try {
          await retryAccountRecovery();
        } catch (error) {
          captureOperationalError(error, { area: 'cloud_sync', operation: 'recover_account_switch' });
        }
        return;
        }
      }
      setMeals(storedMeals);
      setMealHistory(storedHistory);
      setLifetimeScanCount(Math.max(storedScanCount, countScans(storedHistory)));
      if (countScans(storedHistory) > storedScanCount) await saveLifetimeScanCount(countScans(storedHistory));
      setPendingAnalysisCount(queue.length);
      setProfile(storedProfile);
      setWeightEntries(storedWeights);
      setWellnessConsentGranted(hasConsent);
      if (storedProfile.completedAt) setTargets(calculateDailyTargets(storedProfile));

      if (!isSupabaseConfigured || !hasConsent) {
        await applyAnalyticsAgePolicy(storedProfile.completedAt ? storedProfile.age : null);
        if (!active) return;
        setSyncMode('local');
        setHydrationReady(true);
        return;
      }
      stopAuthLifecycle = startSupabaseAuthLifecycle();
      try {
        const cloudState = await hydrateCloudState();
        if (!active) return;
        if (!cloudState) {
          setSyncMode('local');
          return;
        }
        setMeals(cloudState.meals);
        setMealHistory(cloudState.mealHistory);
        await adoptScanCount(Math.max(countScans(cloudState.mealHistory), cloudState.hasEverLoggedScan ? 1 : 0));
        setTargets(cloudState.targets);
        await adoptProfile(cloudState.profile);
        setSyncMode('cloud');
      } catch (error) {
        captureOperationalError(error, { area: 'cloud_sync', operation: 'initial_hydration' });
        if (active) setSyncMode('error');
      } finally {
        if (active) setHydrationReady(true);
      }
    })();

    return () => {
      active = false;
      stopAuthLifecycle();
    };
  }, [adoptProfile, adoptScanCount, retryAccountRecovery]);

  const grantWellnessConsent = useCallback(async (consentingAge = profile.age) => {
    await recordWellnessConsent(consentingAge);
    setWellnessConsentGranted(true);
    // Returning users may have kept cloud history while consent was paused.
    // New onboarding users do not hydrate the consent-only placeholder row.
    if (profile.completedAt && isSupabaseConfigured) {
      try {
        const cloudState = await hydrateCloudState();
        if (cloudState) {
          setMeals(cloudState.meals);
          setMealHistory(cloudState.mealHistory);
          await adoptScanCount(Math.max(countScans(cloudState.mealHistory), cloudState.hasEverLoggedScan ? 1 : 0));
          setTargets(cloudState.targets);
          await adoptProfile(cloudState.profile);
          setSyncMode('cloud');
        }
      } catch (error) {
        // Consent is already valid on both sides. Keep the user in local mode
        // and let the normal refresh path recover cloud history later.
        setSyncMode('local');
        captureOperationalError(error, { area: 'cloud_sync', operation: 'hydrate_after_consent' });
      }
    }
  }, [adoptProfile, adoptScanCount, profile.age, profile.completedAt]);

  const withdrawWellnessConsent = useCallback(async () => {
    analysisGenerationRef.current += 1;
    await withdrawStoredWellnessConsent();
    deleteTemporaryPhoto(photoUriRef.current);
    await clearAnalysisQueue();
    await setEveningReminderEnabled(false).catch(() => false);
    photoUriRef.current = null;
    scanModeRef.current = 'demo';
    setPhotoUri(null);
    setScanMode('demo');
    setQueuedInput(null);
    setAnalysisStatus('idle');
    setAnalysisError(null);
    setAnalysisMessage(null);
    setPendingAnalysisCount(0);
    setSyncMode('local');
    setWellnessConsentGranted(false);
  }, []);

  useEffect(() => {
    // "Heute" is a filtered snapshot taken at load time. Without this the list
    // still showed yesterday's meals after the app sat backgrounded overnight.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      const today = localDateKey();
      if (today === loadedDayRef.current) return;
      loadedDayRef.current = today;
      void loadMeals()
        .then(setMeals)
        .catch((error) => captureOperationalError(error, { area: 'ui', operation: 'day_rollover' }));
    });
    return () => subscription.remove();
  }, []);

  const consumed = useMemo(() => sumMeals(meals), [meals]);
  const remaining = useMemo(() => getRemaining(targets, consumed), [consumed, targets]);
  const scannedMeal = useMemo(
    () => createScannedMeal(detectedItems, mealTitle, scanId),
    [detectedItems, mealTitle, scanId],
  );
  const hasLoggedScan = meals.some((meal) => meal.origin === 'scan' || meal.origin === 'plan');
  const hasEverLoggedScan = lifetimeScanCount > 0 || mealHistory.some((meal) => meal.origin === 'scan');
  const freeScansLeft = Math.max(0, FREE_SCAN_ALLOWANCE - lifetimeScanCount);
  const isCurrentScanLogged = mealHistory.some((meal) => meal.id === scanId);
  const userName = profile.displayName;

  const completeOnboarding = useCallback(async (nextProfile: UserProfile) => {
    const completedProfile = { ...nextProfile, completedAt: nextProfile.completedAt ?? new Date().toISOString() };
    const nextTargets = calculateDailyTargets(completedProfile);
    const weights = await saveWeightEntry({ date: localDateKey(), weightKg: completedProfile.weightKg });
    await adoptProfile(completedProfile);
    setTargets(nextTargets);
    setWeightEntries(weights);
    setHydrationReady(true);

    if (isSupabaseConfigured) {
      setSyncMode('syncing');
      void syncUserSetup(completedProfile, nextTargets)
        .then(() => setSyncMode('cloud'))
        .catch((error) => {
          setSyncMode('error');
          captureOperationalError(error, { area: 'cloud_sync', operation: 'save_personalization' });
        });
    }
  }, [adoptProfile]);

  /**
   * Units are presentation only, so this writes the profile and syncs it
   * without recalculating anything: the stored centimetres and kilograms, and
   * therefore the targets, stay exactly as they were.
   */
  const setUnitSystem = useCallback(async (unitSystem: UnitSystem) => {
    let nextProfile: UserProfile | null = null;
    setProfile((current) => {
      if (current.unitSystem === unitSystem) return current;
      nextProfile = { ...current, unitSystem };
      return nextProfile;
    });
    if (!nextProfile) return;
    await saveProfile(nextProfile);
    if (isSupabaseConfigured) {
      void syncUserSetup(nextProfile, calculateDailyTargets(nextProfile))
        .catch((error) => captureOperationalError(error, { area: 'cloud_sync', operation: 'save_units' }));
    }
  }, []);

  const addWeightEntry = useCallback(async (weightKg: number) => {
    const roundedWeight = Math.round(Math.min(350, Math.max(35, weightKg)) * 10) / 10;
    const nextProfile = { ...profile, weightKg: roundedWeight };
    const nextTargets = calculateDailyTargets(nextProfile);
    const weights = await saveWeightEntry({ date: localDateKey(), weightKg: roundedWeight });
    await saveProfile(nextProfile);
    setProfile(nextProfile);
    setTargets(nextTargets);
    setWeightEntries(weights);
    if (isSupabaseConfigured) {
      void syncUserSetup(nextProfile, nextTargets).catch((error) => {
        setSyncMode('error');
        captureOperationalError(error, { area: 'cloud_sync', operation: 'save_weight' });
      });
    }
  }, [profile]);

  const setCapturedPhoto = useCallback((uri: string) => {
    analysisGenerationRef.current += 1;
    photoUriRef.current = uri;
    scanModeRef.current = 'live';
    setPhotoUri(uri);
    setScanMode('live');
    setScanId(makeScanId());
    setQueuedInput(null);
    setDescriptionInput('');
    setBarcodeInput('');
    setAnalysisStatus('idle');
    trackEvent('meal scan started', { scan_source: 'camera' });
  }, []);

  const startDemoScan = useCallback(() => {
    analysisGenerationRef.current += 1;
    deleteTemporaryPhoto(photoUri);
    photoUriRef.current = null;
    scanModeRef.current = 'demo';
    setPhotoUri(null);
    setScanMode('demo');
    setScanId(makeScanId());
    setQueuedInput(null);
    setDescriptionInput('');
    setBarcodeInput('');
    setDetectedItems(DETECTED_ITEMS);
    setMealTitle(getDictionary().errors.demoMealTitle);
    setAnalysisStatus('idle');
    setAnalysisError(null);
    setAnalysisMessage(null);
    trackEvent('meal scan started', { scan_source: 'demo' });
  }, [photoUri]);

  const startDescriptionScan = useCallback((description: string) => {
    analysisGenerationRef.current += 1;
    deleteTemporaryPhoto(photoUriRef.current);
    photoUriRef.current = null;
    scanModeRef.current = 'description';
    setPhotoUri(null);
    setScanMode('description');
    setScanId(makeScanId());
    setQueuedInput(null);
    setDescriptionInput(description.trim());
    setBarcodeInput('');
    setAnalysisStatus('idle');
    setAnalysisError(null);
    setAnalysisMessage(null);
    trackEvent('meal scan started', { scan_source: 'description' });
  }, []);

  /**
   * A food picked from search is already resolved: there is nothing to analyse,
   * so this skips the gateway, the spinner and the quota entirely and puts the
   * result straight on the confirm screen.
   */
  const applySearchResult = useCallback((result: FoodSearchResult, grams: number) => {
    analysisGenerationRef.current += 1;
    deleteTemporaryPhoto(photoUriRef.current);
    photoUriRef.current = null;
    scanModeRef.current = 'search';
    setPhotoUri(null);
    setScanMode('search');
    setScanId(makeScanId());
    setQueuedInput(null);
    setDescriptionInput('');
    setBarcodeInput('');
    const meal = mealFromSearch(result, grams);
    setDetectedItems(meal.items);
    setMealTitle(meal.title);
    setMealPortionState(1);
    setAnalysisMessage(null);
    setAnalysisError(null);
    setAnalysisStatus('ready');
    trackEvent('meal scan started', { scan_source: 'search' });
  }, []);

  const startBarcodeScan = useCallback((barcode: string) => {
    analysisGenerationRef.current += 1;
    deleteTemporaryPhoto(photoUriRef.current);
    photoUriRef.current = null;
    scanModeRef.current = 'barcode';
    setPhotoUri(null);
    setScanMode('barcode');
    setScanId(makeScanId());
    setQueuedInput(null);
    setDescriptionInput('');
    setBarcodeInput(barcode);
    setAnalysisStatus('idle');
    setAnalysisError(null);
    setAnalysisMessage(null);
    trackEvent('meal scan started', { scan_source: 'barcode' });
  }, []);

  const analyzeCurrentPhoto = useCallback(async (forceDemo = false) => {
    const invocationScanId = scanId;
    const invocationIdentityGeneration = analysisIdentityGenerationRef.current;
    // A double tap must join the existing attempt rather than send a second
    // request with the same idempotency key and let a fast 409 beat the real
    // result back to the UI.
    if (inFlightAnalysisIdsRef.current.has(invocationScanId)) return;
    inFlightAnalysisIdsRef.current.add(invocationScanId);
    const invocationGeneration = ++analysisGenerationRef.current;
    const isCurrentInvocation = () => analysisGenerationRef.current === invocationGeneration;
    const activeScanMode = scanModeRef.current;
    try {
      setAnalysisStatus('analyzing');
      setAnalysisError(null);
      setAnalysisMessage(null);

      if (forceDemo || activeScanMode === 'demo') {
        await new Promise((resolve) => setTimeout(resolve, 1900));
        if (!isCurrentInvocation()) return;
        setDetectedItems(DETECTED_ITEMS);
        setMealTitle(getDictionary().errors.demoMealTitle);
        setAnalysisStatus('ready');
        trackEvent('meal analysis completed', {
          confidence: DETECTED_ITEMS.some((item) => item.included && item.confidence === 'medium') ? 'medium' : 'high',
          detected_item_count: countBucket(DETECTED_ITEMS.length),
          scan_source: 'demo',
          warning_present: false,
        });
        return;
      }

      let input = queuedInput;
      try {
        if ((activeScanMode === 'live' || activeScanMode === 'queued') && !input) {
          const originalUri = photoUriRef.current ?? photoUri;
          if (!originalUri) throw new MealAnalysisError('unclear-image', getDictionary().errors.retakeWholePlate);
          const prepared = await prepareMealPhoto(originalUri);
          if (!isCurrentInvocation()) {
            if (prepared.previewUri !== originalUri) deleteTemporaryPhoto(prepared.previewUri);
            return;
          }
          input = prepared;
          photoUriRef.current = prepared.previewUri;
          setPhotoUri(prepared.previewUri);
          if (prepared.previewUri !== originalUri) deleteTemporaryPhoto(originalUri);
        }

        const result = activeScanMode === 'description'
          ? await analyzeDescription(descriptionInput, invocationScanId)
          : activeScanMode === 'barcode'
            ? await analyzeBarcode(barcodeInput)
            : await analyzePreparedPhoto(input!, invocationScanId);
        // The provider success spends the free analysis, not the later decision
        // to save the meal. This bookkeeping remains valid even if the user has
        // already started another scan, but the stale result never reaches UI.
        const nextLifetimeCount = !FREE_ANALYSIS_MODES.has(activeScanMode)
          && analysisIdentityGenerationRef.current === invocationIdentityGeneration
          ? await countLifetimeScanOnce(invocationScanId)
          : null;
        const nextPendingCount = activeScanMode === 'queued'
          ? await removeQueuedAnalysis(invocationScanId)
          : null;
        if (!isCurrentInvocation()) return;
        if (nextLifetimeCount !== null) setLifetimeScanCount(nextLifetimeCount);
        if (nextPendingCount !== null) setPendingAnalysisCount(nextPendingCount);
        setDetectedItems(result.items);
        setMealTitle(result.title);
        setMealPortionState(1);
        setAnalysisMessage(result.warnings[0] ?? null);
        setAnalysisStatus('ready');
        trackEvent('meal analysis completed', {
          confidence: result.items.some((item) => item.included && item.confidence === 'medium') ? 'medium' : 'high',
          detected_item_count: countBucket(result.items.length),
          scan_source: telemetryScanSource(activeScanMode),
          warning_present: result.warnings.length > 0,
        });
      } catch (error) {
        if (!isCurrentInvocation()) return;
        // The gateway is the authority here. If it says there is no consent,
        // the local record is stale: keeping it would leave the user looking at
        // "Consent is active" with only a "Withdraw" button and no way back.
        if (error instanceof MealAnalysisError && error.kind === 'consent-required') {
          await forgetLocalWellnessConsent();
          if (!isCurrentInvocation()) return;
          setWellnessConsentGranted(false);
        }
        const failure = error instanceof MealAnalysisError
          ? error
          : new MealAnalysisError('provider-error', getDictionary().errors.analysisFailed);
        if (failure.kind === 'request-expired' && activeScanMode === 'queued') {
          const count = await removeQueuedAnalysis(invocationScanId);
          if (!isCurrentInvocation()) return;
          setPendingAnalysisCount(count);
        }
        const shouldQueue = activeScanMode === 'live' || activeScanMode === 'queued'
          ? input && (failure.kind === 'offline' || failure.kind === 'provider-error')
          : false;
        if (shouldQueue && input) {
          const count = await queueAnalysis({ ...input, id: invocationScanId, createdAt: new Date().toISOString() });
          if (!isCurrentInvocation()) {
            await removeQueuedAnalysis(invocationScanId);
            return;
          }
          setPendingAnalysisCount(count);
          setAnalysisStatus('queued');
        } else {
          if (!isCurrentInvocation()) return;
          setAnalysisStatus('error');
        }
        setAnalysisError(failure.kind);
        setAnalysisMessage(failure.message);
        trackEvent('meal analysis failed', {
          failure_reason: failure.kind,
          queued_for_retry: Boolean(shouldQueue),
          scan_source: telemetryScanSource(activeScanMode),
        });
        captureOperationalError(failure, {
          area: 'analysis',
          operation: `analyze_${telemetryScanSource(activeScanMode)}`,
          code: failure.kind,
        });
      }
    } finally {
      inFlightAnalysisIdsRef.current.delete(invocationScanId);
    }
  }, [barcodeInput, descriptionInput, photoUri, queuedInput, scanId]);

  const resumeLatestAnalysis = useCallback(async () => {
    const queue = await loadAnalysisQueue();
    const latest = queue.at(-1);
    if (!latest) return false;
    analysisGenerationRef.current += 1;
    const queuedPhotoUri = `data:${latest.mimeType};base64,${latest.imageBase64}`;
    scanModeRef.current = 'queued';
    photoUriRef.current = queuedPhotoUri;
    setScanId(latest.id);
    setScanMode('queued');
    setQueuedInput(latest);
    setPhotoUri(queuedPhotoUri);
    setAnalysisStatus('idle');
    setAnalysisError(null);
    setAnalysisMessage(null);
    return true;
  }, []);

  const adjustItem = (id: string, direction: -1 | 1) => {
    setMealPortionState(null);
    setDetectedItems((current) =>
      current.map((item) => {
        if (item.id !== id) return item;
        const nextAmount = Math.max(10, item.amountG + direction * 10);
        return scaleItem(item, nextAmount);
      }),
    );
  };

  /**
   * Typing the amount instead of stepping to it in tens: a 330 ml can is
   * thirty-three taps away from the 10 g default, which is not an edit anyone
   * makes twice.
   */
  const setItemAmount = (id: string, grams: number) => {
    const amount = Math.round(grams);
    if (!Number.isFinite(amount) || amount < 1 || amount > 5000) return;
    setMealPortionState(null);
    setDetectedItems((current) => current.map((item) => (item.id === id ? scaleItem(item, amount) : item)));
  };

  const setMealPortion = (factor: PortionFactor) => {
    setMealPortionState(factor);
    setDetectedItems((current) =>
      current.map((item) => scaleItem(item, Math.max(10, Math.round(item.baseAmountG * factor)))),
    );
  };

  const toggleItem = (id: string) => {
    setDetectedItems((current) =>
      current.map((item) => (item.id === id ? { ...item, included: !item.included } : item)),
    );
  };

  const resetScan = useCallback(() => {
    analysisGenerationRef.current += 1;
    deleteTemporaryPhoto(photoUri);
    photoUriRef.current = null;
    scanModeRef.current = 'demo';
    plannedMealTypeRef.current = null;
    setPlannedMealTypeState(null);
    setDetectedItems(DETECTED_ITEMS);
    setMealTitle(getDictionary().errors.demoMealTitle);
    setPhotoUri(null);
    setScanId(makeScanId());
    setScanMode('demo');
    setQueuedInput(null);
    setDescriptionInput('');
    setBarcodeInput('');
    setMealPortionState(1);
    setAnalysisStatus('idle');
    setAnalysisError(null);
    setAnalysisMessage(null);
  }, [photoUri]);

  const resetAfterAccountDeletion = useCallback(() => {
    analysisGenerationRef.current += 1;
    analysisIdentityGenerationRef.current += 1;
    deleteTemporaryPhoto(photoUriRef.current);
    photoUriRef.current = null;
    scanModeRef.current = 'demo';
    setProfile(DEFAULT_PROFILE);
    setTargets(DEFAULT_TARGETS);
    setMeals([]);
    setMealHistory([]);
    setLifetimeScanCount(0);
    setWeightEntries([]);
    setDetectedItems(DETECTED_ITEMS);
    setMealTitle(getDictionary().errors.demoMealTitle);
    setPhotoUri(null);
    setScanId(makeScanId());
    setScanMode('demo');
    setQueuedInput(null);
    setDescriptionInput('');
    setBarcodeInput('');
    setMealPortionState(1);
    setAnalysisStatus('idle');
    setAnalysisError(null);
    setAnalysisMessage(null);
    setPendingAnalysisCount(0);
    setSyncMode('local');
    setWellnessConsentGranted(false);
  }, []);

  const setPlannedMealType = useCallback((type: Meal['type'] | null) => {
    plannedMealTypeRef.current = type;
    setPlannedMealTypeState(type);
  }, []);

  /**
   * The slot belongs to the meal it was chosen for and to no other.
   *
   * Only resetScan cleared it, so tapping "+" beside breakfast and then
   * abandoning the scan left the choice standing: a dinner logged from the
   * plan tab hours later was filed as breakfast.
   */
  const consumePlannedMealType = useCallback(() => {
    const type = plannedMealTypeRef.current;
    plannedMealTypeRef.current = null;
    setPlannedMealTypeState(null);
    return type;
  }, []);

  const logScannedMeal = useCallback(async () => {
    const existing = mealHistory.find((meal) => meal.id === scannedMeal.id);
    const now = new Date();
    // Origin remains honest for history/cloud recovery. The allowance itself
    // was already spent when the AI result arrived, even if this confirmation
    // is abandoned. Search/barcode are known values and remain free.
    const costsAnalysis = !FREE_ANALYSIS_MODES.has(scanModeRef.current);
    // The clock guesses the slot; tapping "+" next to breakfast states it. A
    // correction re-saves the same id, and the choice is spent by then, so the
    // meal that was filed under breakfast kept its own slot rather than
    // snapping back to whatever the clock says now.
    const slot = consumePlannedMealType() ?? existing?.type;
    const persistedMeal: Meal = {
      ...scannedMeal,
      ...(slot ? { type: slot } : {}),
      ...nutritionFromItems(detectedItems),
      origin: costsAnalysis ? 'scan' : 'plan',
      date: localDateKey(now),
      savedAt: now.toISOString(),
    };
    await saveSyncedMeal(persistedMeal);
    setMeals((current) => [...current.filter((meal) => meal.id !== persistedMeal.id), persistedMeal]);
    setMealHistory((current) => [...current.filter((meal) => meal.id !== persistedMeal.id), persistedMeal]);
  }, [detectedItems, mealHistory, scannedMeal]);

  /**
   * Logs a meal the user picked from Kandro's own suggestions. It never touches
   * the free-scan allowance: no analysis ran, so it cost nothing, and charging
   * for the app's own recommendation would be absurd.
   */
  const logPlannedMeal = useCallback(async (suggestion: MealSuggestion, portion: PortionFactor) => {
    const now = new Date();
    const planned = createPlannedMeal(suggestion, portion, `plan-${suggestion.id}-${now.getTime()}`);
    const slot = consumePlannedMealType();
    const persisted: Meal = {
      ...planned,
      ...(slot ? { type: slot } : {}),
      date: localDateKey(now),
      savedAt: now.toISOString(),
    };
    await saveSyncedMeal(persisted);
    setMeals((current) => [...current, persisted]);
    setMealHistory((current) => [...current, persisted]);
    return persisted;
  }, []);

  const repeatMeals = useMemo(() => availableRepeats(mealHistory, meals), [mealHistory, meals]);

  /**
   * Logs a meal the user has eaten before. Costs no analysis call, so like a
   * planned meal it never spends part of the free allowance.
   */
  const logRepeatMeal = useCallback(async (candidate: RepeatCandidate) => {
    const now = new Date();
    const hour = now.getHours();
    const repeated: Meal = {
      ...candidate.source,
      id: `repeat-${candidate.key.replace(/[^a-z0-9]+/gi, '-')}-${now.getTime()}`,
      type: consumePlannedMealType() ?? (hour < 11 ? 'Breakfast' : hour < 15 ? 'Lunch' : hour < 21 ? 'Dinner' : 'Snack'),
      time: formatClockTime(now),
      date: localDateKey(now),
      savedAt: now.toISOString(),
    };
    await saveSyncedMeal(repeated);
    setMeals((current) => [...current, repeated]);
    setMealHistory((current) => [...current, repeated]);
    return repeated;
  }, []);

  /**
   * Removes a meal from the day. Until this existed a mis-scan, a wrong portion
   * or a double tap on a repeat was stuck in the user's day forever, while the
   * result screen promised control over every ingredient and portion.
   */
  const deleteLoggedMeal = useCallback(async (id: string) => {
    await deleteSyncedMeal(id);
    setMeals((current) => current.filter((meal) => meal.id !== id));
    setMealHistory((current) => current.filter((meal) => meal.id !== id));
  }, []);

  /**
   * Rescales an already logged meal. Scaling runs from each item's baseAmountG,
   * so picking 1x always returns to the original estimate rather than drifting
   * further with every correction.
   */
  const adjustLoggedMealPortion = useCallback(async (id: string, factor: PortionFactor) => {
    const target = mealHistory.find((meal) => meal.id === id) ?? meals.find((meal) => meal.id === id);
    if (!target) return;

    const items = target.items.map((item) => scaleItem(item, Math.max(1, Math.round(item.baseAmountG * factor))));
    const updated: Meal = { ...target, items, ...nutritionFromItems(items) };
    await saveSyncedMeal(updated);
    const replace = (list: Meal[]) => list.map((meal) => (meal.id === id ? updated : meal));
    setMeals(replace);
    setMealHistory(replace);
  }, [mealHistory, meals]);

  /**
   * The meal moment is derived from the clock at logging time, so anyone who
   * catches up on three meals in the evening ends up with three "Abendessen".
   * Correcting it must not require deleting and redoing the meal.
   */
  const setLoggedMealType = useCallback(async (id: string, type: Meal['type']) => {
    const target = mealHistory.find((meal) => meal.id === id) ?? meals.find((meal) => meal.id === id);
    if (!target || target.type === type) return;
    const updated: Meal = { ...target, type };
    await saveSyncedMeal(updated);
    const replace = (list: Meal[]) => list.map((meal) => (meal.id === id ? updated : meal));
    setMeals(replace);
    setMealHistory(replace);
  }, [mealHistory, meals]);

  const value = useMemo<AppContextValue>(
    () => ({
      setUnitSystem,
      plannedMealType,
      setPlannedMealType,
      userName,
      profile,
      hydrationReady,
      wellnessConsentGranted,
      targets,
      meals,
      mealHistory,
      weightEntries,
      consumed,
      remaining,
      detectedItems,
      scannedMeal: { ...scannedMeal, ...nutritionFromItems(detectedItems) },
      photoUri,
      scanMode,
      hasLoggedScan,
      hasEverLoggedScan,
      lifetimeScanCount,
      freeScansLeft,
      isCurrentScanLogged,
      mealPortion,
      analysisStatus,
      analysisError,
      applySearchResult,
      analysisMessage,
      pendingAnalysisCount,
      syncMode,
      refreshCloudState,
      loadExistingAccount,
      retryAccountRecovery,
      grantWellnessConsent,
      withdrawWellnessConsent,
      completeOnboarding,
      addWeightEntry,
      setCapturedPhoto,
      startDemoScan,
      startDescriptionScan,
      startBarcodeScan,
      analyzeCurrentPhoto,
      resumeLatestAnalysis,
      adjustItem,
      setItemAmount,
      setMealPortion,
      toggleItem,
      resetScan,
      resetAfterAccountDeletion,
      logScannedMeal,
      logPlannedMeal,
      repeatMeals,
      logRepeatMeal,
      deleteLoggedMeal,
      adjustLoggedMealPortion,
      setLoggedMealType,
    }),
    [addWeightEntry, adjustLoggedMealPortion, analysisError, applySearchResult, analysisMessage, analysisStatus, analyzeCurrentPhoto, completeOnboarding, consumed, deleteLoggedMeal, detectedItems, freeScansLeft, grantWellnessConsent, hasEverLoggedScan, hasLoggedScan, lifetimeScanCount, hydrationReady, isCurrentScanLogged, loadExistingAccount, logPlannedMeal, logRepeatMeal, logScannedMeal, mealHistory, repeatMeals, mealPortion, meals, pendingAnalysisCount, photoUri, profile, refreshCloudState, remaining, resetAfterAccountDeletion, resetScan, resumeLatestAnalysis, retryAccountRecovery, scanMode, setUnitSystem, setLoggedMealType, plannedMealType, setPlannedMealType, scannedMeal, setCapturedPhoto, startBarcodeScan, startDemoScan, startDescriptionScan, syncMode, targets, userName, weightEntries, wellnessConsentGranted, withdrawWellnessConsent],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside AppProvider');
  return value;
}
