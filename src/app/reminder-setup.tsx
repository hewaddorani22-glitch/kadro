import { useRef } from 'react';
import { Redirect } from 'expo-router';
import { Screen } from '@/components/ui';
import { ReminderPreferences } from '@/components/ReminderPreferences';
import { finishReminderOnboarding, type ReminderOnboardingChoice } from '@/services/reminders';
import { useReminderOnboarding } from '@/hooks/useReminderOnboarding';
import { useApp } from '@/context/AppContext';

export default function ReminderSetup() {
  const completedHere = useRef(false);
  const { profile, wellnessConsentGranted } = useApp();
  const pending = useReminderOnboarding();
  if (!wellnessConsentGranted || !profile.completedAt || pending === null) return null;
  if (!pending) return <Redirect href={completedHere.current ? { pathname: '/(tabs)/today', params: { tour: '1' } } : '/(tabs)/today'} />;
  const done = (choice: ReminderOnboardingChoice) => {
    if (completedHere.current) return;
    completedHere.current = true;
    void finishReminderOnboarding(choice).catch(() => undefined);
  };
  return <Screen><ReminderPreferences initialSetup onDone={done} /></Screen>;
}
