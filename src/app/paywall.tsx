import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/ui';
import { KandroMark } from '@/components/KandroMark';
import { colors, radii } from '@/constants/theme';
import { FREE_SCAN_ALLOWANCE } from '@/constants/product';
import { useApp } from '@/context/AppContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { formatNumber } from '@/utils/format';
import { toBillingMode, trackEvent } from '@/services/telemetry';

type Plan = 'yearly' | 'monthly';

export default function PaywallScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ reason?: string }>();
  const { consumed, lifetimeScanCount, meals } = useApp();
  const [selected, setSelected] = useState<Plan>('yearly');
  const { busy, error, purchase, refresh, restore, snapshot, status } = useSubscription();
  const yearly = snapshot?.plans.yearly ?? null;
  const monthly = snapshot?.plans.monthly ?? null;
  const selectedPlan = snapshot?.plans[selected] ?? null;
  const testStore = snapshot?.mode === 'test-store';
  const billingMode = toBillingMode(snapshot?.mode);
  const paywallViewed = useRef(false);

  // The same screen has to work for someone interrupted mid-scan and for
  // someone who tapped it out of curiosity. Pretending both are the same moment
  // is why paywalls read as a wall.
  const blocked = params.reason === 'blocked';
  const afterMeal = params.reason === 'after-meal';
  const headline = blocked
    ? `Deine ${FREE_SCAN_ALLOWANCE} Mahlzeiten sind erfasst.`
    : afterMeal
      ? 'So läuft dein Tag ab jetzt.'
      : 'Iss mit einem Plan.\nNicht nach Gefühl.';
  const subline = blocked
    ? 'Du hast gesehen, wie sich der Tag nach jeder Mahlzeit neu aufstellt. Mit Pro hört das nicht auf.'
    : afterMeal
      ? 'Jede weitere Mahlzeit rechnet den Rest des Tages neu und sagt dir, was als Nächstes passt.'
      : 'Behalte die ruhige, adaptive Unterstützung, die du gerade erlebt hast – nach jeder Mahlzeit.';

  useEffect(() => {
    if (status === 'loading' || paywallViewed.current) return;
    paywallViewed.current = true;
    trackEvent('paywall viewed', { billing_mode: billingMode });
  }, [billingMode, status]);

  useEffect(() => {
    if (!snapshot?.configured || selectedPlan) return;
    if (yearly) setSelected('yearly');
    else if (monthly) setSelected('monthly');
  }, [monthly, selectedPlan, snapshot?.configured, yearly]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const subscribe = async () => {
    if (status === 'active') {
      router.replace('/(tabs)/today');
      return;
    }
    if (status === 'unconfigured') {
      Alert.alert(
        'RevenueCat noch nicht verbunden',
        'Die Paywall läuft als sichere Vorschau. Nach dem Eintragen des öffentlichen Test-Store-Schlüssels werden Kauf und Wiederherstellung in Expo Go simuliert.',
        [{ text: 'Abbrechen', style: 'cancel' }, { text: 'Demo fortsetzen', onPress: () => router.replace('/(tabs)/today') }],
      );
      return;
    }
    if (status === 'error') {
      await refresh();
      return;
    }
    const result = await purchase(selected);
    if (result !== 'active') return;
    trackEvent('subscription purchase completed', { billing_mode: billingMode, plan: selected });
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      testStore ? 'Test-Abo aktiviert' : 'Kandro Pro aktiviert',
      testStore ? 'Der RevenueCat Test Store hat den Kauf ohne echte Abbuchung simuliert.' : 'Dein Kandro-Pro-Zugang ist jetzt aktiv.',
      [{ text: 'Weiter', onPress: () => router.replace('/(tabs)/today') }],
    );
  };

  const restorePurchase = async () => {
    if (status === 'unconfigured') {
      Alert.alert('Noch nicht verbunden', 'Füge zuerst den öffentlichen RevenueCat-Schlüssel in der .env-Datei ein.');
      return;
    }
    const result = await restore();
    if (result === 'failed') return;
    const active = result === 'active';
    trackEvent('subscription restore completed', { active, billing_mode: billingMode });
    Alert.alert(
      active ? 'Käufe wiederhergestellt' : 'Kein aktives Abo gefunden',
      active ? 'Kandro Pro ist wieder aktiv.' : 'Für dieses Store-Konto wurde kein aktiver Kandro-Pro-Kauf gefunden.',
    );
  };

  const buttonLabel = busy
    ? 'Wird verarbeitet …'
    : status === 'loading'
      ? 'Angebot wird geladen …'
      : status === 'active'
        ? 'Mit Kandro Pro weiter'
        : status === 'unconfigured'
          ? 'Demo fortsetzen'
          : status === 'error'
            ? 'Erneut laden'
            : testStore
              ? 'Test-Abo starten'
              : selectedPlan?.hasFreeTrial
                ? 'Kostenlos testen'
                : 'Kandro Pro starten';

  const billingCopy = status === 'active'
    ? 'Dein Kandro-Pro-Zugang ist aktiv.'
    : status === 'unconfigured'
      ? 'Vorschaupreise – es wird nichts abgebucht.'
      : selectedPlan
        ? `${selectedPlan.billing}${testStore ? ' Test Store: keine echte Abbuchung.' : ''}`
        : 'Lege im aktuellen RevenueCat Offering ein Jahres- und/oder Monatspaket an.';

  // App Store Review guideline 3.1.2 requires length, price and the renewal
  // terms to be visible before the purchase, not only in the store listing.
  // A missing renewal notice is one of the most common rejection reasons.
  const savingPercent = yearly?.monthlyEquivalent && monthly?.priceAmount
    ? Math.round((1 - yearly.monthlyEquivalent / monthly.priceAmount) * 100)
    : null;
  const yearlyBadge = savingPercent && savingPercent >= 5 ? `${savingPercent} % GÜNSTIGER` : 'BESTER PREIS';

  const renewalCopy = selected === 'yearly'
    ? 'Jahresabo. Verlängert sich automatisch um 12 Monate, bis du kündigst.'
    : 'Monatsabo. Verlängert sich automatisch um 1 Monat, bis du kündigst.';

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
      <View style={styles.topBar}>
        <Pressable accessibilityLabel="Paywall schließen" accessibilityRole="button" onPress={() => router.back()} style={styles.closeButton}>
          <Ionicons color={colors.text} name="close" size={22} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy || status === 'loading' }} disabled={busy || status === 'loading'} onPress={() => void restorePurchase()}>
          <Text style={[styles.restore, (busy || status === 'loading') && styles.disabledText]}>Wiederherstellen</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        <View style={styles.heroMark}><KandroMark size={76} /></View>
        {testStore ? <View style={styles.testBadge}><Text style={styles.testBadgeText}>REVENUECAT TEST STORE</Text></View> : null}
        <Text style={styles.title}>{headline}</Text>
        <Text style={styles.subtitle}>{subline}</Text>

        {lifetimeScanCount > 0 ? (
          <View style={styles.progressCard}>
            <Text style={styles.progressLabel}>BISHER MIT KANDRO</Text>
            <Text style={styles.progressValue}>
              {lifetimeScanCount} {lifetimeScanCount === 1 ? 'Mahlzeit' : 'Mahlzeiten'} erfasst
              {meals.length ? ` · heute ${formatNumber(consumed.calories)} kcal eingeordnet` : ''}
            </Text>
          </View>
        ) : null}

        <View style={styles.benefits}>
          <Benefit label="Jede Mahlzeit erfassen – Foto, Beschreibung oder Barcode" />
          <Benefit label="Der Tag rechnet sich nach jeder Mahlzeit neu" />
          <Benefit label="Drei konkrete Vorschläge für den nächsten Teller" />
          <Benefit label="Abendabschluss und Verlauf über alle Tage" />
        </View>

        <View style={styles.keepsCard}>
          <Ionicons color={colors.accentDeep} name="lock-open-outline" size={17} />
          <Text style={styles.keepsText}>
            Dein bisheriger Verlauf bleibt dir in jedem Fall erhalten – auch ohne Pro. Ohne Abo kommen nur keine neuen Analysen dazu.
          </Text>
        </View>

        <View style={styles.plans}>
          <PlanCard
            badge={yearlyBadge}
            detail={yearly?.trialLabel ? `${yearly.trialLabel} gratis, dann ${yearly.detail}` : (yearly?.detail ?? '€3,33 pro Monat')}
            disabled={Boolean(snapshot?.configured && !yearly)}
            label="Jährlich"
            onPress={() => setSelected('yearly')}
            price={yearly?.price ?? (snapshot?.configured ? 'Nicht verfügbar' : '€39,99 / Jahr')}
            selected={selected === 'yearly'}
          />
          <PlanCard
            detail={monthly?.trialLabel ? `${monthly.trialLabel} gratis, dann ${monthly.detail}` : (monthly?.detail ?? 'Flexibel, jederzeit kündbar')}
            disabled={Boolean(snapshot?.configured && !monthly)}
            label="Monatlich"
            onPress={() => setSelected('monthly')}
            price={monthly?.price ?? (snapshot?.configured ? 'Nicht verfügbar' : '€9,99 / Monat')}
            selected={selected === 'monthly'}
          />
        </View>
        {status === 'loading' ? <ActivityIndicator color={colors.accentDeep} style={styles.loader} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 10 }]}>
        <PrimaryButton
          disabled={busy || status === 'loading' || (snapshot?.configured === true && status !== 'active' && !selectedPlan && status !== 'error')}
          icon={status === 'active' ? 'checkmark-circle-outline' : 'arrow-forward'}
          label={buttonLabel}
          onPress={() => void subscribe()}
        />
        <Text style={styles.billing}>{billingCopy}</Text>
        {status !== 'active' ? (
          <Text style={styles.renewal}>
            {renewalCopy} Die Abbuchung erfolgt über deine Apple-ID. Kündigen kannst du jederzeit bis 24 Stunden vor Ablauf in den Einstellungen deiner Apple-ID.
          </Text>
        ) : null}
        <View style={styles.legalRow}>
          <Pressable accessibilityRole="link" onPress={() => router.push('/terms')}><Text style={styles.legal}>Bedingungen</Text></Pressable>
          <View style={styles.legalDot} />
          <Pressable accessibilityRole="link" onPress={() => router.push('/privacy')}><Text style={styles.legal}>Datenschutz</Text></Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

function Benefit({ label }: { label: string }) {
  return (
    <View style={styles.benefit}>
      <View style={styles.benefitCheck}><Ionicons color={colors.text} name="checkmark" size={16} /></View>
      <Text style={styles.benefitText}>{label}</Text>
    </View>
  );
}

function PlanCard({ badge, detail, disabled, label, onPress, price, selected }: { badge?: string; detail: string; disabled?: boolean; label: string; onPress: () => void; price: string; selected: boolean }) {
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ disabled: Boolean(disabled), selected }} disabled={disabled} onPress={onPress} style={[styles.planCard, selected && styles.planCardSelected, disabled && styles.planCardDisabled]}>
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected ? <View style={styles.radioDot} /> : null}
      </View>
      <View style={styles.planCopy}>
        <View style={styles.planLabelRow}>
          <Text style={styles.planLabel}>{label}</Text>
          {badge ? <View style={styles.badge}><Text style={styles.badgeText}>{badge}</Text></View> : null}
        </View>
        <Text style={styles.planDetail}>{detail}</Text>
      </View>
      <Text style={styles.planPrice}>{price}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 20 },
  topBar: { height: 55, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  closeButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  restore: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  scroll: { flex: 1 },
  content: { flexGrow: 1, alignItems: 'center', paddingTop: 15, paddingBottom: 16 },
  heroMark: { width: 104, height: 104, borderRadius: 52, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.neutralSoft, alignItems: 'center', justifyContent: 'center' },
  testBadge: { backgroundColor: colors.accent, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 5, marginTop: 10 },
  testBadgeText: { color: colors.text, fontSize: 8, fontWeight: '800', letterSpacing: 0.7 },
  title: { color: colors.text, fontSize: 36, lineHeight: 41, fontWeight: '700', letterSpacing: -1.2, textAlign: 'center', marginTop: 20 },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 340, marginTop: 10 },
  progressCard: { alignSelf: 'stretch', marginTop: 20, borderRadius: radii.card, backgroundColor: colors.neutralSoft, paddingHorizontal: 14, paddingVertical: 12, gap: 3 },
  progressLabel: { color: colors.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  progressValue: { color: colors.text, fontSize: 13, fontWeight: '700', lineHeight: 18 },
  keepsCard: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginTop: 18, borderRadius: radii.card, backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accent, padding: 13 },
  keepsText: { flex: 1, minWidth: 0, color: colors.text, fontSize: 11, lineHeight: 16 },
  benefits: { alignSelf: 'stretch', gap: 13, marginTop: 22, paddingHorizontal: 7 },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  benefitCheck: { width: 30, height: 30, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  benefitText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  plans: { alignSelf: 'stretch', gap: 10, marginTop: 25 },
  planCard: { minHeight: 76, borderRadius: radii.button, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 11 },
  planCardSelected: { borderColor: colors.accentDeep, backgroundColor: colors.neutralSoft },
  planCardDisabled: { opacity: 0.45 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: colors.accentDeep },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.accentDeep },
  planCopy: { flex: 1, minWidth: 0, gap: 4 },
  planLabelRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7 },
  planLabel: { color: colors.text, fontSize: 15, fontWeight: '700' },
  planDetail: { color: colors.muted, fontSize: 10 },
  badge: { flexShrink: 0, backgroundColor: colors.text, borderRadius: radii.pill, paddingHorizontal: 7, paddingVertical: 4 },
  badgeText: { color: colors.white, fontSize: 7, fontWeight: '800', letterSpacing: 0.7 },
  planPrice: { flexShrink: 0, color: colors.text, fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  footer: { gap: 9, paddingTop: 10, backgroundColor: colors.background },
  loader: { marginTop: 12 },
  error: { color: colors.attention, fontSize: 11, lineHeight: 16, marginTop: 12, textAlign: 'center' },
  disabledText: { opacity: 0.45 },
  billing: { color: colors.muted, fontSize: 10, textAlign: 'center' },
  renewal: { color: colors.muted, fontSize: 9, lineHeight: 13, textAlign: 'center', paddingHorizontal: 4 },
  legalRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  legal: { color: colors.muted, fontSize: 9, textDecorationLine: 'underline' },
  legalDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: colors.muted },
});
