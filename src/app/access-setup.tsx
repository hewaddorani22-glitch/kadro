import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Screen, Card, PrimaryButton } from '@/components/ui';
import { AccountLinkCard } from '@/components/AccountLinkCard';
import { useAccess } from '@/context/AccessContext';
import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/i18n/LanguageProvider';

export default function AccessSetup() {
  const access = useAccess(); const router = useRouter(); const { t } = useLanguage(); const { colors } = useTheme();
  const [firstUse, setFirstUse] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(false);
  const finish = async (newUser: boolean) => {
    if (busy) return;
    setBusy(true); setError(false);
    try { await access.enroll(newUser); router.replace('/(tabs)/today'); }
    catch { setError(true); }
    finally { setBusy(false); }
  };
  if (access.ready && !access.enrollmentPending) return <Redirect href="/(tabs)/today" />;
  return <Screen>
    <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 28, fontWeight: '700' }}>{t.access.identityTitle}</Text>
    <Text style={{ color: colors.muted, fontSize: 16, lineHeight: 24 }}>{t.access.identityBody}</Text>
    <Card><Pressable accessibilityRole="checkbox" accessibilityState={{ checked: firstUse }} onPress={() => setFirstUse(v => !v)} style={{ minHeight: 48, justifyContent: 'center' }}>
      <Text style={{ color: colors.text, fontSize: 17 }}>{firstUse ? '☑' : '☐'} {t.access.firstUse}</Text>
    </Pressable></Card>
    <AccountLinkCard />
    {error ? <Text accessibilityRole="alert" style={{ color: colors.attention }}>{t.access.verify}</Text> : null}
    <PrimaryButton disabled={busy} label={busy ? t.common.moment : t.access.identityContinue} onPress={() => void finish(firstUse)} />
    <PrimaryButton disabled={busy} variant="ghost" label={t.access.identitySkip} onPress={() => void finish(false)} />
  </Screen>;
}
