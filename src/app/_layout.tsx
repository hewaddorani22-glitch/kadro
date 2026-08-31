import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import { colors } from '@/constants/theme';
import { AppProvider } from '@/context/AppContext';
import { SubscriptionProvider } from '@/context/SubscriptionContext';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function RootLayout() {
  const reduceMotion = useReducedMotion();

  return (
    <SafeAreaProvider>
      <AppErrorBoundary>
        <AppProvider>
          <SubscriptionProvider>
            <StatusBar style="dark" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.background },
                animation: Platform.OS === 'web' || reduceMotion ? 'none' : 'slide_from_right',
              }}
            >
              <Stack.Screen name="index" />
              <Stack.Screen name="onboarding" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="analyzing" options={{ gestureEnabled: false }} />
              <Stack.Screen name="confirm" />
              <Stack.Screen name="result" />
              <Stack.Screen name="paywall" options={{ presentation: 'modal', animation: reduceMotion ? 'none' : 'slide_from_bottom' }} />
              <Stack.Screen name="privacy" />
              <Stack.Screen name="terms" />
              <Stack.Screen name="account-deletion" />
            </Stack>
          </SubscriptionProvider>
        </AppProvider>
      </AppErrorBoundary>
    </SafeAreaProvider>
  );
}
