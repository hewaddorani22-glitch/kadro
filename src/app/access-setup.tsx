import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Screen, PrimaryButton } from '@/components/ui';
import { BUILDING_MS, PlanBuilder } from '@/components/PlanBuilder';
import { useAccess } from '@/context/AccessContext';
import { useApp } from '@/context/AppContext';
import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/i18n/LanguageProvider';

/**
 * A fresh install that just finished onboarding is a first use by
 * construction; the server still rejects any identity with prior meals,
 * analyses or an older account. While access is resolved, the plan is built
 * on screen (the real intermediate values), so the step into the app or the
 * paywall feels like a result, not a loading spinner.
 */
export default function AccessSetup() {
  const access = useAccess(); const router = useRouter(); const { t } = useLanguage(); const { colors } = useTheme();
  const { profile } = useApp();
  const [busy, setBusy] = useState(false); const [error, setError] = useState(false);
  const started = useRef(false);
  const finish = async (newUser: boolean) => {
    if (busy) return;
    setBusy(true); setError(false);
    const shown = Date.now();
    try {
      await access.enroll(newUser);
      // Let the plan finish building; never cut the count off mid-number.
      const left = BUILDING_MS + 300 - (Date.now() - shown);
      if (left > 0) await new Promise(resolve => setTimeout(resolve, left));
      router.replace('/(tabs)/today');
    }
    catch { setError(true); }
    finally { setBusy(false); }
  };
  useEffect(() => {
    if (started.current || !access.ready || !access.enrollmentPending) return;
    started.current = true;
    void finish(true);
  }, [access.ready, access.enrollmentPending]);
  if (access.ready && !access.enrollmentPending && !busy) return <Redirect href="/(tabs)/today" />;
  return <Screen>
    <View style={{ flex: 1, justifyContent: 'center', gap: 28, paddingVertical: 40 }}>
      <View style={{ gap: 8 }}>
        <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 30, lineHeight: 36, fontWeight: '700', letterSpacing: -0.8, textAlign: 'center' }}>{t.access.buildingTitle}</Text>
        <Text style={{ color: colors.muted, fontSize: 16, lineHeight: 23, textAlign: 'center' }}>{t.access.preparing}</Text>
      </View>
      <PlanBuilder profile={profile} />
      {error ? <View style={{ gap: 10 }}>
        <Text accessibilityRole="alert" style={{ color: colors.attention, fontSize: 15, lineHeight: 22, textAlign: 'center' }}>{t.access.verify}</Text>
        <PrimaryButton disabled={busy} label={busy ? t.common.moment : t.access.identityContinue} onPress={() => void finish(true)} />
        <PrimaryButton disabled={busy} variant="ghost" label={t.access.identitySkip} onPress={() => void finish(false)} />
      </View> : null}
    </View>
  </Screen>;
}
