import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { AnalysisErrorKind, MealAnalysisInput } from '@/services/contracts';
import { analyzeBarcode, analyzeDescription, analyzePreparedPhoto, deleteTemporaryPhoto, FoodSearchResult, MealAnalysisError, mealFromSearch, prepareMealPhoto } from '@/services/mealAnalysis';
import {
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
import { deleteSyncedMeal, hydrateCloudState, saveSyncedMeal, syncUserSetup, SyncMode } from '@/services/syncRepository';
import { isSupabaseConfigured, startSupabaseAuthLifecycle } from '@/services/supabaseClient';
import { captureOperationalError, countBucket, trackEvent } from '@/services/telemetry';
import { DailyTargets, Meal, MealItem, MealSuggestion, Nutrition, PortionFactor, UserProfile, WeightEntry } from '@/types/nutrition';
import { localDateKey } from '@/utils/date';
import { getDictionary } from '@/i18n/active';
import type { UnitSystem } from '@/utils/units';
import { forgetLocalWellnessConsent, hasCurrentWellnessConsent, recordWellnessConsent, withdrawWellnessConsent as withdrawStoredWellnessConsent } from '@/services/consent';
import { setEveningReminderEnabled } from '@/services/reminders';
import { formatClockTime } from '@/utils/format';

export type AnalysisStatus = 'idle' | 'analyzing' | 'ready' | 'queued' | 'error';
type ScanMode = 'live' | 'demo' | 'queued' | 'description' | 'barcode' | 'search';

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
  grantWellnessConsent: () => Promise<void>;
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
};

const AppContext = createContext<AppContextValue | null>(null);

function countScans(meals: Meal[]) {
  return meals.filter((meal) => meal.origin === 'scan').length;
}

function makeScanId() {
  return `scan-${Date.now()}`;
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

  /** Raises the persisted lifetime counter to whatever we just observed. */
  const adoptScanCount = useCallback(async (observedScans: number) => {
    const stored = await loadLifetimeScanCount();
    const next = Math.max(stored, observedScans);
    setLifetimeScanCount(next > stored ? await saveLifetimeScanCount(next) : stored);
  }, []);

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
      setProfile(cloudState.profile);
      await saveProfile(cloudState.profile);
      setSyncMode('cloud');
    } catch (error) {
      setSyncMode('error');
      captureOperationalError(error, { area: 'cloud_sync', operation: 'refresh_cloud_state' });
      throw error;
    }
  }, [adoptScanCount, wellnessConsentGranted]);

  useEffect(() => {
    let active = true;
    let stopAuthLifecycle: () => void = () => undefined;
    void (async () => {
      const [storedMeals, storedHistory, queue, storedProfile, storedWeights, storedScanCount, hasConsent] = await Promise.all([
        loadMeals(),
        loadAllStoredScans(),
        loadAnalysisQueue(),
        loadProfile(),
        loadWeightEntries(),
        loadLifetimeScanCount(),
        hasCurrentWellnessConsent(),
      ]);
      if (!active) return;
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
        setProfile(cloudState.profile);
        await saveProfile(cloudState.profile);
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
  }, []);

  const grantWellnessConsent = useCallback(async () => {
    await recordWellnessConsent();
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
          setProfile(cloudState.profile);
          await saveProfile(cloudState.profile);
          setSyncMode('cloud');
        }
      } catch (error) {
        // Consent is already valid on both sides. Keep the user in local mode
        // and let the normal refresh path recover cloud history later.
        setSyncMode('local');
        captureOperationalError(error, { area: 'cloud_sync', operation: 'hydrate_after_consent' });
      }
    }
  }, [adoptScanCount, profile.completedAt]);

  const withdrawWellnessConsent = useCallback(async () => {
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
    await saveProfile(completedProfile);
    setProfile(completedProfile);
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
  }, []);

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
    setAnalysisStatus('analyzing');
    setAnalysisError(null);
    setAnalysisMessage(null);

    const activeScanMode = scanModeRef.current;
    if (forceDemo || activeScanMode === 'demo') {
      await new Promise((resolve) => setTimeout(resolve, 1900));
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
        input = prepared;
        photoUriRef.current = prepared.previewUri;
        setPhotoUri(prepared.previewUri);
        if (prepared.previewUri !== originalUri) deleteTemporaryPhoto(originalUri);
      }

      const result = activeScanMode === 'description'
        ? await analyzeDescription(descriptionInput)
        : activeScanMode === 'barcode'
          ? await analyzeBarcode(barcodeInput)
          : await analyzePreparedPhoto(input!);
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
      if (activeScanMode === 'queued') {
        setPendingAnalysisCount(await removeQueuedAnalysis(scanId));
      }
    } catch (error) {
      // The gateway is the authority here. If it says there is no consent,
      // the local record is stale — keeping it would leave the user looking at
      // "Consent is active" with only a "Withdraw" button and no way back.
      if (error instanceof MealAnalysisError && error.kind === 'consent-required') {
        await forgetLocalWellnessConsent();
        setWellnessConsentGranted(false);
      }
      const failure = error instanceof MealAnalysisError
        ? error
        : new MealAnalysisError('provider-error', getDictionary().errors.analysisFailed);
      const shouldQueue = activeScanMode === 'live' || activeScanMode === 'queued'
        ? input && (failure.kind === 'offline' || failure.kind === 'provider-error')
        : false;
      if (shouldQueue && input) {
        const count = await queueAnalysis({ ...input, id: scanId, createdAt: new Date().toISOString() });
        setPendingAnalysisCount(count);
        setAnalysisStatus('queued');
      } else {
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
  }, [barcodeInput, descriptionInput, photoUri, queuedInput, scanId]);

  const resumeLatestAnalysis = useCallback(async () => {
    const queue = await loadAnalysisQueue();
    const latest = queue.at(-1);
    if (!latest) return false;
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
    deleteTemporaryPhoto(photoUri);
    photoUriRef.current = null;
    scanModeRef.current = 'demo';
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

  const logScannedMeal = useCallback(async () => {
    const alreadyLogged = mealHistory.some((meal) => meal.id === scannedMeal.id);
    const now = new Date();
    const persistedMeal: Meal = {
      ...scannedMeal,
      ...nutritionFromItems(detectedItems),
      date: localDateKey(now),
      savedAt: now.toISOString(),
    };
    await saveSyncedMeal(persistedMeal);
    setMeals((current) => [...current.filter((meal) => meal.id !== persistedMeal.id), persistedMeal]);
    setMealHistory((current) => [...current.filter((meal) => meal.id !== persistedMeal.id), persistedMeal]);
    // Corrections re-save the same scan id; only a genuinely new meal spends
    // part of the free allowance.
    if (!alreadyLogged) {
      setLifetimeScanCount(await saveLifetimeScanCount((await loadLifetimeScanCount()) + 1));
    }
  }, [detectedItems, mealHistory, scannedMeal]);

  /**
   * Logs a meal the user picked from Kandro's own suggestions. It never touches
   * the free-scan allowance: no analysis ran, so it cost nothing, and charging
   * for the app's own recommendation would be absurd.
   */
  const logPlannedMeal = useCallback(async (suggestion: MealSuggestion, portion: PortionFactor) => {
    const now = new Date();
    const planned = createPlannedMeal(suggestion, portion, `plan-${suggestion.id}-${now.getTime()}`);
    const persisted: Meal = { ...planned, date: localDateKey(now), savedAt: now.toISOString() };
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
      type: hour < 11 ? 'Breakfast' : hour < 15 ? 'Lunch' : hour < 21 ? 'Dinner' : 'Snack',
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
    [addWeightEntry, adjustLoggedMealPortion, analysisError, applySearchResult, analysisMessage, analysisStatus, analyzeCurrentPhoto, completeOnboarding, consumed, deleteLoggedMeal, detectedItems, freeScansLeft, grantWellnessConsent, hasEverLoggedScan, hasLoggedScan, lifetimeScanCount, hydrationReady, isCurrentScanLogged, logPlannedMeal, logRepeatMeal, logScannedMeal, mealHistory, repeatMeals, mealPortion, meals, pendingAnalysisCount, photoUri, profile, refreshCloudState, remaining, resetAfterAccountDeletion, resetScan, resumeLatestAnalysis, scanMode, setUnitSystem, setLoggedMealType, scannedMeal, setCapturedPhoto, startBarcodeScan, startDemoScan, startDescriptionScan, syncMode, targets, userName, weightEntries, wellnessConsentGranted, withdrawWellnessConsent],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside AppProvider');
  return value;
}
