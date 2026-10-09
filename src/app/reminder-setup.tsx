import { useRef } from 'react';
import { Redirect } from 'expo-router';
import { Screen } from '@/components/ui';
import { ReminderPreferences } from '@/components/ReminderPreferences';
import { finishReminderOnboarding, type ReminderOnboardingChoice } from '@/services/reminders';
import { takeAccessDestination } from '@/services/accessPolicy';
import { useReminderOnboarding } from '@/hooks/useReminderOnboarding';
import { useApp } from '@/context/AppContext';

/**
 * The optional last question of the first run, after the offer. Either answer
 * goes straight on to where the person was heading (Today, or Plan when they
 * asked for ideas on the result). No separate app tour follows: the first
 * meal already showed how Kandro works; the tour stays available under "Du".
 */
export default function ReminderSetup() {
  const completedHere = useRef(false);
  const destination = useRef<string | null>(null);
  const { profile, wellnessConsentGranted } = useApp();
  const pending = useReminderOnboarding();
  if (!wellnessConsentGranted || !profile.completedAt || pending === null) return null;
  if (!pending) {
    destination.current ??= takeAccessDestination();
    return <Redirect href={destination.current as never} />;
  }
  const done = (choice: ReminderOnboardingChoice) => {
    if (completedHere.current) return;
    completedHere.current = true;
    void finishReminderOnboarding(choice).catch(() => undefined);
  };
  return <Screen><ReminderPreferences initialSetup onDone={done} /></Screen>;
}
