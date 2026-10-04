import { useTheme, useThemedStyles } from '@/context/ThemeContext';
import type { ThemeColors } from '@/constants/theme';
import { usePathname, useRouter, useSegments } from 'expo-router';
import { PropsWithChildren, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/ui';
import { useAccess } from '@/context/AccessContext';
import { rememberAccessDestination, routeRequiresAccess } from '@/services/accessPolicy';
import { useReminderOnboarding } from '@/hooks/useReminderOnboarding';
import { useApp } from '@/context/AppContext';
import { useLanguage } from '@/i18n/LanguageProvider';
import { requiresMealDraftRedirect } from '@/utils/mealDraftGuard';
import { canSaveMealDraft } from '@/utils/ingredientCorrection';

const publicBeforeConsent = new Set(['index', 'account-help', 'saved-meals', 'onboarding', 'data-consent', 'privacy', 'terms', 'sources', 'account-deletion']);

export function AppRouteGuard({ children }: PropsWithChildren) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const segments = useSegments();
  const path = usePathname();
  const access = useAccess();
  const reminderPending = useReminderOnboarding();
  const { analysisStatus, detectedItems, hydrationReady, localStorageError, profile, retryAccountRecovery, syncMode, wellnessConsentGranted } = useApp();
  const missingMealDraft = requiresMealDraftRedirect(segments[0] ?? 'index', analysisStatus);
  const incompleteResult = segments[0] === 'result' && analysisStatus === 'ready' && !canSaveMealDraft(detectedItems);
  const { t } = useLanguage();
  const [retryBusy, setRetryBusy] = useState(false);
  const [retryError, setRetryError] = useState(false);

  const accessApplies = hydrationReady && wellnessConsentGranted && !!profile.completedAt && routeRequiresAccess(path);
  const accessRedirect = accessApplies && reminderPending === false && access.ready
    ? access.enrollmentPending ? '/access-setup' : (!access.canUse || access.entryPaywall) ? '/paywall' : null : null;
  const accessWaiting = accessApplies && (!access.ready || reminderPending === null);
  useEffect(() => {
    if (accessRedirect) {
      rememberAccessDestination(path);
      router.replace(accessRedirect as never);
    } else if (accessApplies && reminderPending) router.replace('/reminder-setup');
  }, [accessRedirect, accessApplies, reminderPending, path, router]);

  useEffect(() => {
    if (!hydrationReady || accessRedirect || accessWaiting) return;
    const rootSegment = segments[0] ?? 'index';
    if (!wellnessConsentGranted && !publicBeforeConsent.has(rootSegment)) {
      router.replace((profile.completedAt ? '/data-consent' : '/onboarding') as never);
      return;
    }
    if (wellnessConsentGranted && !profile.completedAt && !publicBeforeConsent.has(rootSegment)) {
      router.replace('/onboarding');
      return;
    }
    if (missingMealDraft) router.replace('/(tabs)/scan');
    else if (incompleteResult) router.replace('/confirm');
  }, [accessRedirect, accessWaiting, hydrationReady, incompleteResult, missingMealDraft, profile.completedAt, router, segments, wellnessConsentGranted]);

  // Do not merely pause redirects while identity hydration is incomplete. The
  // protected tree contains profile setters that write to Supabase and must not
  // remain operable under a newly authenticated account with stale state.
  if (!hydrationReady) {
    if (syncMode === 'error') {
      return (
        <View style={styles.gate}>
          <Text accessibilityRole="header" style={styles.title}>{localStorageError ? t.account.localRecoveryTitle : t.account.recoveryTitle}</Text>
          <Text style={styles.copy}>{localStorageError ? t.account.localRecoveryText : retryError ? t.account.recoveryError : t.account.recoveryText}</Text>
          <PrimaryButton
            disabled={retryBusy}
            icon="refresh"
            label={retryBusy ? t.account.recoveryBusy : t.account.recoveryAction}
            onPress={() => {
              setRetryBusy(true);
              setRetryError(false);
              void retryAccountRecovery()
                .catch(() => setRetryError(true))
                .finally(() => setRetryBusy(false));
            }}
          />
        </View>
      );
    }
    return <View style={styles.gate}><ActivityIndicator color={colors.accentText} /></View>;
  }

  // Block the result's save-on-arrival effect before it can mount. Redirecting
  // only in an effect would be too late: child effects may already have run.
  if (accessRedirect || accessWaiting || (accessApplies && reminderPending)) return <View style={styles.gate}><ActivityIndicator color={colors.accentText} /></View>;
  if (missingMealDraft || incompleteResult) return <View style={styles.gate}><ActivityIndicator color={colors.accentText} /></View>;
  return children;
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  gate: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 28, backgroundColor: colors.background },
  title: { color: colors.text, fontSize: 26, lineHeight: 32, fontWeight: '800', textAlign: 'center' },
  copy: { maxWidth: 420, color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: 'center' },
});
