import { useEffect } from 'react';

import { useApp } from '@/context/AppContext';
import { remindersSupported, syncEveningReminder } from '@/services/reminders';

/**
 * Keeps the scheduled reminders in step with the user's actual targets.
 *
 * A repeating notification carries fixed text, so the morning message would
 * otherwise keep announcing the calorie goal the user had when they first
 * enabled it. Rescheduling on every target change keeps it true.
 *
 * Lives inside AppProvider because the root layout sits outside it.
 */
export function ReminderScheduler() {
  const { hydrationReady, targets } = useApp();

  useEffect(() => {
    if (!remindersSupported || !hydrationReady) return;
    void syncEveningReminder({ calories: targets.calories, protein: targets.protein });
  }, [hydrationReady, targets.calories, targets.protein]);

  return null;
}
