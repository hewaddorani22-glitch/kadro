import { useEffect, useState } from 'react';
import { AppState, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, PrimaryButton } from '@/components/ui';
import { ReminderPreferences } from '@/components/ReminderPreferences';
import { useApp } from '@/context/AppContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/i18n/LanguageProvider';
import { useLocalDay } from '@/hooks/useLocalDay';
import { trialActivity } from '@/services/weeklyReview';

export function TrialActivationCard() {
  const { colors } = useTheme();
  const { t, locale } = useLanguage();
  const { mealHistory, profile, hydrationReady } = useApp();
  const { snapshot, status } = useSubscription();
  const today = useLocalDay();
  const router = useRouter();
  const [showReminders, setShowReminders] = useState(false);
  const [now, setNow] = useState(Date.now);
  const expiresAt = Date.parse(snapshot?.currentTrial?.expiresAt ?? '');
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      if (timer) clearTimeout(timer);
      const current = Date.now(); setNow(current);
      if (Number.isFinite(expiresAt) && expiresAt > current) {
        timer = setTimeout(refresh, Math.min(expiresAt - current, 2_147_483_647));
      }
    };
    refresh();
    const listener = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    return () => { if (timer) clearTimeout(timer); listener.remove(); };
  }, [expiresAt]);
  // A confirmed snapshot can remain mounted beyond its deadline. Hiding this
  // optional trial card does not change paid access or server entitlement grace.
  if (!hydrationReady || !profile.completedAt || profile.age < 18 || status !== 'active' || !snapshot?.currentTrial
    || !Number.isFinite(expiresAt) || expiresAt <= Math.max(now, Date.now())) return null;
  const activity = trialActivity(mealHistory, snapshot.currentTrial.startedAt, today);
  if (!activity) return null;
  const copy = t.trialActivation;
  const text = { color: colors.muted, fontSize: 15, lineHeight: 22 };
  return <View style={{ gap: 12 }}>
    <Card>
      <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 21, fontWeight: '700' }}>{activity.loggedDays >= 3 ? copy.progressTitle : copy.title}</Text>
      <Text style={text}>{activity.loggedDays >= 3
        ? copy.progress(activity.loggedDays, activity.averageCalories!.toLocaleString(locale))
        : activity.loggedDays === 0 ? copy.firstMeal : copy.keepExploring}</Text>
      {activity.loggedDays >= 3 ? <Text style={text}>{copy.dataNote}</Text> : null}
      <PrimaryButton label={copy.logMeal} icon="add" onPress={() => router.push({ pathname: '/capture', params: { mode: 'search' } })} />
      <Text style={text}>{copy.reminderOffer}</Text>
      <PrimaryButton label={showReminders ? copy.closeReminders : copy.openReminders} variant="ghost" onPress={() => setShowReminders(value => !value)} />
    </Card>
    {showReminders ? <ReminderPreferences onDone={() => setShowReminders(false)} /> : null}
  </View>;
}
