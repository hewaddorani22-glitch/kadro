import { useTheme, useThemedStyles } from '@/context/ThemeContext';
import type { ThemeColors } from '@/constants/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, Eyebrow, IconCircle, PageTitle, PrimaryButton, Screen } from '@/components/ui';
import { radii } from '@/constants/theme';
import { useApp } from '@/context/AppContext';
import { hasRecipe } from '@/services/recipes';
import { useSubscription } from '@/context/SubscriptionContext';
import { recordRecommendationFeedback, recordRecommendationSet } from '@/services/cloudRepository';
import { recommendMeals } from '@/services/recommendations';
import { trackEvent } from '@/services/telemetry';
import { useLanguage } from '@/i18n/LanguageProvider';
import { MealContext, MealSuggestion, PortionFactor } from '@/types/nutrition';
import { formatNumber } from '@/utils/format';
import { selectionHaptic, successHaptic } from '@/services/haptics';


export default function PlanScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const params = useLocalSearchParams<{ context?: string; fromScan?: string }>();
  const router = useRouter();
  const { freeScansLeft, hasLoggedScan, logPlannedMeal, profile, remaining } = useApp();
  const { language, locale, t } = useLanguage();
  const contexts: { id: MealContext; title: string; detail: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { id: 'home', title: t.plan.ctxHome, detail: t.plan.ctxHomeDetail, icon: 'home-outline' },
    { id: 'supermarket', title: t.plan.ctxMarket, detail: t.plan.ctxMarketDetail, icon: 'basket-outline' },
    { id: 'eating-out', title: t.plan.ctxOut, detail: t.plan.ctxOutDetail, icon: 'restaurant-outline' },
  ];
  const { status: subscriptionStatus } = useSubscription();
  const [selected, setSelected] = useState<MealContext | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [portion, setPortion] = useState<PortionFactor>(1);
  const [logging, setLogging] = useState(false);
  const [loggedTitle, setLoggedTitle] = useState<string | null>(null);
  const recordedSet = useRef('');

  useEffect(() => {
    if (params.context && contexts.some((context) => context.id === params.context)) {
      setSelected(params.context as MealContext);
    }
  }, [params.context]);

  // Nothing left to spend means nothing sensible to suggest; a "300–400 kcal"
  // idea under a "0 kcal left" line is advice arguing with its own headline.
  const dayIsDone = remaining.calories < 150;
  const suggestions = useMemo(
    () => (selected && !dayIsDone ? recommendMeals(selected, remaining, profile.preferences) : []),
    // `language` picks the catalogue, and it arrives one render after the
    // device guess.
    [dayIsDone, language, profile.preferences, remaining, selected],
  );
  const calorieCenter = Math.round(Math.min(550, Math.max(380, remaining.calories * 0.38)) / 10) * 10;
  const proteinCenter = Math.round(Math.min(45, Math.max(28, remaining.protein * 0.48)) / 5) * 5;

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
    void selectionHaptic();
    setSelected(context);
    setChosen(null);
  };

  const chooseMeal = (id: string) => {
    void selectionHaptic();
    if (selected && chosen !== id) {
      const rank = suggestions.findIndex((suggestion) => suggestion.id === id) + 1;
      if (rank >= 1 && rank <= 3) {
        trackEvent('recommendation selected', { meal_context: selected, rank: rank as 1 | 2 | 3 });
      }
      if (chosen && chosen !== id) void recordRecommendationFeedback(selected, chosen, 'rejected').catch(() => undefined);
      void recordRecommendationFeedback(selected, id, 'accepted').catch(() => undefined);
    }
    setChosen((current) => (current === id ? null : id));
    setPortion(1);
  };

  /**
   * Choosing a suggestion used to set local state and nothing else: no entry,
   * no calories, no change to the day. The one thing the whole product promises
   * is that the day re-plans after every meal, so this is where it happens.
   */
  const paywallTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (paywallTimer.current) clearTimeout(paywallTimer.current);
  }, []);

  const logMeal = async (suggestion: MealSuggestion) => {
    if (logging) return;
    setLogging(true);
    try {
      await logPlannedMeal(suggestion, portion);
      void successHaptic();
      trackEvent('meal saved', { next_destination: 'today' });
      setLoggedTitle(suggestion.title);
      setChosen(null);
      // The paywall belongs after the value, never between choosing and eating.
      if (params.fromScan === '1' && subscriptionStatus !== 'active' && freeScansLeft === 0) {
        paywallTimer.current = setTimeout(() => router.push('/paywall?reason=after-meal'), 900);
      }
    } finally {
      setLogging(false);
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Eyebrow>{t.plan.eyebrow}</Eyebrow>
          <PageTitle>{t.plan.title}</PageTitle>
          <Text style={styles.subtitle}>{t.plan.subtitle}</Text>
        </View>
        <IconCircle name="sparkles" size={48} />
      </View>

      <Card style={styles.balanceCard}>
        <View>
          <Text style={styles.balanceLabel}>{t.plan.afterMeals}</Text>
          <Text style={styles.balanceValue}>{t.plan.kcalLeft(formatNumber(remaining.calories, locale))}</Text>
        </View>
        <View style={styles.proteinPill}>
          <Ionicons color={colors.success} name="barbell-outline" size={16} />
          <Text style={styles.proteinText}>{t.plan.proteinLeft(remaining.protein)}</Text>
        </View>
      </Card>

      <View style={styles.contextList}>
        {contexts.map((context) => {
          const active = selected === context.id;
          return (
            <Pressable aria-checked={active} accessibilityRole="radio" accessibilityState={{ checked: active }} key={context.id} onPress={() => chooseContext(context.id)} style={[styles.contextCard, active && styles.contextActive]}>
              <IconCircle name={context.icon} size={52} tone={active ? 'accent' : 'neutral'} />
              <View style={styles.contextCopy}>
                <Text style={styles.contextTitle}>{context.title}</Text>
                <Text style={styles.contextDetail}>{context.detail}</Text>
              </View>
              <View style={[styles.chevron, active && styles.chevronActive]}>
                <Ionicons color={active ? colors.onAccent : colors.text} name={active ? 'checkmark' : 'arrow-forward'} size={19} />
              </View>
            </Pressable>
          );
        })}
      </View>

      {selected ? (
        <View style={styles.results}>
          {loggedTitle ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/(tabs)/today')}
              style={styles.loggedBanner}
            >
              <View style={styles.loggedIcon}><Ionicons color={colors.text} name="checkmark" size={18} /></View>
              <View style={styles.loggedCopy}>
                <Text style={styles.loggedTitle}>{t.plan.loggedTitle(loggedTitle)}</Text>
                <Text style={styles.loggedText}>
                  {t.plan.loggedText(formatNumber(remaining.calories, locale), remaining.protein)}
                </Text>
              </View>
              <Ionicons color={colors.text} name="chevron-forward" size={18} />
            </Pressable>
          ) : null}

          {dayIsDone ? (
            <Card style={styles.dayDone}>
              <IconCircle name="checkmark" size={48} tone="accent" />
              <Text style={styles.dayDoneTitle}>{t.plan.dayDoneTitle}</Text>
              <Text style={styles.dayDoneText}>{t.plan.dayDoneText}</Text>
              <PrimaryButton icon="arrow-back" label={t.plan.backToToday} onPress={() => router.push('/(tabs)/today')} variant="secondary" />
            </Card>
          ) : null}

          {dayIsDone ? null : (
          <View style={styles.resultsHeading}>
            <View>
              <Text style={styles.resultsTitle}>{t.plan.optionsTitle}</Text>
              <Text style={styles.resultsMeta}>{t.plan.optionsMeta(`${Math.max(300, calorieCenter - 50)}–${calorieCenter + 50}`, `${Math.max(20, proteinCenter - 5)}–${proteinCenter + 5}`)}</Text>
            </View>
            <Ionicons color={colors.accentText} name="checkmark-done" size={24} />
          </View>
          )}

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
                  <Text numberOfLines={2} style={styles.time}>{suggestion.time}</Text>
                </View>
                <View style={styles.nutritionRow}>
                  <NutritionStat label="kcal" value={`~${suggestion.calories}`} />
                  <NutritionStat label={t.common.protein} value={`~${suggestion.protein} g`} />
                  <NutritionStat label={t.common.carbs} value={`~${suggestion.carbs} g`} />
                </View>
                <PrimaryButton
                  icon={isChosen ? 'chevron-up' : 'arrow-forward'}
                  label={isChosen ? t.plan.dropIt : t.plan.take}
                  onPress={() => chooseMeal(suggestion.id)}
                  variant={isChosen ? 'ghost' : 'secondary'}
                />
                {/*
                  Picking a dish used to end here, which leaves the reader with
                  the question they actually had: how do I make this.
                */}
                {hasRecipe(suggestion.id) ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => router.push(`/recipe?id=${suggestion.id}` as never)}
                    style={styles.recipeLink}
                  >
                    <Ionicons color={colors.accentText} name="book-outline" size={18} />
                    <Text style={styles.recipeLinkText}>{t.recipe.open}</Text>
                    <Ionicons color={colors.muted} name="chevron-forward" size={16} />
                  </Pressable>
                ) : null}
                {isChosen ? (
                  <View style={styles.portionBlock}>
                    <Text style={styles.portionLabel}>{t.plan.howMuch}</Text>
                    <View style={styles.portionSelector}>
                      {([
                        { factor: 0.7 as PortionFactor, label: t.confirm.less, multiplier: `${formatNumber(0.7, locale)}×` },
                        { factor: 1 as PortionFactor, label: t.plan.normal, multiplier: '1×' },
                        { factor: 1.4 as PortionFactor, label: t.confirm.more, multiplier: `${formatNumber(1.4, locale)}×` },
                      ]).map((choice) => {
                        const active = portion === choice.factor;
                        return (
                          <Pressable
                            aria-checked={active}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: active }}
                            key={choice.label}
                            onPress={() => { void selectionHaptic(); setPortion(choice.factor); }}
                            style={[styles.portionChoice, active && styles.portionChoiceActive]}
                          >
                            <Text style={[styles.portionChoiceLabel, active && styles.portionChoiceActiveText]}>{choice.label}</Text>
                            <Text style={[styles.portionMultiplier, active && styles.portionChoiceActiveText]}>{choice.multiplier}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    <Text style={styles.portionResult}>
                      ~{Math.round(suggestion.calories * portion)} kcal · ~{Math.round(suggestion.protein * portion)} g {t.common.protein}
                    </Text>
                    <PrimaryButton
                      disabled={logging}
                      icon="checkmark"
                      label={logging ? t.plan.logging : t.plan.logIt}
                      onPress={() => void logMeal(suggestion)}
                    />
                  </View>
                ) : null}
              </Card>
            );
          })}

          {dayIsDone ? null : (
            <Text style={styles.catalogNote}>
              {t.plan.catalogNote}
            </Text>
          )}

          {hasLoggedScan && params.fromScan !== '1' && subscriptionStatus !== 'active' ? (
            <Pressable accessibilityRole="button" onPress={() => router.push('/paywall')} style={styles.proBanner}>
              <View style={styles.proIcon}><Ionicons color={colors.white} name="infinite" size={20} /></View>
              <View style={styles.proCopy}>
                <Text style={styles.proTitle}>{t.plan.proTitle}</Text>
                <Text style={styles.proText}>{t.plan.proText}</Text>
              </View>
              <Ionicons color={colors.text} name="chevron-forward" size={20} />
            </Pressable>
          ) : null}
        </View>
      ) : (
        <View style={styles.hint}>
          <Ionicons color={colors.muted} name="arrow-up" size={20} />
          <Text style={styles.hintText}>{t.plan.hint}</Text>
        </View>
      )}
    </Screen>
  );
}

function NutritionStat({ label, value }: { label: string; value: number | string }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.nutritionStat}>
      <Text style={styles.nutritionValue}>{value}</Text>
      <Text style={styles.nutritionLabel}>{label}</Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  headerCopy: { flex: 1, gap: 8 },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  balanceCard: { backgroundColor: colors.camera, borderColor: colors.camera, alignItems: 'flex-start', gap: 12 },
  balanceLabel: { color: 'rgba(255,255,255,0.62)', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  balanceValue: { color: colors.white, fontSize: 21, fontWeight: '700', marginTop: 5, fontVariant: ['tabular-nums'] },
  proteinPill: { alignSelf: 'flex-start', backgroundColor: 'rgba(187,220,142,0.14)', borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 5 },
  proteinText: { color: colors.accent, fontSize: 11, fontWeight: '700' },
  contextList: { gap: 11 },
  contextCard: { minHeight: 84, borderRadius: radii.card, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 14 },
  contextActive: { backgroundColor: colors.neutralSoft, borderColor: colors.accentText },
  contextCopy: { flex: 1, gap: 4 },
  contextTitle: { color: colors.text, fontSize: 17, fontWeight: '600' },
  contextDetail: { color: colors.muted, fontSize: 13 },
  chevron: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  chevronActive: { backgroundColor: colors.accent },
  recipeLink: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  recipeLinkText: { color: colors.accentText, fontSize: 14, fontWeight: '700' },
  dayDone: { alignItems: 'center', gap: 12 },
  dayDoneTitle: { color: colors.text, fontSize: 19, fontWeight: '700' },
  dayDoneText: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  results: { gap: 13 },
  resultsHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  resultsTitle: { color: colors.text, fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  resultsMeta: { color: colors.muted, fontSize: 12, marginTop: 4 },
  suggestion: { gap: 17 },
  suggestionChosen: { borderColor: colors.accentText, backgroundColor: colors.accentSoft },
  suggestionTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  rank: { width: 34, height: 34, borderRadius: 12, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  rankText: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  suggestionCopy: { flex: 1, minWidth: 0, gap: 4 },
  suggestionTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  suggestionDetail: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  source: { color: colors.muted, fontSize: 9, marginTop: 2 },
  time: { flexShrink: 0, maxWidth: 92, color: colors.accentText, fontSize: 11, fontWeight: '600', textAlign: 'right' },
  nutritionRow: { flexDirection: 'row', backgroundColor: colors.background, borderRadius: 16, paddingVertical: 10 },
  nutritionStat: { flex: 1, alignItems: 'center', gap: 2 },
  nutritionValue: { color: colors.text, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  nutritionLabel: { color: colors.muted, fontSize: 10 },
  portionBlock: { gap: 10, marginTop: 2 },
  portionLabel: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  portionSelector: { flexDirection: 'row', borderRadius: radii.input, backgroundColor: colors.background, padding: 4, gap: 4 },
  portionChoice: { flex: 1, minWidth: 0, minHeight: 48, borderRadius: 11, alignItems: 'center', justifyContent: 'center', gap: 2 },
  portionChoiceActive: { backgroundColor: colors.accent },
  portionChoiceLabel: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  portionChoiceActiveText: { color: colors.onAccent },
  portionMultiplier: { color: colors.muted, fontSize: 10, fontVariant: ['tabular-nums'] },
  portionResult: { color: colors.text, fontSize: 13, fontWeight: '700', textAlign: 'center', fontVariant: ['tabular-nums'] },
  loggedBanner: { minHeight: 66, borderRadius: radii.card, backgroundColor: colors.accentSoft, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  loggedIcon: { width: 34, height: 34, borderRadius: 13, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  loggedCopy: { flex: 1, minWidth: 0, gap: 2 },
  loggedTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  loggedText: { color: colors.text, fontSize: 11, opacity: 0.75, lineHeight: 15 },
  catalogNote: { color: colors.muted, fontSize: 10, lineHeight: 15, textAlign: 'center', paddingHorizontal: 12 },
  hint: { alignItems: 'center', gap: 8, paddingVertical: 14 },
  hintText: { color: colors.muted, fontSize: 13 },
  proBanner: { minHeight: 78, borderRadius: radii.card, backgroundColor: colors.accentSoft, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12 },
  proIcon: { width: 42, height: 42, borderRadius: 16, backgroundColor: colors.camera, alignItems: 'center', justifyContent: 'center' },
  proCopy: { flex: 1, gap: 3 },
  proTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  proText: { color: colors.text, fontSize: 11, opacity: 0.7 },
});
