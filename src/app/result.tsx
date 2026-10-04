import { useTheme, useThemedStyles } from '@/context/ThemeContext';
import type { ThemeColors } from '@/constants/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, Share, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { mealPhotoPlaceholder } from '@/utils/format';
import { Card, ConfidenceBadge, Eyebrow, MealPhoto, PrimaryButton, Screen, SectionTitle } from '@/components/ui';
import { radii } from '@/constants/theme';
import { useApp } from '@/context/AppContext';
import { recommendationPreview } from '@/services/recommendations';
import { projectMealForDay } from '@/services/mockNutrition';
import { useLanguage } from '@/i18n/LanguageProvider';
import { trackEvent } from '@/services/telemetry';
import { formatNumber } from '@/utils/format';

export default function ResultScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { fontScale, width } = useWindowDimensions();
  const largeText = fontScale > 1.3;
  const calorieSize = largeText ? Math.min(width - 40, Math.ceil(122 * fontScale)) : 122;
  const { descriptionInput, lifetimeScanCount, logScannedMeal, meals, photoUri, profile, scanMode, scannedMeal, targets } = useApp();
  const preview = projectMealForDay(targets, meals, scannedMeal);
  const projected = preview.remaining;
  const startingRemaining = preview.before.calories;
  const dayIsDone = projected.calories < 200;
  // getRemaining() clamps at zero, so the projected values alone can never tell
  // us whether the day went over budget.
  const projectedCalories = preview.consumed.calories;
  const overBudget = projectedCalories > targets.calories;
  const overBy = Math.max(0, projectedCalories - targets.calories);
  const mealProgress = useRef(new Animated.Value(0)).current;
  const remainingProgress = useRef(new Animated.Value(0)).current;
  const recommendationReveal = useRef(new Animated.Value(0)).current;
  const savedOnArrival = useRef(false);
  const saveInFlight = useRef<Promise<boolean> | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saving' | 'saved' | 'failed'>('saving');
  const revealDone = useRef(false);
  const { language, locale, t } = useLanguage();
  const nextMeal = useMemo(() => recommendationPreview(projected, profile.preferences),
    [language, profile.preferences, projected.calories, projected.protein, projected.carbs, projected.fat]);
  const [calorieLow, calorieHigh] = nextMeal.calories;
  const [proteinLow, proteinHigh] = nextMeal.protein;
  const [displayedCalories, setDisplayedCalories] = useState(0);
  const [displayedRemaining, setDisplayedRemaining] = useState(startingRemaining);

  // The example meal demonstrates the flow; it must never enter the real diary.
  const demo = scanMode === 'demo';
  const saveCurrentMeal = useCallback((): Promise<boolean> => {
    if (demo) return Promise.resolve(true);
    if (saveInFlight.current) return saveInFlight.current;
    setSaveStatus('saving');
    const operation = logScannedMeal().then(() => {
      setSaveStatus('saved');
      return true;
    }).catch(() => {
      setSaveStatus('failed');
      return false;
    }).finally(() => { saveInFlight.current = null; });
    saveInFlight.current = operation;
    return operation;
  }, [demo, logScannedMeal]);

  useEffect(() => {
    if (savedOnArrival.current) return;
    savedOnArrival.current = true;
    void saveCurrentMeal();
  }, [saveCurrentMeal]);

  // The numbers the reveal counts towards, read through refs so that logging
  // the meal: which changes `projected` a moment after arrival: cannot tear
  // the animation down and restart it from zero. It used to take 2.4 seconds
  // to show the figure, and sometimes never got there at all.
  const targetsRef = useRef({ calories: 0, startingRemaining: 0, projected: 0 });
  targetsRef.current = {
    calories: scannedMeal.calories,
    startingRemaining,
    projected: projected.calories,
  };

  useEffect(() => {
    const mealListener = mealProgress.addListener(({ value }) => {
      setDisplayedCalories(Math.round(targetsRef.current.calories * value));
    });
    const remainingListener = remainingProgress.addListener(({ value }) => {
      const { startingRemaining: from, projected: to } = targetsRef.current;
      setDisplayedRemaining(Math.round(from + (to - from) * value));
    });
    let cancelled = false;

    void AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (cancelled) return;
      if (reduceMotion) {
        mealProgress.setValue(1);
        remainingProgress.setValue(1);
        recommendationReveal.setValue(1);
        revealDone.current = true;
        return;
      }

      Animated.sequence([
        Animated.timing(mealProgress, {
          duration: 700,
          easing: Easing.bezier(0.22, 1, 0.36, 1),
          toValue: 1,
          useNativeDriver: false,
        }),
        Animated.delay(400),
        Animated.timing(remainingProgress, {
          duration: 650,
          easing: Easing.bezier(0.22, 1, 0.36, 1),
          toValue: 1,
          useNativeDriver: false,
        }),
        Animated.timing(recommendationReveal, {
          duration: 300,
          easing: Easing.out(Easing.cubic),
          toValue: 1,
          useNativeDriver: false,
        }),
      ]).start(() => {
        revealDone.current = true;
      });
    });

    return () => {
      cancelled = true;
      mealProgress.removeListener(mealListener);
      remainingProgress.removeListener(remainingListener);
      mealProgress.stopAnimation();
      remainingProgress.stopAnimation();
      recommendationReveal.stopAnimation();
    };
    // Deliberately mount-only: these are stable Animated refs, and every other
    // input is read live from targetsRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mealProgress, recommendationReveal, remainingProgress]);

  // Once the reveal has finished the listener stops firing, so a later
  // correction to the meal would keep showing the old figure.
  useEffect(() => {
    if (!revealDone.current) return;
    setDisplayedCalories(scannedMeal.calories);
    setDisplayedRemaining(projected.calories);
  }, [projected.calories, scannedMeal.calories]);

  const showOptions = async () => {
    // Always write: logScannedMeal upserts by scan id, so leaving after an edit
    // persists the correction instead of discarding it. The free-scan counter
    // is guarded separately and does not double-count.
    if (!await saveCurrentMeal()) return;
    trackEvent('result continued', { next_destination: 'recommendations' });
    router.dismissTo({ pathname: '/(tabs)/plan', params: { context: 'home', fromScan: '1' } });
  };

  const saveForLater = async () => {
    if (!await saveCurrentMeal()) return;
    trackEvent('result continued', { next_destination: 'today' });
    router.dismissTo('/(tabs)/today');
  };

  const shareResult = async () => {
    await Share.share({
      message: `${scannedMeal.title}: ~${formatNumber(scannedMeal.calories, locale)} kcal · ${scannedMeal.protein} g ${t.common.protein} · ${scannedMeal.carbs} g ${t.common.carbs} · ${scannedMeal.fat} g ${t.common.fat}. Kandro.`,
      title: t.result.shareTitle,
    });
  };

  const ingredientEditAction = (
    <Pressable accessibilityRole="button" onPress={() => router.replace('/confirm')}>
      <Text style={styles.edit}>{t.result.edit}</Text>
    </Pressable>
  );

  return (
    <Screen>
      <View style={styles.topBar}>
        <Pressable accessibilityLabel={t.common.back} accessibilityRole="button" hitSlop={8} onPress={() => router.back()} style={styles.iconButton}>
          <Ionicons color={colors.text} name="arrow-back" size={22} />
        </Pressable>
        <Text style={styles.topTitle}>{t.result.title}</Text>
        <Pressable accessibilityLabel={t.result.share} accessibilityRole="button" hitSlop={8} onPress={() => void shareResult()} style={styles.iconButton}>
          <Ionicons color={colors.text} name="share-outline" size={21} />
        </Pressable>
      </View>

      {saveStatus === 'failed' ? <Card>
        <Text accessibilityRole="alert" style={{ color: colors.attention }}>{t.result.saveFailed}</Text>
        <PrimaryButton label={t.result.retrySave} onPress={() => void saveCurrentMeal()} />
      </Card> : null}
      {demo ? <Text accessibilityLiveRegion="polite" style={{ color: colors.muted }}>{t.result.demoNotSaved}</Text>
        : saveStatus === 'saving' ? <Text accessibilityLiveRegion="polite" style={{ color: colors.muted }}>{t.common.saving}</Text> : null}

      <MealPhoto height={270} description={scanMode === 'description' ? descriptionInput : undefined} placeholder={mealPhotoPlaceholder(scanMode)} uri={photoUri} />

      <View style={styles.resultHeading}>
        <View style={[styles.titleRow, largeText && styles.titleRowLarge]}>
          <View style={[styles.mealCopy, largeText && styles.mealCopyLarge]}>
            <Text style={styles.mealTitle}>{scannedMeal.title}</Text>
            <ConfidenceBadge uncertain={scannedMeal.confidence === 'medium'} />
          </View>
          <View style={[styles.calorieBlock, { width: calorieSize, height: calorieSize }]}>
            <ImpactRing size={calorieSize} total={scannedMeal.calories} value={displayedCalories} />
            <View style={styles.calorieCenter}>
              <Text style={styles.calories}>~{formatNumber(displayedCalories, locale)}</Text>
              <Text style={styles.calorieLabel}>{t.result.estimated}</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.macros}>
        <MacroResult label={t.common.protein} value={scannedMeal.protein} unit="g" />
        <MacroResult label={t.common.carbs} value={scannedMeal.carbs} unit="g" />
        <MacroResult label={t.common.fat} value={scannedMeal.fat} unit="g" />
        <MacroResult label={t.common.fiber} value={scannedMeal.fiber ?? 0} unit="g" />
      </View>

      <View style={styles.section}>
        <SectionTitle action={largeText ? undefined : ingredientEditAction}>{t.result.ingredients}</SectionTitle>
        {largeText ? ingredientEditAction : null}
        <Card style={styles.ingredientsCard}>
          {scannedMeal.items.filter((item) => item.included).map((item, index, list) => (
            <View key={item.id}>
              <View style={styles.ingredientRow}>
                <View style={styles.ingredientCheck}><Ionicons color={colors.success} name="checkmark" size={15} /></View>
                <Text style={styles.ingredientName}>{item.name}</Text>
                <View style={styles.ingredientMeta}>
                  <Text style={styles.ingredientAmount}>{formatNumber(item.amountG, locale)} g</Text>
                  <Text style={styles.ingredientSource}>{item.source.label}</Text>
                </View>
              </View>
              {index < list.length - 1 ? <View style={styles.divider} /> : null}
            </View>
          ))}
        </Card>
      </View>

      <Card style={styles.dayCard}>
        <View style={styles.dayHeader}>
          <View style={styles.dayIcon}><Ionicons color={colors.onAccent} name="sunny-outline" size={23} /></View>
          <View style={styles.dayHeading}>
            <Eyebrow>{t.result.dayAfter}</Eyebrow>
            <Text style={styles.onTrack}>{overBudget ? t.result.overToday : t.result.stillOnTrack}</Text>
          </View>
          <Ionicons
            color={overBudget ? colors.attention : colors.success}
            name={overBudget ? 'alert-circle' : 'checkmark-circle'}
            size={25}
          />
        </View>
        <View style={styles.remainingRow}>
          <View>
            <Text style={styles.remainingValue}>{formatNumber(overBudget ? overBy : displayedRemaining, locale)}</Text>
            <Text style={styles.remainingLabel}>{overBudget ? t.ring.over : t.ring.left}</Text>
          </View>
          <View style={styles.remainingDivider} />
          <View>
            <Text style={styles.remainingValue}>{projected.protein} g</Text>
            <Text style={styles.remainingLabel}>{t.result.proteinLeft}</Text>
          </View>
        </View>
      </Card>

      <Animated.View
        style={{
          opacity: recommendationReveal,
          transform: [{ translateY: recommendationReveal.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
        }}
      >
      {dayIsDone ? (
        <Card style={styles.nextCard}>
          <Text style={styles.nextTitle}>{overBudget ? t.today.dayOver : t.today.dayComplete}</Text>
          <Text style={styles.remainingLabel}>{overBudget ? t.today.dayOverText : t.today.dayCompleteText}</Text>
          <PrimaryButton icon="arrow-forward" label={t.plan.smallIdeas} onPress={showOptions} variant="secondary" />
        </Card>
      ) : <Card style={styles.nextCard}>
        <View style={styles.nextTop}>
          <View style={styles.nextBadge}><Ionicons color={colors.onAccent} name="navigate" size={20} /></View>
          <View style={styles.nextCopy}>
            <Eyebrow>{t.result.nextMeal}</Eyebrow>
            <Text style={styles.nextTitle}>{t.result.nextMealTitle}</Text>
          </View>
        </View>
        <View style={styles.aimRow}>
          <View style={styles.aimBlock}>
            <Text style={styles.aimValue}>{calorieLow === calorieHigh ? calorieLow : `${calorieLow}–${calorieHigh}`}</Text>
            <Text style={styles.aimLabel}>{t.onboarding.kilocalories}</Text>
          </View>
          <View style={styles.aimBlock}>
            <Text style={styles.aimValue}>{proteinLow === proteinHigh ? proteinLow : `${proteinLow}–${proteinHigh}`} g</Text>
            <Text style={styles.aimLabel}>{t.common.protein}</Text>
          </View>
          <View style={styles.aimBlock}>
            <Text style={styles.aimValue}>{t.result.light}</Text>
            <Text style={styles.aimLabel}>{t.result.lightOnFat}</Text>
          </View>
        </View>
        <PrimaryButton icon="arrow-forward" label={t.result.showOptions} onPress={showOptions} />
      </Card>}
      </Animated.View>

      <PrimaryButton icon="checkmark" label={t.result.toToday} onPress={saveForLater} variant="secondary" />
      <Text style={styles.estimateNote}>{t.common.estimateNote}</Text>
    </Screen>
  );
}

function ImpactRing({ size, total, value }: { size: number; total: number; value: number }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const stroke = 7;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = total > 0 ? Math.min(1, Math.max(0, value / total)) : 0;
  const dashOffset = circumference * (1 - progress);

  return (
    <Svg height={size} style={styles.impactRing} width={size}>
      <Circle cx={size / 2} cy={size / 2} fill="none" r={radius} stroke={colors.neutralSoft} strokeWidth={stroke} />
      <Circle
        cx={size / 2}
        cy={size / 2}
        fill="none"
        r={radius}
        stroke={colors.accent}
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        strokeWidth={stroke}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}

function MacroResult({ label, unit, value }: { label: string; unit: string; value: number }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.macroResult}>
      <Text style={styles.macroValue}>{value}<Text style={styles.macroUnit}> {unit}</Text></Text>
      <Text style={styles.macroLabel}>{label}</Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  topTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  resultHeading: { gap: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  titleRowLarge: { flexDirection: 'column' },
  mealCopy: { flex: 1, gap: 10 },
  mealCopyLarge: { flex: 0, width: '100%' },
  mealTitle: { color: colors.text, fontSize: 29, lineHeight: 34, fontWeight: '700', letterSpacing: -0.8 },
  calorieBlock: { alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  impactRing: { position: 'absolute', top: 0, left: 0 },
  calorieCenter: { maxWidth: '100%', alignItems: 'center' },
  calories: { color: colors.text, fontSize: 25, lineHeight: 30, fontWeight: '700', letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
  calorieLabel: { color: colors.muted, fontSize: 10, textAlign: 'center' },
  macros: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radii.card, borderWidth: 1, borderColor: colors.border, paddingVertical: 15 },
  macroResult: { flex: 1, alignItems: 'center', gap: 4 },
  macroValue: { color: colors.text, fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] },
  macroUnit: { fontSize: 11, fontWeight: '600' },
  macroLabel: { color: colors.muted, fontSize: 10 },
  section: { gap: 13 },
  edit: { color: colors.accentText, fontSize: 13, fontWeight: '700' },
  ingredientsCard: { padding: 8 },
  ingredientRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, gap: 10 },
  ingredientCheck: { width: 28, height: 28, borderRadius: 10, backgroundColor: colors.successSoft, alignItems: 'center', justifyContent: 'center' },
  ingredientName: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '600' },
  ingredientMeta: { alignItems: 'flex-end', gap: 2 },
  ingredientAmount: { color: colors.muted, fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
  ingredientSource: { color: colors.muted, fontSize: 8 },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: 46 },
  dayCard: { backgroundColor: colors.camera, borderColor: colors.camera, gap: 19 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  dayIcon: { width: 44, height: 44, borderRadius: 16, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  dayHeading: { flex: 1, gap: 4 },
  onTrack: { color: colors.white, fontSize: 18, fontWeight: '700' },
  remainingRow: { flexDirection: 'row', alignItems: 'center' },
  remainingValue: { color: colors.white, fontSize: 25, fontWeight: '700', fontVariant: ['tabular-nums'] },
  remainingLabel: { color: 'rgba(255,255,255,0.54)', fontSize: 10, marginTop: 3 },
  remainingDivider: { width: 1, height: 42, backgroundColor: 'rgba(255,255,255,0.13)', marginHorizontal: 28 },
  nextCard: { backgroundColor: colors.accentSoft, borderColor: colors.accent, gap: 18 },
  nextTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nextBadge: { width: 44, height: 44, borderRadius: 16, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  nextCopy: { flex: 1, gap: 4 },
  nextTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  aimRow: { flexDirection: 'row' },
  aimBlock: { flex: 1, gap: 4 },
  aimValue: { color: colors.text, fontSize: 15, fontWeight: '700' },
  aimLabel: { color: colors.muted, fontSize: 10 },
  reminderCard: { gap: 12 },
  reminderTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  reminderIcon: { width: 42, height: 42, borderRadius: 16, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  reminderCopy: { flex: 1, minWidth: 0, gap: 3 },
  reminderTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  reminderText: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  estimateNote: { color: colors.muted, fontSize: 10, lineHeight: 16, textAlign: 'center', paddingHorizontal: 18 },
});
