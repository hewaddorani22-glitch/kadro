import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { AnalysisErrorKind, MealAnalysisInput } from '@/services/contracts';
import { analyzePreparedPhoto, deleteTemporaryPhoto, MealAnalysisError, prepareMealPhoto } from '@/services/mealAnalysis';
import { loadAnalysisQueue, loadMeals, queueAnalysis, removeQueuedAnalysis, saveMeal } from '@/services/localRepository';
import {
  createScannedMeal,
  DEFAULT_TARGETS,
  DETECTED_ITEMS,
  getRemaining,
  INITIAL_MEALS,
  nutritionFromItems,
  sumMeals,
} from '@/services/mockNutrition';
import { DailyTargets, Meal, MealItem, Nutrition, PortionFactor } from '@/types/nutrition';
import { localDateKey } from '@/utils/date';

export type AnalysisStatus = 'idle' | 'analyzing' | 'ready' | 'queued' | 'error';
type ScanMode = 'live' | 'demo' | 'queued';

type AppContextValue = {
  userName: string;
  targets: DailyTargets;
  meals: Meal[];
  consumed: Nutrition;
  remaining: Nutrition;
  detectedItems: MealItem[];
  scannedMeal: Meal;
  photoUri: string | null;
  hasLoggedScan: boolean;
  mealPortion: PortionFactor | null;
  analysisStatus: AnalysisStatus;
  analysisError: AnalysisErrorKind | null;
  analysisMessage: string | null;
  pendingAnalysisCount: number;
  setCapturedPhoto: (uri: string) => void;
  startDemoScan: () => void;
  analyzeCurrentPhoto: (forceDemo?: boolean) => Promise<void>;
  resumeLatestAnalysis: () => Promise<boolean>;
  adjustItem: (id: string, direction: -1 | 1) => void;
  setMealPortion: (factor: PortionFactor) => void;
  toggleItem: (id: string) => void;
  resetScan: () => void;
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
  };
}

export function AppProvider({ children }: PropsWithChildren) {
  const [meals, setMeals] = useState<Meal[]>(INITIAL_MEALS);
  const [detectedItems, setDetectedItems] = useState<MealItem[]>(DETECTED_ITEMS);
  const [mealTitle, setMealTitle] = useState('Hähnchen-Reis-Bowl');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [scanId, setScanId] = useState(makeScanId);
  const [scanMode, setScanMode] = useState<ScanMode>('demo');
  const photoUriRef = useRef<string | null>(null);
  const scanModeRef = useRef<ScanMode>('demo');
  const [queuedInput, setQueuedInput] = useState<MealAnalysisInput | null>(null);
  const [mealPortion, setMealPortionState] = useState<PortionFactor | null>(1);
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>('idle');
  const [analysisError, setAnalysisError] = useState<AnalysisErrorKind | null>(null);
  const [analysisMessage, setAnalysisMessage] = useState<string | null>(null);
  const [pendingAnalysisCount, setPendingAnalysisCount] = useState(0);

  useEffect(() => {
    let active = true;
    void Promise.all([loadMeals(), loadAnalysisQueue()]).then(([storedMeals, queue]) => {
      if (!active) return;
      setMeals(storedMeals);
      setPendingAnalysisCount(queue.length);
    });
    return () => {
      active = false;
    };
  }, []);

  const consumed = useMemo(() => sumMeals(meals), [meals]);
  const remaining = useMemo(() => getRemaining(DEFAULT_TARGETS, consumed), [consumed]);
  const scannedMeal = useMemo(
    () => createScannedMeal(detectedItems, mealTitle, scanId),
    [detectedItems, mealTitle, scanId],
  );
  const hasLoggedScan = meals.some((meal) => meal.origin === 'scan');

  const setCapturedPhoto = useCallback((uri: string) => {
    photoUriRef.current = uri;
    scanModeRef.current = 'live';
    setPhotoUri(uri);
    setScanMode('live');
    setQueuedInput(null);
    setAnalysisStatus('idle');
  }, []);

  const startDemoScan = useCallback(() => {
    deleteTemporaryPhoto(photoUri);
    photoUriRef.current = null;
    scanModeRef.current = 'demo';
    setPhotoUri(null);
    setScanMode('demo');
    setQueuedInput(null);
    setDetectedItems(DETECTED_ITEMS);
    setMealTitle('Hähnchen-Reis-Bowl');
    setAnalysisStatus('idle');
    setAnalysisError(null);
    setAnalysisMessage(null);
  }, [photoUri]);

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
      return;
    }

    let input = queuedInput;
    try {
      if (!input) {
        const originalUri = photoUriRef.current ?? photoUri;
        if (!originalUri) throw new MealAnalysisError('unclear-image', 'Bitte fotografiere den ganzen Teller erneut.');
        const prepared = await prepareMealPhoto(originalUri);
        input = prepared;
        photoUriRef.current = prepared.previewUri;
        setPhotoUri(prepared.previewUri);
        if (prepared.previewUri !== originalUri) deleteTemporaryPhoto(originalUri);
      }

      const result = await analyzePreparedPhoto(input);
      setDetectedItems(result.items);
      setMealTitle(result.title);
      setMealPortionState(1);
      setAnalysisMessage(result.warnings[0] ?? null);
      setAnalysisStatus('ready');
      if (scanMode === 'queued') {
        setPendingAnalysisCount(await removeQueuedAnalysis(scanId));
      }
    } catch (error) {
      const failure = error instanceof MealAnalysisError
        ? error
        : new MealAnalysisError('provider-error', 'Die Analyse konnte nicht abgeschlossen werden.');
      const shouldQueue = input && (failure.kind === 'offline' || failure.kind === 'provider-error');
      if (shouldQueue && input) {
        const count = await queueAnalysis({ ...input, id: scanId, createdAt: new Date().toISOString() });
        setPendingAnalysisCount(count);
        setAnalysisStatus('queued');
      } else {
        setAnalysisStatus('error');
      }
      setAnalysisError(failure.kind);
      setAnalysisMessage(failure.message);
    }
  }, [photoUri, queuedInput, scanId, scanMode]);

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
    setMealPortionState(1);
    setAnalysisStatus('idle');
    setAnalysisError(null);
    setAnalysisMessage(null);
  }, [photoUri]);

  const logScannedMeal = useCallback(async () => {
    const now = new Date();
    const persistedMeal: Meal = {
      ...scannedMeal,
      ...nutritionFromItems(detectedItems),
      date: localDateKey(now),
      savedAt: now.toISOString(),
    };
    setMeals(await saveMeal(persistedMeal));
  }, [detectedItems, scannedMeal]);

  const value = useMemo<AppContextValue>(
    () => ({
      userName: 'Alex',
      targets: DEFAULT_TARGETS,
      meals,
      consumed,
      remaining,
      detectedItems,
      scannedMeal: { ...scannedMeal, ...nutritionFromItems(detectedItems) },
      photoUri,
      hasLoggedScan,
      mealPortion,
      analysisStatus,
      analysisError,
      analysisMessage,
      pendingAnalysisCount,
      setCapturedPhoto,
      startDemoScan,
      analyzeCurrentPhoto,
      resumeLatestAnalysis,
      adjustItem,
      setMealPortion,
      toggleItem,
      resetScan,
      logScannedMeal,
    }),
    [analysisError, analysisMessage, analysisStatus, analyzeCurrentPhoto, consumed, detectedItems, hasLoggedScan, logScannedMeal, mealPortion, meals, pendingAnalysisCount, photoUri, remaining, resetScan, resumeLatestAnalysis, scannedMeal, setCapturedPhoto, startDemoScan],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside AppProvider');
  return value;
}
