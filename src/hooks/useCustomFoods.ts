import { useEffect, useSyncExternalStore } from 'react';

import { getCustomFoodsSnapshot, loadCustomFoods, subscribeCustomFoods, syncCustomFoods } from '@/services/customFoods';

/**
 * The user's own products ("Mein Produkt"), live. Loads from the device on
 * first use and, when `sync` is set, refreshes from the cloud once.
 */
export function useCustomFoods(sync = false) {
  const foods = useSyncExternalStore(subscribeCustomFoods, getCustomFoodsSnapshot, getCustomFoodsSnapshot);
  useEffect(() => {
    void loadCustomFoods().then(() => (sync ? syncCustomFoods() : undefined)).catch(() => undefined);
  }, [sync]);
  return foods;
}
