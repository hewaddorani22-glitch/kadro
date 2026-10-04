import { useEffect, useSyncExternalStore } from 'react';
import { getReminderOnboardingSnapshot, isReminderOnboardingPending, subscribeReminderOnboarding } from '@/services/reminders';

/** Screen and route guard observe the same completion, before the next route. */
export function useReminderOnboarding() {
  const pending = useSyncExternalStore(subscribeReminderOnboarding, getReminderOnboardingSnapshot, getReminderOnboardingSnapshot);
  useEffect(() => { void isReminderOnboardingPending(); }, []);
  return pending;
}
