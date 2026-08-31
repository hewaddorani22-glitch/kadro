import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { AnalysisErrorKind, MealAnalysisInput } from '@/services/contracts';
import { analyzeBarcode, analyzeDescription, analyzePreparedPhoto, deleteTemporaryPhoto, MealAnalysisError, prepareMealPhoto } from '@/services/mealAnalysis';
import {
  loadAllStoredScans,
  loadAnalysisQueue,
  loadMeals,
  loadProfile,
  loadWeightEntries,
  queueAnalysis,
  removeQueuedAnalysis,
  saveProfile,
  saveWeightEntry,
} from '@/services/localRepository';
import {
  createScannedMeal,
  DEFAULT_TARGETS,
  DETECTED_ITEMS,
  getRemaining,
  nutritionFromItems,
  sumMeals,
} from '@/services/mockNutrition';
import { calculateDailyTargets, DEFAULT_PROFILE } from '@/services/personalization';
import { hydrateCloudState, saveSyncedMeal, syncUserSetup, SyncMode } from '@/services/syncRepository';
import { isSupabaseConfigured, startSupabaseAuthLifecycle } from '@/services/supabaseClient';
import { captureOperationalError, countBucket, trackEvent } from '@/services/telemetry';
import { DailyTargets, Meal, MealItem, Nutrition, PortionFactor, UserProfile, WeightEntry } from '@/types/nutrition';
import { localDateKey } from '@/utils/date';

export type AnalysisStatus = 'idle' | 'analyzing' | 'ready' | 'queued' | 'error';
type ScanMode = 'live' | 'demo' | 'queued' | 'description' | 'barcode';

function telemetryScanSource(mode: ScanMode) {
  if (mode === 'live') return 'camera' as const;
  if (mode === 'queued') return 'queued_retry' as const;
  if (mode === 'description') return 'description' as const;
  if (mode === 'barcode') return 'barcode' as const;
  return 'demo' as const;
}

type AppContextValue = {
  userName: string;
  profile: UserProfile;
  hydrationReady: boolean;
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
  isCurrentScanLogged: boolean;
  mealPortion: PortionFactor | null;
  analysisStatus: AnalysisStatus;
  analysisError: AnalysisErrorKind | null;
  analysisMessage: string | null;
  pendingAnalysisCount: number;
  syncMode: SyncMode;
  refreshCloudState: () => Promise<void>;
  completeOnboarding: (profile: UserProfile) => Promise<void>;
  addWeightEntry: (weightKg: number) => Promise<void>;
  setCapturedPhoto: (uri: string) => void;
  startDemoScan: () => void;
  startDescriptionScan: (description: string) => void;
  startBarcodeScan: (barcode: string) => void;
  analyzeCurrentPhoto: (forceDemo?: boolean) => Promise<void>;
  resumeLatestAnalysis: () => Promise<boolean>;
  adjustItem: (id: string, direction: -1 | 1) => void;
  setMealPortion: (factor: PortionFactor) => void;
  toggleItem: (id: string) => void;
  resetScan: () => void;
  resetAfterAccountDeletion: () => void;
  logScannedMeal: () => Promise<void>;
};

const AppContext = createContext<AppContextValue | null>(null);

function makeScanId() {
  return `scan-${Date.now()}`;
}

function scaleItem(item: MealItem, nextAmount: number): MealItem {
  const ratio = nextAmount / item.amountG;
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
  const [targets, setTargets] = useState(DEFAULT_TARGETS);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [mealHistory, setMealHistory] = useState<Meal[]>([]);
  const [freeScanUsed, setFreeScanUsed] = useState(false);
  const [weightEntries, setWeightEntries] = useState<WeightEntry[]>([]);
  const [detectedItems, setDetectedItems] = useState<MealItem[]>(DETECTED_ITEMS);
  const [mealTitle, setMealTitle] = useState('Hähnchen-Reis-Bowl');
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

  const refreshCloudState = useCallback(async () => {
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
      setFreeScanUsed(cloudState.hasEverLoggedScan);
      setTargets(cloudState.targets);
      setProfile(cloudState.profile);
      await saveProfile(cloudState.profile);
      setSyncMode('cloud');
    } catch (error) {
      setSyncMode('error');
      captureOperationalError(error, { area: 'cloud_sync', operation: 'refresh_cloud_state' });
      throw error;
    }
  }, []);

  useEffect(() => {
    let active = true;
    const stopAuthLifecycle = startSupabaseAuthLifecycle();
    void (async () => {
      const [storedMeals, storedHistory, queue, storedProfile, storedWeights] = await Promise.all([
        loadMeals(),
        loadAllStoredScans(),
        loadAnalysisQueue(),
        loadProfile(),
        loadWeightEntries(),
      ]);
      if (!active) return;
      setMeals(storedMeals);
      setMealHistory(storedHistory);
      setFreeScanUsed(storedHistory.length > 0);
      setPendingAnalysisCount(queue.length);
      setProfile(storedProfile);
      setWeightEntries(storedWeights);
      if (storedProfile.completedAt) setTargets(calculateDailyTargets(storedProfile));

      if (!isSupabaseConfigured) {
        setHydrationReady(true);
        return;
      }
      try {
        const cloudState = await hydrateCloudState();
        if (!active) return;
        if (!cloudState) {
          setSyncMode('local');
          return;
        }
        setMeals(cloudState.meals);
        setMealHistory(cloudState.mealHistory);
        setFreeScanUsed(cloudState.hasEverLoggedScan);
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

  const consumed = useMemo(() => sumMeals(meals), [meals]);
  const remaining = useMemo(() => getRemaining(targets, consumed), [consumed, targets]);
  const scannedMeal = useMemo(
    () => createScannedMeal(detectedItems, mealTitle, scanId),
    [detectedItems, mealTitle, scanId],
  );
  const hasLoggedScan = meals.some((meal) => meal.origin === 'scan');
  const hasEverLoggedScan = freeScanUsed || mealHistory.some((meal) => meal.origin === 'scan');
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
    setMealTitle('Hähnchen-Reis-Bowl');
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
      setMealTitle('Hähnchen-Reis-Bowl');
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
        if (!originalUri) throw new MealAnalysisError('unclear-image', 'Bitte fotografiere den ganzen Teller erneut.');
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
      if (scanMode === 'queued') {
        setPendingAnalysisCount(await removeQueuedAnalysis(scanId));
      }
    } catch (error) {
      const failure = error instanceof MealAnalysisError
        ? error
        : new MealAnalysisError('provider-error', 'Die Analyse konnte nicht abgeschlossen werden.');
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
  }, [barcodeInput, descriptionInput, photoUri, queuedInput, scanId, scanMode]);

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
    setMealTitle('Hähnchen-Reis-Bowl');
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
    setFreeScanUsed(false);
    setWeightEntries([]);
    setDetectedItems(DETECTED_ITEMS);
    setMealTitle('Hähnchen-Reis-Bowl');
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
  }, []);

  const logScannedMeal = useCallback(async () => {
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
    setFreeScanUsed(true);
  }, [detectedItems, scannedMeal]);

  const value = useMemo<AppContextValue>(
    () => ({
      userName,
      profile,
      hydrationReady,
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
      isCurrentScanLogged,
      mealPortion,
      analysisStatus,
      analysisError,
      analysisMessage,
      pendingAnalysisCount,
      syncMode,
      refreshCloudState,
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
    }),
    [addWeightEntry, analysisError, analysisMessage, analysisStatus, analyzeCurrentPhoto, completeOnboarding, consumed, detectedItems, hasEverLoggedScan, hasLoggedScan, hydrationReady, isCurrentScanLogged, logScannedMeal, mealHistory, mealPortion, meals, pendingAnalysisCount, photoUri, profile, refreshCloudState, remaining, resetAfterAccountDeletion, resetScan, resumeLatestAnalysis, scanMode, scannedMeal, setCapturedPhoto, startBarcodeScan, startDemoScan, startDescriptionScan, syncMode, targets, userName, weightEntries],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside AppProvider');
  return value;
}
