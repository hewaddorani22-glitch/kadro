import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import { AppRouteGuard } from '@/components/AppRouteGuard';
import { ReminderScheduler } from '@/components/ReminderScheduler';
import { colors } from '@/constants/theme';
import { AppProvider } from '@/context/AppContext';
import { LanguageProvider } from '@/i18n/LanguageProvider';
import { SubscriptionProvider } from '@/context/SubscriptionContext';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { configureNotifications, remindersSupported } from '@/services/reminders';

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function RootLayout() {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!remindersSupported) return;
    configureNotifications();
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const route = response.notification.request.content.data?.route;
      if (typeof route === 'string' && route.startsWith('/')) router.push(route as never);
    });
    return () => subscription.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <AppErrorBoundary>
        <LanguageProvider>
        <AppProvider>
          <SubscriptionProvider>
            <AppRouteGuard>
              <ReminderScheduler />
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
              <Stack.Screen name="data-consent" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="analyzing" options={{ gestureEnabled: false }} />
              <Stack.Screen name="confirm" />
              <Stack.Screen name="result" />
              <Stack.Screen name="paywall" options={{ presentation: 'modal', animation: reduceMotion ? 'none' : 'slide_from_bottom' }} />
              <Stack.Screen name="privacy" />
              <Stack.Screen name="terms" />
              <Stack.Screen name="account-deletion" />
              <Stack.Screen name="evening" />
              <Stack.Screen name="sources" />
              </Stack>
            </AppRouteGuard>
          </SubscriptionProvider>
        </AppProvider>
        </LanguageProvider>
      </AppErrorBoundary>
    </SafeAreaProvider>
  );
}
