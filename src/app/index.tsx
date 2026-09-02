import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colors } from '@/constants/theme';
import { useApp } from '@/context/AppContext';

export default function Index() {
  const { hydrationReady, profile, wellnessConsentGranted } = useApp();

  if (!hydrationReady) {
    return (
      <View accessibilityLabel="Kandro wird geladen" style={styles.loading}>
        <ActivityIndicator color={colors.accentDeep} />
      </View>
    );
  }

  if (!wellnessConsentGranted) {
    return <Redirect href={(profile.completedAt ? '/data-consent' : '/onboarding') as never} />;
  }
  return <Redirect href={profile.completedAt ? '/(tabs)/today' : '/onboarding'} />;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
});
