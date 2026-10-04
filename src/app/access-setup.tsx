import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Screen, PrimaryButton } from '@/components/ui';
import { useAccess } from '@/context/AccessContext';
import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/i18n/LanguageProvider';

/**
 * A fresh install that just finished onboarding is a first use by
 * construction; the server still rejects any identity with prior meals,
 * analyses or an older account. Asking the user to tick "first use" and link
 * an e-mail first excluded almost everyone from the paywall experiment.
 */
export default function AccessSetup() {
  const access = useAccess(); const router = useRouter(); const { t } = useLanguage(); const { colors } = useTheme();
  const [busy, setBusy] = useState(false); const [error, setError] = useState(false);
  const started = useRef(false);
  const finish = async (newUser: boolean) => {
    if (busy) return;
    setBusy(true); setError(false);
    try { await access.enroll(newUser); router.replace('/(tabs)/today'); }
    catch { setError(true); }
    finally { setBusy(false); }
  };
  useEffect(() => {
    if (started.current || !access.ready || !access.enrollmentPending) return;
    started.current = true;
    void finish(true);
  }, [access.ready, access.enrollmentPending]);
  if (access.ready && !access.enrollmentPending) return <Redirect href="/(tabs)/today" />;
  return <Screen>
    <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 28, fontWeight: '700' }}>{t.access.identityTitle}</Text>
    {error ? <>
      <Text accessibilityRole="alert" style={{ color: colors.attention, fontSize: 16, lineHeight: 24 }}>{t.access.verify}</Text>
      <PrimaryButton disabled={busy} label={busy ? t.common.moment : t.access.identityContinue} onPress={() => void finish(true)} />
      <PrimaryButton disabled={busy} variant="ghost" label={t.access.identitySkip} onPress={() => void finish(false)} />
    </> : <>
      <ActivityIndicator color={colors.accentText} />
      <Text style={{ color: colors.muted, fontSize: 16, lineHeight: 24 }}>{t.access.preparing}</Text>
    </>}
  </Screen>;
}
