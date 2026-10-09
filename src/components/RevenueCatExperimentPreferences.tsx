import { useEffect, useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Card } from '@/components/ui';
import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/i18n/LanguageProvider';
import { getRevenueCatExperimentMeasurementSnapshot, setRevenueCatExperimentMeasurementEnabled, subscribeRevenueCatExperimentMeasurement } from '@/services/revenueCatExperimentAnalytics';

export function RevenueCatExperimentPreferences() {
  const { colors } = useTheme(); const { t } = useLanguage(); const router = useRouter();
  const copy = t.revenueCatExperiment;
  const [snapshot, setSnapshot] = useState(getRevenueCatExperimentMeasurementSnapshot);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(false);
  useEffect(() => {
    const refresh = () => setSnapshot(getRevenueCatExperimentMeasurementSnapshot());
    refresh(); return subscribeRevenueCatExperimentMeasurement(refresh);
  }, []);
  const detail = snapshot.status === 'removal_pending' ? copy.pendingRemoval
    : !snapshot.eligible ? copy.ineligible
    : !snapshot.consent ? copy.off
    : snapshot.status === 'accepted' ? copy.active : copy.paused;
  return <Card>
    <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 20, fontWeight: '700' }}>{copy.title}</Text>
    <Text style={{ color: colors.muted, fontSize: 15, lineHeight: 22 }}>{copy.help}</Text>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 12 }}>
      <Text style={{ flex: 1, color: colors.text, fontSize: 16 }}>{copy.label}</Text>
      <Switch accessibilityLabel={copy.label} disabled={busy || (!snapshot.eligible && !snapshot.consent)} value={snapshot.consent} onValueChange={enabled => {
        setBusy(true); setError(false);
        void setRevenueCatExperimentMeasurementEnabled(enabled).catch(() => setError(true)).finally(() => setBusy(false));
      }} />
    </View>
    <Text style={{ color: colors.muted, fontSize: 15, lineHeight: 22 }}>{detail}</Text>
    {error || snapshot.status === 'error' ? <Text accessibilityRole="alert" style={{ color: colors.attentionText }}>{copy.error}</Text> : null}
    <Pressable accessibilityRole="link" onPress={() => router.push('/privacy')} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.accentText }}>{copy.privacyLink}</Text></Pressable>
  </Card>;
}
