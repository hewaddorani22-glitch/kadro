import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { localDateKey } from '@/utils/date';

/** Refresh on resume and within a minute of midnight while left open. */
export function useLocalDay() {
  const [day, setDay] = useState(localDateKey);
  useEffect(() => {
    const refresh = () => setDay(localDateKey());
    const timer = setInterval(refresh, 30_000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => { clearInterval(timer); subscription.remove(); };
  }, []);
  return day;
}
