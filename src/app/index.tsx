import { useEffect, useState } from 'react';
import { isReminderOnboardingPending } from '@/services/reminders';
import { useTheme, useThemedStyles } from '@/context/ThemeContext';
import type { ThemeColors } from '@/constants/theme';
import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useApp } from '@/context/AppContext';

export default function Index() {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { hydrationReady, profile, wellnessConsentGranted } = useApp();

  const [pendingReminder, setPendingReminder] = useState<boolean | null>(null);
  useEffect(() => { void isReminderOnboardingPending().then(setPendingReminder).catch(() => setPendingReminder(false)); }, []);

  if (!hydrationReady || pendingReminder === null) {
    return (
      <View accessibilityLabel="Kandro wird geladen" style={styles.loading}>
        <ActivityIndicator color={colors.accentText} />
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
