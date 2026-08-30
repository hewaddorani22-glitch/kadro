import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, Eyebrow, IconCircle, PageTitle, PrimaryButton, Screen } from '@/components/ui';
import { colors, radii } from '@/constants/theme';
import { useApp } from '@/context/AppContext';
import { SUGGESTIONS } from '@/services/mockNutrition';
import { MealContext } from '@/types/nutrition';

const contexts: { id: MealContext; title: string; detail: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'home', title: 'At home', detail: 'Using normal ingredients', icon: 'home-outline' },
  { id: 'supermarket', title: 'Supermarket', detail: 'Something I can buy now', icon: 'basket-outline' },
  { id: 'eating-out', title: 'Eating out', detail: 'Restaurant or takeaway', icon: 'restaurant-outline' },
];

export default function PlanScreen() {
  const params = useLocalSearchParams<{ context?: string; fromScan?: string }>();
  const router = useRouter();
  const { hasLoggedScan, remaining } = useApp();
  const [selected, setSelected] = useState<MealContext | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);

  useEffect(() => {
    if (params.context && contexts.some((context) => context.id === params.context)) {
      setSelected(params.context as MealContext);
    }
  }, [params.context]);

  const suggestions = useMemo(() => (selected ? SUGGESTIONS[selected] : []), [selected]);

  const chooseContext = (context: MealContext) => {
    void Haptics.selectionAsync();
    setSelected(context);
    setChosen(null);
  };

  const chooseMeal = (id: string) => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setChosen(id);
    if (params.fromScan === '1') {
      setTimeout(() => router.push('/paywall'), 350);
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Eyebrow>Nutrition Autopilot</Eyebrow>
          <PageTitle>What works right now?</PageTitle>
          <Text style={styles.subtitle}>Choose the situation. We’ll fit the food to the day you actually had.</Text>
        </View>
        <IconCircle name="sparkles" size={48} />
      </View>

      <Card style={styles.balanceCard}>
        <View>
          <Text style={styles.balanceLabel}>AFTER TODAY’S MEALS</Text>
          <Text style={styles.balanceValue}>{remaining.calories.toLocaleString('en-US')} kcal left</Text>
        </View>
        <View style={styles.proteinPill}>
          <Ionicons color={colors.success} name="barbell-outline" size={16} />
          <Text style={styles.proteinText}>{remaining.protein} g protein left</Text>
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
              <Text style={styles.resultsTitle}>3 options that fit today</Text>
              <Text style={styles.resultsMeta}>Target · 450–550 kcal · 35–45 g protein</Text>
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
                  label={isChosen ? 'Good choice' : 'Choose'}
                  onPress={() => chooseMeal(suggestion.id)}
                  variant={isChosen ? 'primary' : 'secondary'}
                />
              </Card>
            );
          })}

          {hasLoggedScan && params.fromScan !== '1' ? (
            <Pressable onPress={() => router.push('/paywall')} style={styles.proBanner}>
              <View style={styles.proIcon}><Ionicons color={colors.white} name="infinite" size={20} /></View>
              <View style={styles.proCopy}>
                <Text style={styles.proTitle}>Keep Autopilot running</Text>
                <Text style={styles.proText}>Unlock unlimited scans and replanning.</Text>
              </View>
              <Ionicons color={colors.text} name="chevron-forward" size={20} />
            </Pressable>
          ) : null}
        </View>
      ) : (
        <View style={styles.hint}>
          <Ionicons color={colors.muted} name="arrow-up" size={20} />
          <Text style={styles.hintText}>Pick one to generate three practical ideas.</Text>
        </View>
      )}
    </Screen>
  );
}

function NutritionStat({ label, value }: { label: string; value: number | string }) {
  return (
    <View style={styles.nutritionStat}>
      <Text style={styles.nutritionValue}>{value}</Text>
      <Text style={styles.nutritionLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  headerCopy: { flex: 1, gap: 8 },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  balanceCard: { backgroundColor: colors.text, borderColor: colors.text, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  balanceLabel: { color: 'rgba(255,255,255,0.62)', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  balanceValue: { color: colors.white, fontSize: 21, fontWeight: '700', marginTop: 5 },
  proteinPill: { backgroundColor: 'rgba(183,213,138,0.14)', borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 5 },
  proteinText: { color: colors.accent, fontSize: 11, fontWeight: '700' },
  contextList: { gap: 11 },
  contextCard: { minHeight: 84, borderRadius: radii.card, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 14 },
  contextActive: { backgroundColor: colors.accentSoft, borderColor: colors.accentDeep },
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
  time: { color: colors.accentDeep, fontSize: 11, fontWeight: '700' },
  nutritionRow: { flexDirection: 'row', backgroundColor: colors.background, borderRadius: 16, paddingVertical: 10 },
  nutritionStat: { flex: 1, alignItems: 'center', gap: 2 },
  nutritionValue: { color: colors.text, fontSize: 14, fontWeight: '700' },
  nutritionLabel: { color: colors.muted, fontSize: 10 },
  hint: { alignItems: 'center', gap: 8, paddingVertical: 14 },
  hintText: { color: colors.muted, fontSize: 13 },
  proBanner: { minHeight: 78, borderRadius: radii.card, backgroundColor: colors.accent, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12 },
  proIcon: { width: 42, height: 42, borderRadius: 16, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center' },
  proCopy: { flex: 1, gap: 3 },
  proTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  proText: { color: colors.text, fontSize: 11, opacity: 0.7 },
});
