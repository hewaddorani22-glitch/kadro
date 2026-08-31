import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, Eyebrow, IconCircle, PageTitle, PrimaryButton, Screen } from '@/components/ui';
import { colors, radii } from '@/constants/theme';
import { useApp } from '@/context/AppContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { recordRecommendationFeedback, recordRecommendationSet } from '@/services/cloudRepository';
import { recommendMeals } from '@/services/recommendations';
import { trackEvent } from '@/services/telemetry';
import { MealContext } from '@/types/nutrition';
import { formatNumber } from '@/utils/format';

const contexts: { id: MealContext; title: string; detail: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'home', title: 'Zuhause', detail: 'Mit dem, was da ist', icon: 'home-outline' },
  { id: 'supermarket', title: 'Supermarkt', detail: 'Rewe, Lidl, Aldi', icon: 'basket-outline' },
  { id: 'eating-out', title: 'Unterwegs', detail: 'Imbiss, Bäcker, Kantine', icon: 'restaurant-outline' },
];

export default function PlanScreen() {
  const params = useLocalSearchParams<{ context?: string; fromScan?: string }>();
  const router = useRouter();
  const { hasLoggedScan, remaining } = useApp();
  const { status: subscriptionStatus } = useSubscription();
  const [selected, setSelected] = useState<MealContext | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const recordedSet = useRef('');

  useEffect(() => {
    if (params.context && contexts.some((context) => context.id === params.context)) {
      setSelected(params.context as MealContext);
    }
  }, [params.context]);

  const suggestions = useMemo(() => (selected ? recommendMeals(selected, remaining) : []), [remaining, selected]);

  useEffect(() => {
    if (!selected || suggestions.length !== 3) return;
    const key = `${selected}:${remaining.calories}:${remaining.protein}:${suggestions.map((suggestion) => suggestion.id).join(',')}`;
    if (recordedSet.current === key) return;
    recordedSet.current = key;
    trackEvent('recommendation set viewed', { meal_context: selected });
    void recordRecommendationSet(selected, remaining, suggestions).catch(() => {
      recordedSet.current = '';
    });
  }, [remaining, selected, suggestions]);

  const chooseContext = (context: MealContext) => {
    void Haptics.selectionAsync();
    setSelected(context);
    setChosen(null);
  };

  const chooseMeal = (id: string) => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (selected && chosen !== id) {
      const rank = suggestions.findIndex((suggestion) => suggestion.id === id) + 1;
      if (rank >= 1 && rank <= 3) {
        trackEvent('recommendation selected', { meal_context: selected, rank: rank as 1 | 2 | 3 });
      }
      if (chosen && chosen !== id) void recordRecommendationFeedback(selected, chosen, 'rejected').catch(() => undefined);
      void recordRecommendationFeedback(selected, id, 'accepted').catch(() => undefined);
    }
    setChosen(id);
    if (params.fromScan === '1' && subscriptionStatus !== 'active') {
      setTimeout(() => router.push('/paywall'), 350);
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Eyebrow>Kadro</Eyebrow>
          <PageTitle>Was passt jetzt?</PageTitle>
          <Text style={styles.subtitle}>Wähle deine Situation. Kadro richtet die Vorschläge an deinem tatsächlichen Tag aus.</Text>
        </View>
        <IconCircle name="sparkles" size={48} />
      </View>

      <Card style={styles.balanceCard}>
        <View>
          <Text style={styles.balanceLabel}>NACH DEN HEUTIGEN MAHLZEITEN</Text>
          <Text style={styles.balanceValue}>{formatNumber(remaining.calories)} kcal übrig</Text>
        </View>
        <View style={styles.proteinPill}>
          <Ionicons color={colors.success} name="barbell-outline" size={16} />
          <Text style={styles.proteinText}>{remaining.protein} g Protein übrig</Text>
        </View>
      </Card>

      <View style={styles.contextList}>
        {contexts.map((context) => {
          const active = selected === context.id;
          return (
            <Pressable key={context.id} onPress={() => chooseContext(context.id)} style={[styles.contextCard, active && styles.contextActive]}>
              <IconCircle name={context.icon} size={52} tone={active ? 'accent' : 'neutral'} />
              <View style={styles.contextCopy}>
                <Text style={styles.contextTitle}>{context.title}</Text>
                <Text style={styles.contextDetail}>{context.detail}</Text>
              </View>
              <View style={[styles.chevron, active && styles.chevronActive]}>
                <Ionicons color={colors.text} name={active ? 'checkmark' : 'arrow-forward'} size={19} />
              </View>
            </Pressable>
          );
        })}
      </View>

      {selected ? (
        <View style={styles.results}>
          <View style={styles.resultsHeading}>
            <View>
              <Text style={styles.resultsTitle}>3 Optionen für heute</Text>
              <Text style={styles.resultsMeta}>Ziel · 450–550 kcal · 35–45 g Protein</Text>
            </View>
            <Ionicons color={colors.accentDeep} name="checkmark-done" size={24} />
          </View>

          {suggestions.map((suggestion, index) => {
            const isChosen = chosen === suggestion.id;
            return (
              <Card key={suggestion.id} style={[styles.suggestion, isChosen && styles.suggestionChosen]}>
                <View style={styles.suggestionTop}>
                  <View style={styles.rank}><Text style={styles.rankText}>0{index + 1}</Text></View>
                  <View style={styles.suggestionCopy}>
                    <Text style={styles.suggestionTitle}>{suggestion.title}</Text>
                    <Text style={styles.suggestionDetail}>{suggestion.detail}</Text>
                    <Text style={styles.source}>{suggestion.source?.label}</Text>
                  </View>
                  <Text style={styles.time}>{suggestion.time}</Text>
                </View>
                <View style={styles.nutritionRow}>
                  <NutritionStat label="kcal" value={suggestion.calories} />
                  <NutritionStat label="protein" value={`${suggestion.protein} g`} />
                  <NutritionStat label="carbs" value={`${suggestion.carbs} g`} />
                </View>
                <PrimaryButton
                  icon={isChosen ? 'checkmark' : 'arrow-forward'}
                  label={isChosen ? 'Ausgewählt' : 'Auswählen'}
                  onPress={() => chooseMeal(suggestion.id)}
                  variant={isChosen ? 'primary' : 'secondary'}
                />
              </Card>
            );
          })}

          {hasLoggedScan && params.fromScan !== '1' && subscriptionStatus !== 'active' ? (
            <Pressable onPress={() => router.push('/paywall')} style={styles.proBanner}>
              <View style={styles.proIcon}><Ionicons color={colors.white} name="infinite" size={20} /></View>
              <View style={styles.proCopy}>
                <Text style={styles.proTitle}>Kadro weiterlaufen lassen</Text>
                <Text style={styles.proText}>Unbegrenzte Scans und neue Aufstellungen freischalten.</Text>
              </View>
              <Ionicons color={colors.text} name="chevron-forward" size={20} />
            </Pressable>
          ) : null}
        </View>
      ) : (
        <View style={styles.hint}>
          <Ionicons color={colors.muted} name="arrow-up" size={20} />
          <Text style={styles.hintText}>Wähle eine Situation für drei praktische Ideen.</Text>
        </View>
      )}
    </Screen>
  );
}

function NutritionStat({ label, value }: { label: string; value: number | string }) {
  return (
    <View style={styles.nutritionStat}>
      <Text style={styles.nutritionValue}>{value}</Text>
      <Text style={styles.nutritionLabel}>{label === 'protein' ? 'Protein' : label === 'carbs' ? 'Kohlenh.' : label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  headerCopy: { flex: 1, gap: 8 },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  balanceCard: { backgroundColor: colors.text, borderColor: colors.text, alignItems: 'flex-start', gap: 12 },
  balanceLabel: { color: 'rgba(255,255,255,0.62)', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  balanceValue: { color: colors.white, fontSize: 21, fontWeight: '700', marginTop: 5, fontVariant: ['tabular-nums'] },
  proteinPill: { alignSelf: 'flex-start', backgroundColor: 'rgba(187,220,142,0.14)', borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 5 },
  proteinText: { color: colors.accent, fontSize: 11, fontWeight: '700' },
  contextList: { gap: 11 },
  contextCard: { minHeight: 84, borderRadius: radii.card, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 14 },
  contextActive: { backgroundColor: colors.neutralSoft, borderColor: colors.accentDeep },
  contextCopy: { flex: 1, gap: 4 },
  contextTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  contextDetail: { color: colors.muted, fontSize: 13 },
  chevron: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  chevronActive: { backgroundColor: colors.accent },
  results: { gap: 13 },
  resultsHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  resultsTitle: { color: colors.text, fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  resultsMeta: { color: colors.muted, fontSize: 12, marginTop: 4 },
  suggestion: { gap: 17 },
  suggestionChosen: { borderColor: colors.accentDeep, backgroundColor: colors.accentSoft },
  suggestionTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  rank: { width: 34, height: 34, borderRadius: 12, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  rankText: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  suggestionCopy: { flex: 1, gap: 4 },
  suggestionTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  suggestionDetail: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  source: { color: colors.muted, fontSize: 9, marginTop: 2 },
  time: { color: colors.accentDeep, fontSize: 11, fontWeight: '700' },
  nutritionRow: { flexDirection: 'row', backgroundColor: colors.background, borderRadius: 16, paddingVertical: 10 },
  nutritionStat: { flex: 1, alignItems: 'center', gap: 2 },
  nutritionValue: { color: colors.text, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  nutritionLabel: { color: colors.muted, fontSize: 10 },
  hint: { alignItems: 'center', gap: 8, paddingVertical: 14 },
  hintText: { color: colors.muted, fontSize: 13 },
  proBanner: { minHeight: 78, borderRadius: radii.card, backgroundColor: colors.accent, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12 },
  proIcon: { width: 42, height: 42, borderRadius: 16, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center' },
  proCopy: { flex: 1, gap: 3 },
  proTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  proText: { color: colors.text, fontSize: 11, opacity: 0.7 },
});
