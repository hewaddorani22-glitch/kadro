import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useApp } from '@/context/AppContext';
import { useAccess } from '@/context/AccessContext';
import { syncEveningReminder } from '@/services/reminders';
export function ReminderScheduler() {
  const { hydrationReady, wellnessConsentGranted } = useApp();
  const { canUse } = useAccess();
  useEffect(() => {
    if (!hydrationReady || !wellnessConsentGranted) return;
    const refresh = () => { void syncEveningReminder().catch(() => undefined); };
    refresh();
    const sub = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    return () => sub.remove();
  }, [hydrationReady, wellnessConsentGranted, canUse]);
  return null;
}
