import { createContext, PropsWithChildren, useContext, useMemo, useState } from 'react';

import {
  createScannedMeal,
  DEFAULT_TARGETS,
  DETECTED_ITEMS,
  getRemaining,
  INITIAL_MEALS,
  nutritionFromItems,
  sumMeals,
} from '@/services/mockNutrition';
import { DailyTargets, Meal, MealItem, Nutrition } from '@/types/nutrition';

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
  setPhotoUri: (uri: string | null) => void;
  adjustItem: (id: string, direction: -1 | 1) => void;
  toggleItem: (id: string) => void;
  resetScan: () => void;
  logScannedMeal: () => void;
};

const AppContext = createContext<AppContextValue | null>(null);

function scaleItem(item: MealItem, nextAmount: number): MealItem {
  const ratio = nextAmount / item.amountG;
  return {
    ...item,
    amountG: nextAmount,
    calories: Math.round(item.calories * ratio),
    protein: Math.round(item.protein * ratio),
    carbs: Math.round(item.carbs * ratio),
    fat: Math.round(item.fat * ratio),
  };
}

export function AppProvider({ children }: PropsWithChildren) {
  const [meals, setMeals] = useState<Meal[]>(INITIAL_MEALS);
  const [detectedItems, setDetectedItems] = useState<MealItem[]>(DETECTED_ITEMS);
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const consumed = useMemo(() => sumMeals(meals), [meals]);
  const remaining = useMemo(() => getRemaining(DEFAULT_TARGETS, consumed), [consumed]);
  const scannedMeal = useMemo(() => createScannedMeal(detectedItems), [detectedItems]);
  const hasLoggedScan = meals.some((meal) => meal.id === scannedMeal.id);

  const adjustItem = (id: string, direction: -1 | 1) => {
    setDetectedItems((current) =>
      current.map((item) => {
        if (item.id !== id) return item;
        const nextAmount = Math.max(10, item.amountG + direction * 10);
        return scaleItem(item, nextAmount);
      }),
    );
  };

  const toggleItem = (id: string) => {
    setDetectedItems((current) =>
      current.map((item) => (item.id === id ? { ...item, included: !item.included } : item)),
    );
  };

  const resetScan = () => {
    setDetectedItems(DETECTED_ITEMS);
    setPhotoUri(null);
  };

  const logScannedMeal = () => {
    setMeals((current) => {
      const withoutOldScan = current.filter((meal) => meal.id !== scannedMeal.id);
      return [...withoutOldScan, scannedMeal];
    });
  };

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
      setPhotoUri,
      adjustItem,
      toggleItem,
      resetScan,
      logScannedMeal,
    }),
    [consumed, detectedItems, hasLoggedScan, meals, photoUri, remaining, scannedMeal],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside AppProvider');
  return value;
}
