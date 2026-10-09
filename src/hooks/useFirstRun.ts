import { useEffect, useSyncExternalStore } from 'react';
import { getFirstRunSnapshot, loadFirstRunStage, subscribeFirstRun } from '@/services/firstRun';

/** Route guard, first-scan prompt and paywall observe the same stage. */
export function useFirstRun() {
  const stage = useSyncExternalStore(subscribeFirstRun, getFirstRunSnapshot, getFirstRunSnapshot);
  useEffect(() => { void loadFirstRunStage(); }, []);
  return stage;
}
