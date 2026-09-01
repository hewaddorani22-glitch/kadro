import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, Eyebrow, IconCircle, PageTitle, PrimaryButton, Screen, SectionTitle } from '@/components/ui';
import { colors, radii } from '@/constants/theme';
import { useApp } from '@/context/AppContext';
import { localDateKey } from '@/utils/date';

const germanDay = new Intl.DateTimeFormat('de-DE', { weekday: 'narrow' });
const germanDate = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short' });

export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const { addWeightEntry, mealHistory, profile, weightEntries } = useApp();
  const [showWeightEntry, setShowWeightEntry] = useState(false);
  const [weightInput, setWeightInput] = useState(String(profile.weightKg).replace('.', ','));
  const [weightError, setWeightError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const thirtyDaysAgo = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - 29);
    return localDateKey(date);
  }, []);
  const visibleWeights = weightEntries.filter((entry) => entry.date >= thirtyDaysAgo);
  const visibleMeals = mealHistory.filter((meal) => (meal.date ?? '') >= thirtyDaysAgo);
  const currentWeight = visibleWeights.at(-1)?.weightKg ?? profile.weightKg;
  const weightChange = visibleWeights.length > 1 ? currentWeight - visibleWeights[0].weightKg : 0;

  const lastSevenDays = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const key = localDateKey(date);
    return {
      key,
      label: germanDay.format(date),
      complete: mealHistory.some((meal) => meal.date === key),
      today: index === 6,
    };
  }), [mealHistory]);
  const trackedDays = lastSevenDays.filter((day) => day.complete).length;
  const mealsByDay = visibleMeals.reduce<Record<string, number>>((days, meal) => {
    const date = meal.date ?? 'unknown';
    days[date] = (days[date] ?? 0) + meal.protein;
    return days;
  }, {});
  const proteinDays = Object.values(mealsByDay);
  const averageProtein = proteinDays.length
    ? Math.round(proteinDays.reduce((sum, value) => sum + value, 0) / proteinDays.length)
    : 0;

  const openWeightEntry = () => {
    setWeightInput(String(currentWeight).replace('.', ','));
    setWeightError(null);
    setShowWeightEntry(true);
  };

  const saveWeight = async () => {
    const value = Number(weightInput.replace(',', '.'));
    if (!Number.isFinite(value) || value < 35 || value > 350) {
      setWeightError('Bitte gib ein Gewicht zwischen 35 und 350 kg ein.');
      return;
    }
    setSaving(true);
    try {
      await addWeightEntry(value);
      setShowWeightEntry(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Eyebrow>Letzte 30 Tage</Eyebrow>
          <PageTitle>Leiser Fortschritt summiert sich.</PageTitle>
          <Text style={styles.subtitle}>Der Trend zählt mehr als eine einzelne Mahlzeit oder Messung.</Text>
        </View>
        <IconCircle name="trending-up" size={48} />
      </View>

      <Card style={styles.weightCard}>
        <View style={styles.weightTop}>
          <View>
            <Text style={styles.cardLabel}>AKTUELLES GEWICHT</Text>
            <Text style={styles.currentWeight}>{currentWeight.toFixed(1).replace('.', ',')}<Text style={styles.kg}> kg</Text></Text>
          </View>
          {visibleWeights.length > 1 ? (
            <View style={[styles.changePill, weightChange > 0 && styles.changePillAttention]}>
              <Ionicons color={weightChange > 0 ? colors.attention : colors.success} name={weightChange > 0 ? 'arrow-up' : weightChange < 0 ? 'arrow-down' : 'remove'} size={15} />
              <Text style={[styles.changeText, weightChange > 0 && styles.changeTextAttention]}>{Math.abs(weightChange).toFixed(1).replace('.', ',')} kg</Text>
            </View>
          ) : (
            <View style={styles.firstPill}><Text style={styles.firstPillText}>ERSTER WERT</Text></View>
          )}
        </View>
        <WeightChart entries={visibleWeights} />
        <View style={styles.chartLabels}>
          <Text style={styles.chartLabel}>{visibleWeights.length ? germanDate.format(new Date(`${visibleWeights[0].date}T12:00:00`)) : 'Heute'}</Text>
          <Text style={styles.chartLabel}>{visibleWeights.length ? germanDate.format(new Date(`${visibleWeights.at(-1)?.date}T12:00:00`)) : 'Heute'}</Text>
        </View>
        <PrimaryButton icon="add" label="Heutiges Gewicht eintragen" onPress={openWeightEntry} variant="secondary" />
      </Card>

      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <IconCircle name="flame-outline" size={38} tone="neutral" />
          <Text style={styles.statValue}>{trackedDays} / 7</Text>
          <Text style={styles.statLabel}>Tage erfasst</Text>
        </Card>
        <Card style={styles.statCard}>
          <IconCircle name="barbell-outline" size={38} tone="neutral" />
          <Text style={styles.statValue}>{averageProtein} g</Text>
          <Text style={styles.statLabel}>Ø Protein</Text>
        </Card>
        <Card style={styles.statCard}>
          <IconCircle name="camera-outline" size={38} tone="neutral" />
          <Text style={styles.statValue}>{visibleMeals.length}</Text>
          <Text style={styles.statLabel}>Mahlzeiten</Text>
        </Card>
      </View>

      <View style={styles.section}>
        <SectionTitle>Einblick</SectionTitle>
        <Card style={styles.insightCard}>
          <View style={styles.insightIcon}>
            <Ionicons color={colors.text} name={visibleMeals.length >= 3 ? 'sparkles' : 'leaf-outline'} size={24} />
          </View>
          <View style={styles.insightCopy}>
            <Text style={styles.insightTitle}>{visibleMeals.length >= 3 ? 'Dein echter Verlauf entsteht' : 'Ohne Druck anfangen'}</Text>
            <Text style={styles.insightText}>
              {visibleMeals.length >= 3
                ? `${visibleMeals.length} erfasste Mahlzeiten ergeben bisher durchschnittlich ${averageProtein} g Protein an protokollierten Tagen.`
                : 'Nach drei erfassten Mahlzeiten zeigt Kandro hier erste Muster – ohne erfundene Bewertungen oder perfekte Serien.'}
            </Text>
          </View>
        </Card>
      </View>

      <View style={styles.section}>
        <SectionTitle>Letzte sieben Tage</SectionTitle>
        <Card style={styles.consistencyCard}>
          <View style={styles.days}>
            {lastSevenDays.map((day) => (
              <View key={day.key} style={styles.dayBlock}>
                <View style={[styles.dayCircle, day.complete && styles.dayComplete, day.today && styles.dayToday]}>
                  {day.complete ? <Ionicons color={colors.text} name="checkmark" size={16} /> : <Text style={styles.dayDot}>•</Text>}
                </View>
                <Text style={styles.dayLabel}>{day.label}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.consistencyText}>Jeder erfasste Tag ist ein Signal, kein Urteil.</Text>
        </Card>
      </View>

      <Modal animationType="fade" onRequestClose={() => setShowWeightEntry(false)} transparent visible={showWeightEntry}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalScrim}>
          <View accessibilityViewIsModal style={[styles.modalCard, { paddingBottom: insets.bottom + 22 }]}>
            <Text accessibilityRole="header" style={styles.modalTitle}>Heutiges Gewicht</Text>
            <Text style={styles.modalText}>Ein Eintrag pro Tag. Ein neuer Wert ersetzt den heutigen.</Text>
            <View style={styles.weightInputRow}>
              <TextInput
                accessibilityLabel="Gewicht in Kilogramm"
                autoFocus
                keyboardType="decimal-pad"
                onChangeText={setWeightInput}
                selectTextOnFocus
                style={styles.weightInput}
                value={weightInput}
              />
              <Text style={styles.weightUnit}>kg</Text>
            </View>
            {weightError ? <Text accessibilityLiveRegion="assertive" style={styles.error}>{weightError}</Text> : null}
            <PrimaryButton disabled={saving} label={saving ? 'Wird gespeichert …' : 'Speichern'} onPress={() => void saveWeight()} />
            <PrimaryButton disabled={saving} label="Abbrechen" onPress={() => setShowWeightEntry(false)} variant="ghost" />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}

function WeightChart({ entries }: { entries: { date: string; weightKg: number }[] }) {
  if (entries.length < 2) {
    return (
      <View style={styles.emptyChart}>
        <Ionicons color={colors.muted} name="analytics-outline" size={24} />
        <Text style={styles.emptyChartText}>Ab der zweiten Messung wird dein Trend sichtbar.</Text>
      </View>
    );
  }
  const shown = entries.slice(-12);
  const min = Math.min(...shown.map((entry) => entry.weightKg));
  const max = Math.max(...shown.map((entry) => entry.weightKg));
  return (
    <View accessibilityLabel={`Gewichtsverlauf mit ${shown.length} Messungen`} style={styles.chart}>
      {[0, 1, 2].map((line) => <View key={line} style={[styles.gridLine, { top: `${line * 45 + 5}%` }]} />)}
      <View style={styles.bars}>
        {shown.map((entry, index) => {
          const normalized = (entry.weightKg - min) / (max - min || 1);
          const height = 34 + normalized * 68;
          return (
            <View key={entry.date} style={styles.barColumn}>
              <View style={[styles.bar, index === shown.length - 1 && styles.lastBar, { height }]}>
                {index === shown.length - 1 ? <View style={styles.lastDot} /> : null}
              </View>
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
  weightCard: { padding: 22, gap: 16 },
  weightTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardLabel: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  currentWeight: { color: colors.text, fontSize: 42, lineHeight: 49, fontWeight: '700', letterSpacing: -1.4, marginTop: 4, fontVariant: ['tabular-nums'] },
  kg: { fontSize: 17, fontWeight: '600', letterSpacing: 0 },
  changePill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.successSoft, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 7 },
  changePillAttention: { backgroundColor: colors.attentionSoft },
  changeText: { color: colors.success, fontSize: 12, fontWeight: '700' },
  changeTextAttention: { color: colors.attention },
  firstPill: { backgroundColor: colors.neutralSoft, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 7 },
  firstPillText: { color: colors.muted, fontSize: 9, fontWeight: '800', letterSpacing: 0.7 },
  chart: { height: 150, overflow: 'hidden' },
  emptyChart: { minHeight: 118, borderRadius: radii.input, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 18 },
  emptyChartText: { color: colors.muted, fontSize: 12, textAlign: 'center' },
  gridLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: colors.border },
  bars: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', paddingHorizontal: 3 },
  barColumn: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: 8, maxWidth: 12, borderRadius: 4, backgroundColor: colors.border },
  lastBar: { backgroundColor: colors.accentDeep },
  lastDot: { position: 'absolute', top: -4, left: -4, width: 16, height: 16, borderRadius: 8, backgroundColor: colors.accentDeep, borderWidth: 4, borderColor: colors.surface },
  chartLabels: { flexDirection: 'row', justifyContent: 'space-between' },
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
  dayDot: { color: colors.muted, fontSize: 18, marginTop: -4 },
  dayLabel: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  consistencyText: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  modalScrim: { flex: 1, backgroundColor: 'rgba(20,21,15,0.42)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: radii.sheet, borderTopRightRadius: radii.sheet, backgroundColor: colors.surface, paddingHorizontal: 22, paddingTop: 22, gap: 13 },
  modalTitle: { color: colors.text, fontSize: 25, fontWeight: '700' },
  modalText: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  weightInputRow: { minHeight: 64, borderRadius: radii.input, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  weightInput: { flex: 1, minWidth: 0, color: colors.text, fontSize: 28, fontWeight: '700', fontVariant: ['tabular-nums'] },
  weightUnit: { color: colors.muted, fontSize: 16, fontWeight: '600' },
  error: { color: colors.attention, fontSize: 12 },
});
