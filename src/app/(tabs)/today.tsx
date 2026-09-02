import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CalorieRing } from '@/components/CalorieRing';
import { MealDetailSheet } from '@/components/MealDetailSheet';
import { Card, Eyebrow, IconCircle, MacroCard, PrimaryButton, Screen, SectionTitle } from '@/components/ui';
import { colors, radii } from '@/constants/theme';
import { useApp } from '@/context/AppContext';
import { Meal } from '@/types/nutrition';
import { useLanguage } from '@/i18n/LanguageProvider';
import { formatNumber, mealTypeIcon, mealTypeLabel } from '@/utils/format';

export default function TodayScreen() {
  const router = useRouter();
  const { consumed, hasLoggedScan, logRepeatMeal, meals, pendingAnalysisCount, remaining, repeatMeals, resetScan, resumeLatestAnalysis, targets, userName } = useApp();
  const [repeating, setRepeating] = useState<string | null>(null);
  const [openMeal, setOpenMeal] = useState<Meal | null>(null);
  const { locale, t } = useLanguage();
  const dateLabel = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'long' }).format(new Date());
  // The greeting was hard-coded to "Guten Morgen", so the app said good morning
  // at 22:00.
  const hour = new Date().getHours();
  const daypart = hour < 11 ? t.today.goodMorning : hour < 18 ? t.today.goodDay : t.today.goodEvening;
  const eveningReady = hour >= 18;
  const greeting = userName.trim() ? `${daypart}, ${userName}` : daypart;
  const calorieCenter = Math.round(Math.min(550, Math.max(380, remaining.calories * 0.38)) / 10) * 10;
  const calorieRange = `${Math.max(300, calorieCenter - 50)}–${calorieCenter + 50}`;
  const proteinCenter = Math.round(Math.min(45, Math.max(28, remaining.protein * 0.48)) / 5) * 5;
  const proteinRange = `${Math.max(20, proteinCenter - 5)}–${proteinCenter + 5}`;

  const startScan = () => {
    resetScan();
    router.push('/(tabs)/scan');
  };

  const resumePending = async () => {
    if (await resumeLatestAnalysis()) router.push('/analyzing');
  };

  // People eat the same things over and over. One tap beats a new scan, costs
  // no analysis call and no waiting.
  const repeat = async (key: string) => {
    const candidate = repeatMeals.find((entry) => entry.key === key);
    if (!candidate || repeating) return;
    setRepeating(key);
    try {
      await logRepeatMeal(candidate);
    } finally {
      setRepeating(null);
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.date}>{dateLabel}</Text>
          <Text style={styles.greeting}>{greeting}</Text>
        </View>
        <Pressable accessibilityLabel={t.common.openProfile} onPress={() => router.push('/(tabs)/profile')} style={styles.avatar}>
          <Text style={styles.avatarText}>{userName.trim().charAt(0).toUpperCase() || 'K'}</Text>
        </Pressable>
      </View>

      {pendingAnalysisCount > 0 ? (
        <Pressable onPress={resumePending} style={styles.pendingBanner}>
          <View style={styles.pendingIcon}><Ionicons color={colors.text} name="cloud-offline-outline" size={19} /></View>
          <View style={styles.pendingCopy}>
            <Text style={styles.pendingTitle}>
              {pendingAnalysisCount === 1 ? t.today.pendingOne : t.today.pendingMany(pendingAnalysisCount)}
            </Text>
            <Text style={styles.pendingText}>{t.today.pendingHint}</Text>
          </View>
          <Ionicons color={colors.text} name="refresh" size={19} />
        </Pressable>
      ) : null}

      <Card style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View>
            <Eyebrow>{t.today.status}</Eyebrow>
            <Text style={styles.onTrack}>
              {consumed.calories > targets.calories
                ? t.today.overToday
                : hasLoggedScan ? t.today.onTrack : t.today.firstMove}
            </Text>
          </View>
        </View>
        <CalorieRing consumed={consumed.calories} proteinReached={targets.protein > 0 && consumed.protein >= targets.protein * 0.9} total={targets.calories} />
        <Text style={styles.consumed}>{formatNumber(consumed.calories, locale)} {t.today.eaten} · {formatNumber(targets.calories, locale)} {t.today.goal}</Text>
      </Card>

      <View style={styles.macroRow}>
        <MacroCard current={consumed.protein} icon="barbell-outline" label={t.common.protein} target={targets.protein} />
        <MacroCard current={consumed.carbs} icon="flash-outline" label={t.common.carbs} target={targets.carbs} />
        <MacroCard current={consumed.fat} icon="water-outline" label={t.common.fat} target={targets.fat} />
      </View>

      <Card style={styles.nextCard}>
        <View style={styles.nextHeader}>
          <IconCircle name="navigate" size={48} />
          <View style={styles.nextHeading}>
            <Eyebrow>{t.today.nextMove}</Eyebrow>
            <Text style={styles.mealMoment}>{hasLoggedScan ? t.today.nextMeal : t.today.firstMeal}</Text>
          </View>
          <Ionicons color={colors.text} name="arrow-forward" size={22} />
        </View>
        <View style={styles.targetRow}>
          <View style={styles.targetBlock}>
            <Text style={styles.targetLabel}>{t.today.targetRange}</Text>
            <Text style={styles.targetValue}>{calorieRange} kcal</Text>
          </View>
          <View style={styles.targetDivider} />
          <View style={styles.targetBlock}>
            <Text style={styles.targetLabel}>{t.today.proteinLabel}</Text>
            <Text style={styles.targetValue}>{proteinRange} g</Text>
          </View>
        </View>
        <PrimaryButton icon="arrow-forward" label={t.today.showIdeas} onPress={() => router.push('/(tabs)/plan')} variant="secondary" />
      </Card>

      {repeatMeals.length ? (
        <View style={styles.sectionBlock}>
          <SectionTitle>{t.today.eatAgain}</SectionTitle>
          <ScrollView
            contentContainerStyle={styles.repeatRow}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.repeatScroll}
          >
            {repeatMeals.map((candidate) => (
              <Pressable
                accessibilityLabel={t.common.repeatLabel(candidate.title)}
                accessibilityRole="button"
                accessibilityState={{ disabled: repeating !== null }}
                disabled={repeating !== null}
                key={candidate.key}
                onPress={() => void repeat(candidate.key)}
                style={({ pressed }) => [styles.repeatCard, pressed && styles.repeatPressed, repeating === candidate.key && styles.repeatBusy]}
              >
                <View style={styles.repeatTop}>
                  <Ionicons color={colors.text} name="refresh" size={15} />
                  {candidate.count > 1 ? <Text style={styles.repeatCount}>{candidate.count}×</Text> : null}
                </View>
                <Text numberOfLines={2} style={styles.repeatTitle}>{candidate.title}</Text>
                <Text style={styles.repeatMacros}>~{candidate.calories} kcal · {candidate.protein} g P</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.sectionBlock}>
        <SectionTitle>{t.today.heading}</SectionTitle>
        <Card style={styles.timelineCard}>
          {meals.map((meal, index) => (
            <View key={meal.id}>
              <Pressable
                accessibilityHint={t.common.mealHint}
                accessibilityLabel={t.common.mealLabel(mealTypeLabel(meal.type, t.common), meal.title, meal.calories)}
                accessibilityRole="button"
                onPress={() => setOpenMeal(meal)}
                style={({ pressed }) => [styles.mealRow, pressed && styles.mealRowPressed]}
              >
                <View style={styles.mealIcon}>
                  <Ionicons color={colors.text} name={mealTypeIcon(meal.type)} size={20} />
                </View>
                <View style={styles.mealInfo}>
                  <View style={styles.mealMetaRow}>
                    <Text style={styles.mealType}>{mealTypeLabel(meal.type, t.common)}</Text>
                    {/* The time lived in the data all along and was never shown, so
                        three meals logged in one evening looked identical. */}
                    <Text style={styles.mealTime}>{meal.time}</Text>
                  </View>
                  <Text numberOfLines={1} style={styles.mealName}>{meal.title}</Text>
                </View>
                <View style={styles.mealNumbers}>
                  <Text style={styles.mealCalories}>~{meal.calories}</Text>
                  <Text style={styles.mealUnit}>kcal</Text>
                </View>
                <Ionicons color={colors.muted} name="chevron-forward" size={16} />
              </Pressable>
              {index < meals.length - 1 ? <View style={styles.rowDivider} /> : null}
            </View>
          ))}
          <Pressable onPress={startScan} style={styles.addMealRow}>
            <View style={styles.addIcon}>
              <Ionicons color={colors.text} name="add" size={20} />
            </View>
            <Text style={styles.addMealText}>{hasLoggedScan ? t.today.scanAnother : t.today.scanFirst}</Text>
            <Ionicons color={colors.muted} name="chevron-forward" size={18} />
          </Pressable>
        </Card>
      </View>

      {eveningReady ? (
        <Pressable accessibilityRole="button" onPress={() => router.push('/evening')} style={styles.eveningRow}>
          <View style={styles.eveningIcon}><Ionicons color={colors.text} name="moon-outline" size={19} /></View>
          <View style={styles.eveningCopy}>
            <Text style={styles.eveningTitle}>{t.today.eveningTitle}</Text>
            <Text style={styles.eveningText}>{t.today.eveningText}</Text>
          </View>
          <Ionicons color={colors.muted} name="chevron-forward" size={18} />
        </Pressable>
      ) : null}

      <MealDetailSheet meal={openMeal} onClose={() => setOpenMeal(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  // The greeting has to yield to the avatar: "Good afternoon, <name>" is far
  // longer than "Guten Tag" and ran underneath it.
  headerCopy: { flex: 1, paddingRight: 12 },
  date: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  greeting: { color: colors.text, fontSize: 28, lineHeight: 35, fontWeight: '700', letterSpacing: -0.8, marginTop: 5 },
  avatar: { width: 44, height: 44, flexShrink: 0, borderRadius: 22, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.white, fontSize: 15, fontWeight: '800' },
  pendingBanner: { minHeight: 66, borderRadius: radii.card, backgroundColor: colors.attentionSoft, borderWidth: 1, borderColor: colors.attention, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 11 },
  pendingIcon: { width: 38, height: 38, borderRadius: 14, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  pendingCopy: { flex: 1, gap: 2 },
  pendingTitle: { color: colors.text, fontSize: 13, fontWeight: '700' },
  pendingText: { color: colors.muted, fontSize: 10 },
  heroCard: { gap: 18, paddingVertical: 22 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  onTrack: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 4 },
  consumed: { color: colors.muted, fontSize: 12, textAlign: 'center', fontVariant: ['tabular-nums'] },
  macroRow: { flexDirection: 'row', gap: 9 },
  nextCard: { backgroundColor: colors.accentSoft, borderColor: colors.accent, gap: 18 },
  nextHeader: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  nextHeading: { flex: 1, gap: 4 },
  mealMoment: { color: colors.text, fontSize: 23, fontWeight: '700' },
  targetRow: { flexDirection: 'row', alignItems: 'center' },
  targetBlock: { flex: 1, gap: 5 },
  targetLabel: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  targetValue: { color: colors.text, fontSize: 18, fontWeight: '700' },
  targetDivider: { width: 1, height: 42, backgroundColor: colors.accent, marginHorizontal: 14 },
  sectionBlock: { gap: 14 },
  timelineCard: { padding: 8 },
  mealRow: { minHeight: 72, borderRadius: 14, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, gap: 12 },
  mealRowPressed: { backgroundColor: colors.background },
  mealIcon: { width: 44, height: 44, borderRadius: 16, backgroundColor: colors.attentionSoft, alignItems: 'center', justifyContent: 'center' },
  mealIconLunch: { backgroundColor: colors.neutralSoft },
  mealInfo: { flex: 1, gap: 3 },
  mealMetaRow: { flexDirection: 'row', alignItems: 'baseline', gap: 7 },
  mealType: { color: colors.text, fontSize: 15, fontWeight: '700' },
  mealTime: { color: colors.muted, fontSize: 11, fontVariant: ['tabular-nums'] },
  mealName: { color: colors.muted, fontSize: 12 },
  mealNumbers: { alignItems: 'flex-end' },
  mealCalories: { color: colors.text, fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  mealUnit: { color: colors.muted, fontSize: 10 },
  rowDivider: { height: 1, backgroundColor: colors.border, marginLeft: 64 },
  addMealRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, gap: 12 },
  addIcon: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
  addMealText: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '600' },
  repeatScroll: { marginHorizontal: -20 },
  repeatRow: { paddingHorizontal: 20, gap: 10 },
  repeatCard: { width: 148, minHeight: 104, borderRadius: radii.card, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 13, justifyContent: 'space-between' },
  repeatPressed: { backgroundColor: colors.neutralSoft, transform: [{ scale: 0.98 }] },
  repeatBusy: { opacity: 0.5 },
  repeatTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  repeatCount: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  repeatTitle: { color: colors.text, fontSize: 13, fontWeight: '600', lineHeight: 17, marginTop: 6 },
  repeatMacros: { color: colors.muted, fontSize: 10, marginTop: 4, fontVariant: ['tabular-nums'] },
  eveningRow: { minHeight: 66, borderRadius: radii.card, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  eveningIcon: { width: 40, height: 40, borderRadius: 15, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  eveningCopy: { flex: 1, minWidth: 0, gap: 2 },
  eveningTitle: { color: colors.text, fontSize: 14, fontWeight: '600' },
  eveningText: { color: colors.muted, fontSize: 11 },
});
