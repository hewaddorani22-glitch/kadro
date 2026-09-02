import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, Eyebrow, IconCircle, PageTitle, PrimaryButton, Screen, SectionTitle } from '@/components/ui';
import { colors, radii } from '@/constants/theme';
import { useApp } from '@/context/AppContext';
import { useLanguage } from '@/i18n/LanguageProvider';
import { proteinConsistency } from '@/services/consistency';
import { localDateKey } from '@/utils/date';
import { formatWeight, kgToStoneParts, parseStoneInput, parseWeightInput, weightInputUnit, weightInputValue } from '@/utils/units';



export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const { locale, t } = useLanguage();
  const { addWeightEntry, mealHistory, profile, targets, weightEntries } = useApp();
  const [showWeightEntry, setShowWeightEntry] = useState(false);
  const units = profile.unitSystem;
  const [weightInput, setWeightInput] = useState(() => weightInputValue(profile.weightKg, units, locale));
  // Nobody says "13.2 stone", so the UK entry is two fields rather than one.
  const [stoneInput, setStoneInput] = useState(() => String(kgToStoneParts(profile.weightKg).stone));
  const [stonePounds, setStonePounds] = useState(() => String(kgToStoneParts(profile.weightKg).pounds));
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

  const consistency = useMemo(
    () => proteinConsistency(mealHistory, targets.protein),
    [mealHistory, targets.protein],
  );
  const { averageProtein, loggedCount: trackedDays, reachedCount } = consistency;
  const showsScore = trackedDays >= 3;

  const openWeightEntry = () => {
    setWeightInput(weightInputValue(currentWeight, units, locale));
    const parts = kgToStoneParts(currentWeight);
    setStoneInput(String(parts.stone));
    setStonePounds(String(parts.pounds));
    setWeightError(null);
    setShowWeightEntry(true);
  };

  const saveWeight = async () => {
    // Parsed back into kilograms: the entry is stored metric whatever the
    // user typed, so switching units never rewrites their history.
    const value = units === 'uk'
      ? parseStoneInput(stoneInput, stonePounds)
      : parseWeightInput(weightInput, units);
    if (value === null) {
      setWeightError(t.progress.weightError);
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
          <Eyebrow>{t.progress.eyebrow}</Eyebrow>
          <PageTitle>{t.progress.title}</PageTitle>
        </View>
        <IconCircle name="trending-up" size={48} />
      </View>

      {/* Protein is the thing this audience controls day to day; weight swings on
          water and inverts when someone is building. It leads for a reason. */}
      <Card style={styles.consistencyHero}>
        {/* A ratio needs enough days to mean anything. Scoring someone "0 von 1"
            on their first day is a verdict on a single data point, and this app
            does not do verdicts. Below three tracked days the average leads. */}
        <Text style={styles.heroLabel}>{showsScore ? t.progress.proteinReached : t.progress.proteinAverage}</Text>
        <View style={styles.heroValueRow}>
          {showsScore ? (
            <>
              <Text style={styles.heroValue}>{reachedCount}</Text>
              <Text style={styles.heroOf}>{t.progress.outOfTracked(trackedDays)}</Text>
            </>
          ) : (
            <>
              <Text style={styles.heroValue}>{trackedDays > 0 ? averageProtein : targets.protein}</Text>
              <Text style={styles.heroOf}>{trackedDays > 0 ? t.progress.goalSuffix(targets.protein) : t.progress.perDayGoal}</Text>
            </>
          )}
        </View>
        <View style={styles.strip}>
          {consistency.days.map((day) => (
            <View key={day.key} style={styles.stripDay}>
              <View style={styles.stripTrack}>
                <View
                  style={[
                    styles.stripFill,
                    { height: `${Math.max(6, Math.round((day.ratio / 1.2) * 100))}%` },
                    day.logged && styles.stripFillLogged,
                    day.reached && styles.stripFillReached,
                  ]}
                />
              </View>
              <Text style={[styles.stripLabel, day.today && styles.stripLabelToday]}>{day.label}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.heroFoot}>
          {showsScore
            ? t.progress.footScored(averageProtein, targets.protein)
            : trackedDays > 0
              ? t.progress.footBuilding(trackedDays)
              : t.progress.footEmpty}
        </Text>
      </Card>

      <Card style={styles.weightCard}>
        <View style={styles.weightTop}>
          <View>
            <Text style={styles.cardLabel}>{t.progress.currentWeight}</Text>
            <Text style={styles.currentWeight}>{formatWeight(currentWeight, units, locale)}</Text>
          </View>
          {visibleWeights.length > 1 ? (
            <View style={[styles.changePill, weightChange > 0 && styles.changePillAttention]}>
              <Ionicons color={weightChange > 0 ? colors.attention : colors.success} name={weightChange > 0 ? 'arrow-up' : weightChange < 0 ? 'arrow-down' : 'remove'} size={15} />
              <Text style={[styles.changeText, weightChange > 0 && styles.changeTextAttention]}>{formatWeight(Math.abs(weightChange), units, locale)}</Text>
            </View>
          ) : (
            <View style={styles.firstPill}><Text style={styles.firstPillText}>{t.progress.firstValue}</Text></View>
          )}
        </View>
        <WeightChart entries={visibleWeights} />
        {visibleWeights.length > 1 ? (
          <View style={styles.chartLabels}>
            <Text style={styles.chartLabel}>{new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(new Date(`${visibleWeights[0].date}T12:00:00`))}</Text>
            <Text style={styles.chartLabel}>{new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(new Date(`${visibleWeights.at(-1)?.date}T12:00:00`))}</Text>
          </View>
        ) : null}
        <PrimaryButton icon="add" label={t.progress.logWeight} onPress={openWeightEntry} variant="secondary" />
      </Card>

      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <IconCircle name="flame-outline" size={38} tone="neutral" />
          <Text style={styles.statValue}>{trackedDays} / 7</Text>
          <Text style={styles.statLabel}>{t.progress.daysTracked}</Text>
        </Card>
        <Card style={styles.statCard}>
          <IconCircle name="barbell-outline" size={38} tone="neutral" />
          <Text style={styles.statValue}>{averageProtein} g</Text>
          <Text style={styles.statLabel}>{t.progress.avgProtein}</Text>
        </Card>
        <Card style={styles.statCard}>
          <IconCircle name="camera-outline" size={38} tone="neutral" />
          <Text style={styles.statValue}>{visibleMeals.length}</Text>
          <Text style={styles.statLabel}>{t.progress.meals}</Text>
        </Card>
      </View>

      <View style={styles.section}>
        <SectionTitle>{t.progress.insight}</SectionTitle>
        <Card style={styles.insightCard}>
          <View style={styles.insightIcon}>
            <Ionicons color={colors.text} name={visibleMeals.length >= 3 ? 'sparkles' : 'leaf-outline'} size={24} />
          </View>
          <View style={styles.insightCopy}>
            <Text style={styles.insightTitle}>{visibleMeals.length >= 3 ? t.progress.insightBuilding : t.progress.insightStart}</Text>
            <Text style={styles.insightText}>
              {visibleMeals.length >= 3
                ? t.progress.insightBuildingText(visibleMeals.length, averageProtein)
                : t.progress.insightStartText}
            </Text>
          </View>
        </Card>
      </View>

      <Modal animationType="fade" onRequestClose={() => setShowWeightEntry(false)} transparent visible={showWeightEntry}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalScrim}>
          <View accessibilityViewIsModal style={[styles.modalCard, { paddingBottom: insets.bottom + 22 }]}>
            <Text accessibilityRole="header" style={styles.modalTitle}>{t.progress.weightModalTitle}</Text>
            <Text style={styles.modalText}>{t.progress.weightModalText}</Text>
            {units === 'uk' ? (
              <View style={styles.weightInputRow}>
                <TextInput
                  accessibilityLabel={`${t.progress.weightLabel} — stone`}
                  autoFocus
                  keyboardType="number-pad"
                  onChangeText={setStoneInput}
                  selectTextOnFocus
                  style={[styles.weightInput, styles.weightInputSplit]}
                  value={stoneInput}
                />
                <Text style={styles.weightUnit}>st</Text>
                <TextInput
                  accessibilityLabel={`${t.progress.weightLabel} — pounds`}
                  keyboardType="decimal-pad"
                  onChangeText={setStonePounds}
                  selectTextOnFocus
                  style={[styles.weightInput, styles.weightInputSplit]}
                  value={stonePounds}
                />
                <Text style={styles.weightUnit}>lb</Text>
              </View>
            ) : (
              <View style={styles.weightInputRow}>
                <TextInput
                  accessibilityLabel={t.progress.weightLabel}
                  autoFocus
                  keyboardType="decimal-pad"
                  onChangeText={setWeightInput}
                  selectTextOnFocus
                  style={styles.weightInput}
                  value={weightInput}
                />
                <Text style={styles.weightUnit}>{weightInputUnit(units)}</Text>
              </View>
            )}
            {weightError ? <Text accessibilityLiveRegion="assertive" style={styles.error}>{weightError}</Text> : null}
            <PrimaryButton disabled={saving} label={saving ? t.common.saving : t.common.save} onPress={() => void saveWeight()} />
            <PrimaryButton disabled={saving} label={t.common.cancel} onPress={() => setShowWeightEntry(false)} variant="ghost" />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}

function WeightChart({ entries }: { entries: { date: string; weightKg: number }[] }) {
  const { t } = useLanguage();
  if (entries.length < 2) {
    return (
      <View style={styles.emptyChart}>
        <Ionicons color={colors.muted} name="analytics-outline" size={24} />
        <Text style={styles.emptyChartText}>{t.progress.emptyChart}</Text>
      </View>
    );
  }
  const shown = entries.slice(-12);
  const min = Math.min(...shown.map((entry) => entry.weightKg));
  const max = Math.max(...shown.map((entry) => entry.weightKg));
  return (
    <View accessibilityLabel={t.progress.weightChartLabel(shown.length)} style={styles.chart}>
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
  consistencyHero: { padding: 20, gap: 14 },
  heroLabel: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  heroValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  heroValue: { color: colors.text, fontSize: 46, lineHeight: 50, fontWeight: '700', letterSpacing: -1.6, fontVariant: ['tabular-nums'] },
  heroOf: { color: colors.muted, fontSize: 15 },
  strip: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  stripDay: { flex: 1, minWidth: 0, alignItems: 'center', gap: 6 },
  stripTrack: { width: '100%', height: 64, borderRadius: 8, backgroundColor: colors.neutralSoft, justifyContent: 'flex-end', overflow: 'hidden' },
  // Three readable states: untouched, tracked, target reached.
  stripFill: { width: '100%', borderRadius: 8, backgroundColor: colors.border },
  stripFillLogged: { backgroundColor: colors.accent },
  stripFillReached: { backgroundColor: colors.accentDeep },
  stripLabel: { color: colors.muted, fontSize: 10, fontWeight: '600' },
  stripLabelToday: { color: colors.text, fontWeight: '800' },
  heroFoot: { color: colors.muted, fontSize: 11, lineHeight: 16, fontVariant: ['tabular-nums'] },
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
  modalScrim: { flex: 1, backgroundColor: 'rgba(20,21,15,0.42)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: radii.sheet, borderTopRightRadius: radii.sheet, backgroundColor: colors.surface, paddingHorizontal: 22, paddingTop: 22, gap: 13 },
  modalTitle: { color: colors.text, fontSize: 25, fontWeight: '700' },
  modalText: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  weightInputRow: { minHeight: 64, borderRadius: radii.input, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  weightInputSplit: { minWidth: 76, flex: 0 },
  weightInput: { flex: 1, minWidth: 0, color: colors.text, fontSize: 28, fontWeight: '700', fontVariant: ['tabular-nums'] },
  weightUnit: { color: colors.muted, fontSize: 16, fontWeight: '600' },
  error: { color: colors.attention, fontSize: 12 },
});
