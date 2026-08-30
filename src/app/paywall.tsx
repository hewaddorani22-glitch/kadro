import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/ui';
import { KadroMark } from '@/components/KadroMark';
import { colors, radii } from '@/constants/theme';

type Plan = 'yearly' | 'monthly';

export default function PaywallScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<Plan>('yearly');

  const subscribe = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (Platform.OS === 'web') {
      router.replace('/(tabs)/today');
      return;
    }
    Alert.alert(
      'Bezahlung folgt an Tag 3',
      'Dieses MVP nutzt absichtlich eine Demo-Bezahlung. RevenueCat kann diese Aktion später ersetzen, ohne den Screen zu ändern.',
      [{ text: 'Demo fortsetzen', onPress: () => router.replace('/(tabs)/today') }],
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <Pressable accessibilityLabel="Paywall schließen" onPress={() => router.back()} style={styles.closeButton}>
          <Ionicons color={colors.text} name="close" size={22} />
        </Pressable>
        <Pressable onPress={() => Alert.alert('Käufe wiederherstellen', 'Es gibt noch keinen Testkauf. RevenueCat ist für Tag 3 vorgesehen.')}>
          <Text style={styles.restore}>Wiederherstellen</Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        <View style={styles.heroMark}><KadroMark size={76} /></View>
        <Text style={styles.title}>Iss mit einem Plan.{`\n`}Nicht nach Gefühl.</Text>
        <Text style={styles.subtitle}>Behalte die ruhige, adaptive Unterstützung, die du gerade erlebt hast – nach jeder Mahlzeit.</Text>

        <View style={styles.benefits}>
          <Benefit label="Unbegrenzte Mahlzeiten-Scans" />
          <Benefit label="Neue Aufstellung nach jeder Mahlzeit" />
          <Benefit label="Persönliche Vorschläge für den nächsten Zug" />
        </View>

        <View style={styles.plans}>
          <PlanCard
            badge="BESTER PREIS"
            detail="€3,33 pro Monat"
            label="Jährlich"
            onPress={() => setSelected('yearly')}
            price="€39,99 / Jahr"
            selected={selected === 'yearly'}
          />
          <PlanCard
            detail="Flexibel, jederzeit kündbar"
            label="Monatlich"
            onPress={() => setSelected('monthly')}
            price="€9,99 / Monat"
            selected={selected === 'monthly'}
          />
        </View>
      </View>

      <View style={styles.footer}>
        <PrimaryButton icon="arrow-forward" label="7 Tage kostenlos testen" onPress={subscribe} />
        <Text style={styles.billing}>{selected === 'yearly' ? '€39,99/Jahr' : '€9,99/Monat'} nach dem Test. Jederzeit kündbar.</Text>
        <View style={styles.legalRow}>
          <Text style={styles.legal}>Bedingungen</Text>
          <View style={styles.legalDot} />
          <Text style={styles.legal}>Datenschutz</Text>
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

function PlanCard({ badge, detail, label, onPress, price, selected }: { badge?: string; detail: string; label: string; onPress: () => void; price: string; selected: boolean }) {
  return (
    <Pressable onPress={onPress} style={[styles.planCard, selected && styles.planCardSelected]}>
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
  content: { flex: 1, alignItems: 'center', paddingTop: 15 },
  heroMark: { width: 104, height: 104, borderRadius: 52, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.neutralSoft, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, fontSize: 36, lineHeight: 41, fontWeight: '700', letterSpacing: -1.2, textAlign: 'center', marginTop: 20 },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 340, marginTop: 10 },
  benefits: { alignSelf: 'stretch', gap: 13, marginTop: 24, paddingHorizontal: 7 },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  benefitCheck: { width: 30, height: 30, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  benefitText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  plans: { alignSelf: 'stretch', gap: 10, marginTop: 25 },
  planCard: { minHeight: 76, borderRadius: radii.button, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 11 },
  planCardSelected: { borderColor: colors.accentDeep, backgroundColor: colors.neutralSoft },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: colors.accentDeep },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.accentDeep },
  planCopy: { flex: 1, gap: 4 },
  planLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  planLabel: { color: colors.text, fontSize: 15, fontWeight: '700' },
  planDetail: { color: colors.muted, fontSize: 10 },
  badge: { backgroundColor: colors.text, borderRadius: radii.pill, paddingHorizontal: 7, paddingVertical: 4 },
  badgeText: { color: colors.white, fontSize: 7, fontWeight: '800', letterSpacing: 0.7 },
  planPrice: { color: colors.text, fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  footer: { gap: 9, paddingBottom: 10 },
  billing: { color: colors.muted, fontSize: 10, textAlign: 'center' },
  legalRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  legal: { color: colors.muted, fontSize: 9, textDecorationLine: 'underline' },
  legalDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: colors.muted },
});
