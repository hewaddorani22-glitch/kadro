import { useEffect, useState } from 'react';
import { isReminderOnboardingPending } from '@/services/reminders';
import { useThemedStyles } from '@/context/ThemeContext';
import type { ThemeColors } from '@/constants/theme';
import { Redirect } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { KandroMark } from '@/components/KandroMark';

import { useApp } from '@/context/AppContext';

export default function Index() {
  const styles = useThemedStyles(makeStyles);
  const { hydrationReady, profile, wellnessConsentGranted } = useApp();

  const [pendingReminder, setPendingReminder] = useState<boolean | null>(null);
  useEffect(() => { void isReminderOnboardingPending().then(setPendingReminder).catch(() => setPendingReminder(false)); }, []);

  if (!hydrationReady || pendingReminder === null) {
    return (
      // The same calm brand hand-over as the route guard, never a bare spinner.
      <View accessibilityLabel="Kandro" style={styles.loading}>
        <KandroMark size={56} />
      </View>
    );
  }

  if (!wellnessConsentGranted) {
    return <Redirect href={(profile.completedAt ? '/data-consent' : '/onboarding') as never} />;
  }
  return <Redirect href={profile.completedAt ? pendingReminder ? '/reminder-setup' : '/(tabs)/today' : '/onboarding'} />;
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
});
