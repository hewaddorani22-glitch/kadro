import { useEffect } from 'react';
import { AppState } from 'react-native';
import type { AccessRecord } from '@/services/accessPolicy';
import { invalidateRevenueCatExperimentMeasurement, updateRevenueCatExperimentMeasurement } from '@/services/revenueCatExperimentAnalytics';

/** Lives outside the access route guard: abandonment does not change assignment. */
export function RevenueCatExperimentAnalytics(input: { owner: string | null; ready: boolean; serverVerified: boolean; age: number | null; record: AccessRecord }) {
  useEffect(() => {
    updateRevenueCatExperimentMeasurement(input);
    const app = AppState.addEventListener('change', state => { if (state === 'active') updateRevenueCatExperimentMeasurement(input); });
    return () => { app.remove(); };
  }, [input.owner, input.ready, input.serverVerified, input.age, input.record]);
  useEffect(() => () => invalidateRevenueCatExperimentMeasurement(), []);
  return null;
}
