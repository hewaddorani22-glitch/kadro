import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { AccountLinkCard } from '@/components/AccountLinkCard';
import { Card, Eyebrow, PageTitle, Screen, SectionTitle } from '@/components/ui';
import { colors, radii } from '@/constants/theme';
import { useApp } from '@/context/AppContext';
import { useSubscription } from '@/context/SubscriptionContext';
import {
  getAnalyticsCollectionEnabled,
  isTelemetryConfigured,
  setAnalyticsCollectionEnabled,
} from '@/services/telemetry';
import { formatNumber } from '@/utils/format';

export default function ProfileScreen() {
  const router = useRouter();
  const { syncMode, targets, userName } = useApp();
  const { status: subscriptionStatus } = useSubscription();
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);

  useEffect(() => {
    let active = true;
    void getAnalyticsCollectionEnabled().then((enabled) => {
      if (active) setAnalyticsEnabled(enabled);
    });
    return () => {
      active = false;
    };
  }, []);

  const updateAnalytics = async (enabled: boolean) => {
    setAnalyticsEnabled(await setAnalyticsCollectionEnabled(enabled));
  };

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{userName.trim().charAt(0).toUpperCase() || 'K'}</Text></View>
        <View style={styles.headerCopy}>
          <Eyebrow>Dein Profil</Eyebrow>
          <PageTitle>{userName}</PageTitle>
          <Text style={styles.subtitle}>
            {syncMode === 'cloud'
              ? 'Cloud-Synchronisierung aktiv'
              : syncMode === 'syncing'
                ? 'Konto wird verbunden …'
                : syncMode === 'error'
                  ? 'Offline · wird später synchronisiert'
                  : 'Lokal auf diesem Gerät'}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <SectionTitle>Dein Konto</SectionTitle>
        <AccountLinkCard />
      </View>

      <Pressable accessibilityLabel="Kadro Pro ansehen" accessibilityRole="button" onPress={() => router.push('/paywall')}>
        <Card style={styles.proCard}>
          <View style={styles.proIcon}><Ionicons color={colors.text} name="infinite" size={26} /></View>
          <View style={styles.proCopy}>
            <Text style={styles.proTitle}>{subscriptionStatus === 'active' ? 'Kadro Pro ist aktiv' : 'Kadro Pro'}</Text>
            <Text style={styles.proText}>{subscriptionStatus === 'active' ? 'Dein Zugang ist auf diesem Konto freigeschaltet.' : 'Unbegrenzte Scans. Ein Plan, der sich weiter anpasst.'}</Text>
          </View>
          <View style={styles.tryPill}><Text style={styles.tryText}>{subscriptionStatus === 'active' ? 'AKTIV' : 'ANSEHEN'}</Text></View>
        </Card>
      </Pressable>

      <View style={styles.section}>
        <SectionTitle>Dein Plan</SectionTitle>
        <Card style={styles.planCard}>
          <View style={styles.planGrid}>
            <PlanStat label="Kalorien" value={formatNumber(targets.calories)} />
            <PlanStat label="Protein" value={`${targets.protein} g`} />
            <PlanStat label="Ziel" value="Reduzieren" />
            <PlanStat label="Aktivität" value="Leicht" />
          </View>
        </Card>
      </View>

      <View style={styles.section}>
        <SectionTitle>Datenschutz-Einstellungen</SectionTitle>
        <Card style={styles.listCard}>
          <InfoRow
            detail="Originalfotos werden nach der Analyse verworfen."
            icon="image-outline"
            label="Umgang mit Fotos"
          />
          <View style={styles.divider} />
          <ToggleRow
            detail={isTelemetryConfigured
              ? 'Nur anonyme Funktionsereignisse und bereinigte Fehler – keine Fotos, E-Mail, Lebensmittel oder Nährwerte.'
              : 'Wird verfügbar, sobald PostHog für den Test verbunden ist.'}
            disabled={!isTelemetryConfigured}
            icon="analytics-outline"
            label="Anonyme Nutzungsanalyse"
            onValueChange={(enabled) => void updateAnalytics(enabled)}
            value={analyticsEnabled}
          />
        </Card>
      </View>

      <View style={styles.section}>
        <SectionTitle>Support und Datenschutz</SectionTitle>
        <Card style={styles.listCard}>
          <MenuRow icon="shield-checkmark-outline" label="Datenschutz" onPress={() => router.push('/privacy')} />
          <View style={styles.divider} />
          <MenuRow icon="document-text-outline" label="Nutzungsbedingungen" onPress={() => router.push('/terms')} />
          <View style={styles.divider} />
          <MenuRow icon="trash-outline" label="Account und Daten löschen" onPress={() => router.push('/account-deletion')} />
        </Card>
      </View>

      <View style={styles.wellnessNote}>
        <Ionicons color={colors.muted} name="information-circle-outline" size={18} />
        <Text style={styles.wellnessText}>Kadro liefert allgemeine Wellness-Schätzungen und ist kein medizinischer Dienst.</Text>
      </View>

      <Text style={styles.version}>Kadro · MVP 0.1.0</Text>
    </Screen>
  );
}

function PlanStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.planStat}>
      <Text style={styles.planStatLabel}>{label}</Text>
      <Text style={styles.planStatValue}>{value}</Text>
    </View>
  );
}

function ToggleRow({ detail, disabled, icon, label, onValueChange, value }: { detail: string; disabled?: boolean; icon: keyof typeof Ionicons.glyphMap; label: string; onValueChange: (value: boolean) => void; value: boolean }) {
  return (
    <View style={[styles.toggleRow, disabled && styles.disabledRow]}>
      <View style={styles.rowIcon}><Ionicons color={colors.text} name={icon} size={20} /></View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowDetail}>{detail}</Text>
      </View>
      <Switch disabled={disabled} ios_backgroundColor={colors.border} onValueChange={onValueChange} thumbColor={colors.surface} trackColor={{ false: colors.border, true: colors.accentDeep }} value={value} />
    </View>
  );
}

function InfoRow({ detail, icon, label }: { detail: string; icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.rowIcon}><Ionicons color={colors.text} name={icon} size={20} /></View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowDetail}>{detail}</Text>
      </View>
    </View>
  );
}

function MenuRow({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.menuRow}>
      <View style={styles.rowIcon}><Ionicons color={colors.text} name={icon} size={20} /></View>
      <Text style={styles.menuLabel}>{label}</Text>
      <Ionicons color={colors.muted} name="chevron-forward" size={18} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.white, fontSize: 20, fontWeight: '800' },
  headerCopy: { flex: 1, gap: 3 },
  subtitle: { color: colors.muted, fontSize: 13 },
  proCard: { backgroundColor: colors.surface, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  proIcon: { width: 46, height: 46, borderRadius: 17, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  proCopy: { flex: 1, gap: 4 },
  proTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  proText: { color: colors.text, opacity: 0.7, fontSize: 11, lineHeight: 15 },
  tryPill: { backgroundColor: colors.text, borderRadius: radii.pill, paddingHorizontal: 9, paddingVertical: 6 },
  tryText: { color: colors.white, fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  section: { gap: 13 },
  planCard: { padding: 8 },
  planGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  planStat: { width: '50%', padding: 14, gap: 4 },
  planStatLabel: { color: colors.muted, fontSize: 11 },
  planStatValue: { color: colors.text, fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
  listCard: { padding: 8 },
  toggleRow: { minHeight: 78, padding: 9, flexDirection: 'row', alignItems: 'center', gap: 11 },
  disabledRow: { opacity: 0.55 },
  menuRow: { minHeight: 58, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 11 },
  rowIcon: { width: 40, height: 40, borderRadius: 15, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, gap: 3 },
  rowLabel: { color: colors.text, fontSize: 14, fontWeight: '700' },
  rowDetail: { color: colors.muted, fontSize: 10, lineHeight: 14 },
  menuLabel: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '600' },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: 60 },
  wellnessNote: { flexDirection: 'row', gap: 9, paddingHorizontal: 8 },
  wellnessText: { flex: 1, color: colors.muted, fontSize: 11, lineHeight: 17 },
  version: { color: colors.muted, fontSize: 10, textAlign: 'center' },
});
