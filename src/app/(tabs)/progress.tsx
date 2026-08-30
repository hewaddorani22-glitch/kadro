import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { Card, Eyebrow, IconCircle, PageTitle, Screen, SectionTitle } from '@/components/ui';
import { colors, radii } from '@/constants/theme';

const weights = [78.4, 78.1, 77.9, 77.7, 77.4, 77.2, 76.9];

export default function ProgressScreen() {
  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Eyebrow>Letzte 30 Tage</Eyebrow>
          <PageTitle>Leiser Fortschritt summiert sich.</PageTitle>
          <Text style={styles.subtitle}>Der Trend zählt mehr als eine einzelne Mahlzeit oder Messung.</Text>
        </View>
        <IconCircle name="trending-down" size={48} />
      </View>

      <Card style={styles.weightCard}>
        <View style={styles.weightTop}>
          <View>
            <Text style={styles.cardLabel}>AKTUELLES GEWICHT</Text>
            <Text style={styles.currentWeight}>76,9<Text style={styles.kg}> kg</Text></Text>
          </View>
          <View style={styles.changePill}>
            <Ionicons color={colors.success} name="arrow-down" size={15} />
            <Text style={styles.changeText}>1,5 kg</Text>
          </View>
        </View>
        <WeightChart />
        <View style={styles.chartLabels}>
          <Text style={styles.chartLabel}>1. Aug.</Text>
          <Text style={styles.chartLabel}>30. Aug.</Text>
        </View>
      </Card>

      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <IconCircle name="flame-outline" size={38} tone="neutral" />
          <Text style={styles.statValue}>6 / 7</Text>
          <Text style={styles.statLabel}>Tage im Plan</Text>
        </Card>
        <Card style={styles.statCard}>
          <IconCircle name="barbell-outline" size={38} tone="neutral" />
          <Text style={styles.statValue}>131 g</Text>
          <Text style={styles.statLabel}>Ø Protein</Text>
        </Card>
        <Card style={styles.statCard}>
          <IconCircle name="camera-outline" size={38} tone="neutral" />
          <Text style={styles.statValue}>18</Text>
          <Text style={styles.statLabel}>Mahlzeiten</Text>
        </Card>
      </View>

      <View style={styles.section}>
        <SectionTitle>Einblick der Woche</SectionTitle>
        <Card style={styles.insightCard}>
          <View style={styles.insightIcon}>
            <Ionicons color={colors.text} name="sparkles" size={24} />
          </View>
          <View style={styles.insightCopy}>
            <Text style={styles.insightTitle}>Deine Nachmittage wurden leichter</Text>
            <Text style={styles.insightText}>Mit mindestens 35 g Protein mittags liegt dein Abendessen häufiger im Zielbereich. Behalte dieses Muster bei.</Text>
          </View>
        </Card>
      </View>

      <View style={styles.section}>
        <SectionTitle>Beständigkeit</SectionTitle>
        <Card style={styles.consistencyCard}>
          <View style={styles.days}>
            {['M', 'D', 'M', 'D', 'F', 'S', 'S'].map((day, index) => (
              <View key={`${day}-${index}`} style={styles.dayBlock}>
                <View style={[styles.dayCircle, index < 6 && styles.dayComplete, index === 6 && styles.dayToday]}>
                  {index < 6 ? <Ionicons color={colors.text} name="checkmark" size={16} /> : <Text style={styles.dayDot}>•</Text>}
                </View>
                <Text style={styles.dayLabel}>{day}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.consistencyText}>Keine perfekte Serie nötig. Sechs hilfreiche Tage schlagen einen perfekten Tag.</Text>
        </Card>
      </View>
    </Screen>
  );
}

function WeightChart() {
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  return (
    <View style={styles.chart}>
      {[0, 1, 2].map((line) => <View key={line} style={[styles.gridLine, { top: `${line * 45 + 5}%` }]} />)}
      <View style={styles.bars}>
        {weights.map((weight, index) => {
          const normalized = (weight - min) / (max - min || 1);
          const height = 34 + normalized * 68;
          return (
            <View key={index} style={styles.barColumn}>
              <View style={[styles.bar, index === weights.length - 1 && styles.lastBar, { height }]} />
              {index === weights.length - 1 ? <View style={styles.lastDot} /> : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  headerCopy: { flex: 1, gap: 8 },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  weightCard: { padding: 22 },
  weightTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardLabel: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  currentWeight: { color: colors.text, fontSize: 42, lineHeight: 49, fontWeight: '700', letterSpacing: -1.4, marginTop: 4, fontVariant: ['tabular-nums'] },
  kg: { fontSize: 17, fontWeight: '600', letterSpacing: 0 },
  changePill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.successSoft, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 7 },
  changeText: { color: colors.success, fontSize: 12, fontWeight: '700' },
  chart: { height: 150, marginTop: 18, overflow: 'hidden' },
  gridLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: colors.border },
  bars: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 3 },
  barColumn: { width: 26, height: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: 8, borderRadius: 4, backgroundColor: colors.border },
  lastBar: { backgroundColor: colors.accentDeep },
  lastDot: { position: 'absolute', bottom: 30, width: 16, height: 16, borderRadius: 8, backgroundColor: colors.accentDeep, borderWidth: 4, borderColor: colors.surface },
  chartLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 7 },
  chartLabel: { color: colors.muted, fontSize: 10 },
  statsRow: { flexDirection: 'row', gap: 9 },
  statCard: { flex: 1, padding: 13, borderRadius: 20, gap: 6 },
  statValue: { color: colors.text, fontSize: 17, fontWeight: '700', marginTop: 4, fontVariant: ['tabular-nums'] },
  statLabel: { color: colors.muted, fontSize: 10, lineHeight: 14 },
  section: { gap: 13 },
  insightCard: { flexDirection: 'row', gap: 14, backgroundColor: colors.accentSoft, borderColor: colors.accent },
  insightIcon: { width: 46, height: 46, borderRadius: 17, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  insightCopy: { flex: 1, gap: 7 },
  insightTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  insightText: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  consistencyCard: { gap: 18 },
  days: { flexDirection: 'row', justifyContent: 'space-between' },
  dayBlock: { alignItems: 'center', gap: 7 },
  dayCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  dayComplete: { backgroundColor: colors.accent },
  dayToday: { borderWidth: 1.5, borderColor: colors.accentDeep },
  dayDot: { color: colors.accentDeep, fontSize: 20, marginTop: -5 },
  dayLabel: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  consistencyText: { color: colors.muted, fontSize: 12, lineHeight: 18 },
});
