import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { KandroMark } from '@/components/KandroMark';
import { PrimaryButton, ProgressBar } from '@/components/ui';
import { colors, radii, spacing } from '@/constants/theme';
import { useApp } from '@/context/AppContext';
import { calculateDailyTargets, estimatedPace, isRateLimited, weeklyRateLabel } from '@/services/personalization';
import { trackEvent } from '@/services/telemetry';
import { useLanguage } from '@/i18n/LanguageProvider';
import { NutritionGoal, UserProfile, WeeklyRateKg } from '@/types/nutrition';
import {
  UNIT_SYSTEMS,
  UnitSystem,
  cmToTotalInches,
  defaultUnitSystem,
  formatWeight,
  kgToPounds,
  poundsToKg,
  totalInchesToCm,
  usesMetricHeight,
  usesMetricWeight,
} from '@/utils/units';

type Choice = { label: string; detail: string; icon: keyof typeof Ionicons.glyphMap };


const STEPS = ['goal', 'rate', 'name', 'age', 'height', 'weight', 'activity', 'preferences', 'building', 'plan'] as const;
type StepId = (typeof STEPS)[number];

type Dict = ReturnType<typeof useLanguage>['t'];

function goalChoicesFor(t: Dict): Choice[] {
  return [
    { label: t.onboarding.goalLose, detail: t.onboarding.goalLoseDetail, icon: 'trending-down' },
    { label: t.onboarding.goalMaintain, detail: t.onboarding.goalMaintainDetail, icon: 'remove' },
    { label: t.onboarding.goalGain, detail: t.onboarding.goalGainDetail, icon: 'trending-up' },
  ];
}

function activityChoicesFor(t: Dict): Choice[] {
  return [
    { label: t.onboarding.activityLow, detail: t.onboarding.activityLowDetail, icon: 'desktop-outline' },
    { label: t.onboarding.activityLight, detail: t.onboarding.activityLightDetail, icon: 'walk-outline' },
    { label: t.onboarding.activityHigh, detail: t.onboarding.activityHighDetail, icon: 'barbell-outline' },
  ];
}

function preferenceChoicesFor(t: Dict) {
  return [
    { id: 'high-protein', label: t.onboarding.prefHighProtein },
    { id: 'vegetarian', label: t.onboarding.prefVegetarian },
    { id: 'pork-free', label: t.onboarding.prefPorkFree },
    { id: 'lactose-free', label: t.onboarding.prefLactoseFree },
    { id: 'quick', label: t.onboarding.prefQuick },
  ];
}

function copyFor(t: Dict): Record<StepId, { title: string; subtitle: string }> {
  return {
    goal: { title: t.onboarding.goalTitle, subtitle: t.onboarding.goalSubtitle },
    rate: { title: t.onboarding.rateTitle, subtitle: t.onboarding.rateSubtitle },
    name: { title: t.onboarding.nameTitle, subtitle: t.onboarding.nameSubtitle },
    age: { title: t.onboarding.ageTitle, subtitle: t.onboarding.ageSubtitle },
    height: { title: t.onboarding.heightTitle, subtitle: t.onboarding.heightSubtitle },
    weight: { title: t.onboarding.weightTitle, subtitle: t.onboarding.weightSubtitle },
    activity: { title: t.onboarding.activityTitle, subtitle: t.onboarding.activitySubtitle },
    preferences: { title: t.onboarding.preferencesTitle, subtitle: t.onboarding.preferencesSubtitle },
    building: { title: t.onboarding.buildingTitle, subtitle: t.onboarding.buildingSubtitle },
    plan: { title: t.onboarding.planTitle, subtitle: t.onboarding.planSubtitle },
  };
}

/** Steps the user may leave without answering. Everything else has a safe default. */
const skippableSteps = new Set<StepId>(['name', 'preferences']);

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { completeOnboarding, grantWellnessConsent } = useApp();
  const { locale, t } = useLanguage();
  const copy = copyFor(t);
  const goalChoices = goalChoicesFor(t);
  const activityChoices = activityChoicesFor(t);
  const preferenceChoices = preferenceChoicesFor(t);
  const [stepIndex, setStepIndex] = useState(0);
  const [goal, setGoal] = useState<NutritionGoal>('lose');
  const [displayName, setDisplayName] = useState('');
  // Guessed from the device so most people never touch it, but visible and
  // switchable right on the step where it matters.
  const [unitSystem, setUnitSystem] = useState<UnitSystem>(defaultUnitSystem);
  const [age, setAge] = useState(29);
  const [height, setHeight] = useState(178);
  const [weight, setWeight] = useState(78);
  const [activity, setActivity] = useState<UserProfile['activityLevel']>('light');
  const [weeklyRate, setWeeklyRate] = useState<WeeklyRateKg>(0.5);
  const [preferences, setPreferences] = useState<string[]>(['high-protein']);
  const [showConsent, setShowConsent] = useState(false);
  const [consentBusy, setConsentBusy] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [skippedAnything, setSkippedAnything] = useState(false);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const goalRef = useRef(goal);
  goalRef.current = goal;

  const step = STEPS[stepIndex];

  const clearAdvance = useCallback(() => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = null;
  }, []);

  useEffect(() => clearAdvance, [clearAdvance]);

  const goNext = useCallback(() => {
    clearAdvance();
    setStepIndex((current) => {
      let next = Math.min(STEPS.length - 1, current + 1);
      // Holding weight has no rate to choose.
      if (STEPS[next] === 'rate' && goalRef.current === 'maintain') next += 1;
      return Math.min(STEPS.length - 1, next);
    });
  }, [clearAdvance]);

  const goBack = () => {
    void Haptics.selectionAsync();
    clearAdvance();
    setStepIndex((current) => {
      let previous = Math.max(0, current - 1);
      if (STEPS[previous] === 'rate' && goalRef.current === 'maintain') previous -= 1;
      return Math.max(0, previous);
    });
  };

  // Single-choice steps move on by themselves. The short delay lets the user
  // see their answer land before the screen changes.
  const selectAndAdvance = (apply: () => void) => {
    void Haptics.selectionAsync();
    apply();
    clearAdvance();
    advanceTimer.current = setTimeout(goNext, 220);
  };

  const skipStep = () => {
    setSkippedAnything(true);
    if (step === 'name') setDisplayName('');
    if (step === 'preferences') setPreferences([]);
    goNext();
  };

  // The "building" beat is a deliberate pause before the payoff, not a fake
  // loading bar: it never blocks and always resolves.
  useEffect(() => {
    if (step !== 'building') return;
    const timer = setTimeout(() => setStepIndex((current) => Math.min(STEPS.length - 1, current + 1)), 1500);
    return () => clearTimeout(timer);
  }, [step]);

  const draftProfile = useMemo<UserProfile>(() => ({
    displayName: displayName.trim(),
    unitSystem,
    goal,
    age,
    heightCm: height,
    weightKg: weight,
    activityLevel: activity,
    weeklyRateKg: weeklyRate,
    preferences,
    completedAt: null,
  }), [activity, age, displayName, goal, height, preferences, unitSystem, weeklyRate, weight]);
  const startingTargets = useMemo(() => calculateDailyTargets(draftProfile), [draftProfile]);

  const acceptConsent = async () => {
    setConsentBusy(true);
    setConsentError(null);
    try {
      await grantWellnessConsent();
      await completeOnboarding(draftProfile);
      trackEvent('onboarding completed', { completion: skippedAnything ? 'skipped' : 'finished' });
      setShowConsent(false);
      router.replace('/(tabs)/scan');
    } catch {
      setConsentError(t.onboarding.consentError);
    } finally {
      setConsentBusy(false);
    }
  };

  const primaryAction = () => {
    void Haptics.selectionAsync();
    if (step === 'plan') {
      setShowConsent(true);
      return;
    }
    goNext();
  };

  const showFooterButton = step !== 'building' && !isChoiceStep(step);
  const footerLabel = step === 'plan' ? t.onboarding.scanFirstMeal : t.common.next;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityLabel={t.common.back}
          accessibilityRole="button"
          accessibilityState={{ disabled: stepIndex === 0 }}
          disabled={stepIndex === 0}
          hitSlop={10}
          onPress={goBack}
          style={[styles.backButton, stepIndex === 0 && styles.invisible]}
        >
          <Ionicons color={colors.text} name="arrow-back" size={22} />
        </Pressable>
        <Text style={styles.stepLabel}>{t.onboarding.step(stepIndex + 1, STEPS.length)}</Text>
        {skippableSteps.has(step) ? (
          <Pressable accessibilityRole="button" hitSlop={10} onPress={skipStep}>
            <Text style={styles.skip}>{t.common.skip}</Text>
          </Pressable>
        ) : <View style={styles.skipPlaceholder} />}
      </View>

      <ProgressBar value={(stepIndex + 1) / STEPS.length} />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.flex}
        >
          <View style={styles.headingBlock}>
            {step === 'goal' || step === 'plan' ? (
              <View style={styles.brandMark}><KandroMark size={42} /></View>
            ) : null}
            <Text accessibilityRole="header" style={styles.title}>{copy[step].title}</Text>
            <Text style={styles.subtitle}>{copy[step].subtitle}</Text>
          </View>

          <View style={styles.body}>
            {step === 'goal' ? (
              <ChoiceList choices={goalChoices} onSelect={(value) => selectAndAdvance(() => setGoal(value))} selected={goal} values={['lose', 'maintain', 'gain'] as NutritionGoal[]} />
            ) : null}

            {step === 'rate' ? (
              <View style={styles.rateStep}>
                {/*
                  This is the first screen that shows a unit, so it is the first
                  place the choice has to be available. Without it an American
                  whose phone reports another region read "0.25 kg per week"
                  here and could not correct it until step five.
                */}
                <UnitToggle onChange={setUnitSystem} value={unitSystem} />
                <View style={styles.choiceList}>
                {([0.25, 0.5] as WeeklyRateKg[]).map((rate) => {
                  const active = weeklyRate === rate;
                  const daily = Math.round((rate * 7700) / 7);
                  const applied = draftProfile.goal === 'gain' ? Math.min(350, daily) : daily;
                  return (
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      key={rate}
                      onPress={() => selectAndAdvance(() => setWeeklyRate(rate))}
                      style={({ pressed }) => [styles.choice, active && styles.choiceActive, pressed && styles.choicePressed]}
                    >
                      <View style={[styles.choiceIcon, active && styles.choiceIconActive]}>
                        <Ionicons color={colors.text} name={rate === 0.25 ? 'leaf-outline' : 'flash-outline'} size={22} />
                      </View>
                      <View style={styles.choiceTextBlock}>
                        <Text style={styles.choiceTitle}>{weeklyRateLabel(draftProfile.goal, rate, t.common, unitSystem)}</Text>
                        <Text style={styles.choiceDetail}>
                          {rate === 0.25 ? t.onboarding.rateCalm : t.onboarding.rateBrisk} · {draftProfile.goal === 'lose' ? '−' : '+'}{applied} {t.onboarding.perDay}
                        </Text>
                      </View>
                      <Ionicons color={active ? colors.accentDeep : colors.border} name={active ? 'checkmark-circle' : 'ellipse-outline'} size={24} />
                    </Pressable>
                  );
                })}
                </View>
              </View>
            ) : null}

            {step === 'name' ? (
              <View style={styles.nameField}>
                <TextInput
                  accessibilityLabel={t.onboarding.nameTitle}
                  autoCapitalize="words"
                  autoFocus
                  maxLength={40}
                  onChangeText={setDisplayName}
                  onSubmitEditing={goNext}
                  placeholder={t.onboarding.namePlaceholder}
                  placeholderTextColor={colors.muted}
                  returnKeyType="done"
                  style={styles.nameInput}
                  value={displayName}
                />
              </View>
            ) : null}

            {step === 'age' ? (
              <NumberStep max={80} min={18} onChange={setAge} step={1} unit={t.onboarding.years} value={age} />
            ) : null}
            {step === 'height' ? (
              <View style={styles.unitStep}>
                <UnitToggle onChange={setUnitSystem} value={unitSystem} />
                <View style={styles.unitStepValue}>
                  {usesMetricHeight(unitSystem) ? (
                    <NumberStep max={220} min={130} onChange={setHeight} step={1} unit="cm" value={height} />
                  ) : (
                    <NumberStep
                      format={(inches) => `${Math.floor(inches / 12)}′ ${inches % 12}″`}
                      max={cmToTotalInches(220)}
                      min={cmToTotalInches(130)}
                      onChange={(inches) => setHeight(totalInchesToCm(inches))}
                      step={1}
                      unit=""
                      value={cmToTotalInches(height)}
                    />
                  )}
                </View>
              </View>
            ) : null}
            {step === 'weight' ? (
              <View style={styles.unitStep}>
                <UnitToggle onChange={setUnitSystem} value={unitSystem} />
                <View style={styles.unitStepValue}>
                  {usesMetricWeight(unitSystem) ? (
                    <NumberStep max={200} min={40} onChange={setWeight} step={1} unit="kg" value={weight} />
                  ) : (
                    <NumberStep
                      format={(pounds) => (unitSystem === 'uk'
                        ? formatWeight(poundsToKg(pounds), 'uk', locale)
                        : String(pounds))}
                      max={Math.round(kgToPounds(200))}
                      min={Math.round(kgToPounds(40))}
                      onChange={(pounds) => setWeight(Math.round(poundsToKg(pounds) * 10) / 10)}
                      step={1}
                      unit={unitSystem === 'uk' ? '' : 'lb'}
                      value={Math.round(kgToPounds(weight))}
                    />
                  )}
                </View>
              </View>
            ) : null}

            {step === 'activity' ? (
              <ChoiceList choices={activityChoices} onSelect={(value) => selectAndAdvance(() => setActivity(value))} selected={activity} values={['low', 'light', 'high'] as UserProfile['activityLevel'][]} />
            ) : null}

            {step === 'preferences' ? (
              <View style={styles.chips}>
                {[...preferenceChoices, { id: 'none', label: t.onboarding.prefNone }].map((item) => {
                  const selected = item.id === 'none' ? preferences.length === 0 : preferences.includes(item.id);
                  return (
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                      key={item.id}
                      onPress={() => {
                        void Haptics.selectionAsync();
                        if (item.id === 'none') setPreferences([]);
                        else setPreferences((current) => current.includes(item.id)
                          ? current.filter((entry) => entry !== item.id)
                          : [...current, item.id]);
                      }}
                      style={[styles.chip, selected && styles.chipSelected]}
                    >
                      {selected ? <Ionicons color={colors.text} name="checkmark" size={17} /> : null}
                      <Text style={styles.chipText}>{item.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {step === 'building' ? <BuildingState goal={goalChoices[['lose', 'maintain', 'gain'].indexOf(goal)].label} /> : null}
            {step === 'plan' ? <StartingPlan limited={isRateLimited(draftProfile)} profile={draftProfile} targets={startingTargets} /> : null}
          </View>
        </ScrollView>

        {showFooterButton ? (
          <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
            <PrimaryButton
              icon={step === 'plan' ? 'camera' : 'arrow-forward'}
              label={footerLabel}
              onPress={primaryAction}
            />
          </View>
        ) : null}
      </KeyboardAvoidingView>

      <Modal animationType="fade" onRequestClose={() => setShowConsent(false)} transparent visible={showConsent}>
        <View style={styles.modalScrim}>
          <View accessibilityViewIsModal style={[styles.consentSheet, { paddingBottom: insets.bottom + 18 }]}>
            <View style={styles.consentIcon}><Ionicons color={colors.text} name="shield-checkmark-outline" size={26} /></View>
            <Text accessibilityRole="header" style={styles.consentTitle}>{t.onboarding.consentTitle}</Text>
            <Text style={styles.consentText}>{t.onboarding.consentBody}</Text>
            <View style={styles.consentLinks}>
              <Pressable accessibilityRole="link" onPress={() => { setShowConsent(false); router.push('/privacy'); }}><Text style={styles.consentLink}>{t.onboarding.consentPrivacy}</Text></Pressable>
              <Pressable accessibilityRole="link" onPress={() => { setShowConsent(false); router.push('/terms'); }}><Text style={styles.consentLink}>{t.onboarding.consentTerms}</Text></Pressable>
            </View>
            {consentError ? <Text accessibilityLiveRegion="assertive" style={styles.consentError}>{consentError}</Text> : null}
            <PrimaryButton disabled={consentBusy} icon="checkmark" label={consentBusy ? t.common.moment : t.onboarding.consentAccept} onPress={() => void acceptConsent()} />
            <PrimaryButton disabled={consentBusy} label={t.common.back} onPress={() => setShowConsent(false)} variant="ghost" />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function isChoiceStep(step: StepId) {
  return step === 'goal' || step === 'rate' || step === 'activity';
}

function ChoiceList<T extends string>({ choices, onSelect, selected, values }: { choices: Choice[]; onSelect: (choice: T) => void; selected: T; values: T[] }) {
  return (
    <View style={styles.choiceList}>
      {choices.map((choice, index) => {
        const value = values[index];
        const active = value === selected;
        return (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            key={value}
            onPress={() => onSelect(value)}
            style={({ pressed }) => [styles.choice, active && styles.choiceActive, pressed && styles.choicePressed]}
          >
            <View style={[styles.choiceIcon, active && styles.choiceIconActive]}>
              <Ionicons color={colors.text} name={choice.icon} size={22} />
            </View>
            <View style={styles.choiceTextBlock}>
              <Text style={styles.choiceTitle}>{choice.label}</Text>
              <Text style={styles.choiceDetail}>{choice.detail}</Text>
            </View>
            <Ionicons color={active ? colors.accentDeep : colors.border} name={active ? 'checkmark-circle' : 'ellipse-outline'} size={24} />
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * A tap steps by one, holding accelerates. Without the hold, moving the weight
 * from the default to a real value would cost dozens of taps.
 */
/**
 * Three small pills rather than a settings menu: the moment somebody is asked
 * for their height is the moment they know which unit they think in.
 */
function UnitToggle({ onChange, value }: { onChange: (system: UnitSystem) => void; value: UnitSystem }) {
  const { t } = useLanguage();
  const labels: Record<UnitSystem, string> = {
    metric: t.onboarding.unitMetric,
    us: t.onboarding.unitUs,
    uk: t.onboarding.unitUk,
  };
  return (
    <View style={styles.unitToggle}>
      {UNIT_SYSTEMS.map((system) => {
        const active = system === value;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            key={system}
            onPress={() => { void Haptics.selectionAsync(); onChange(system); }}
            style={[styles.unitOption, active && styles.unitOptionActive]}
          >
            <Text style={[styles.unitLabel, active && styles.unitLabelActive]}>{labels[system]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function NumberStep({ format, max, min, onChange, step, unit, value }: { format?: (value: number) => string; max: number; min: number; onChange: (value: number) => void; step: number; unit: string; value: number }) {
  const { t } = useLanguage();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(value);
  latest.current = value;

  const apply = useCallback((direction: -1 | 1) => {
    const next = Math.min(max, Math.max(min, latest.current + direction * step));
    if (next === latest.current) return;
    latest.current = next;
    onChange(next);
  }, [max, min, onChange, step]);

  const stop = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const start = (direction: -1 | 1) => {
    void Haptics.selectionAsync();
    apply(direction);
    let delay = 340;
    const tick = () => {
      apply(direction);
      delay = Math.max(40, delay * 0.8);
      timer.current = setTimeout(tick, delay);
    };
    timer.current = setTimeout(tick, delay);
  };

  useEffect(() => stop, [stop]);

  const display = String(format ? format(value) : value);

  return (
    <View style={styles.numberStep}>
      <StepperButton icon="remove" label={t.common.decreaseUnit(unit)} onPressIn={() => start(-1)} onPressOut={stop} />
      <View style={styles.numberCenter}>
        <View style={styles.numberRow}>
          <Text adjustsFontSizeToFit numberOfLines={1} style={[styles.number, numberSize(display)]}>{display}</Text>
          {unit ? <Text style={styles.numberUnit}>{unit}</Text> : null}
        </View>
      </View>
      <StepperButton icon="add" label={t.common.increaseUnit(unit)} onPressIn={() => start(1)} onPressOut={stop} />
    </View>
  );
}

/**
 * adjustsFontSizeToFit is an iOS-only prop, so on every other surface a long
 * value keeps its full size: "12 st 4 lb" at 76pt overlapped both stepper
 * buttons by 46 points. Sizing from the string is deterministic and works
 * everywhere.
 */
function numberSize(display: string) {
  if (display.length <= 3) return { fontSize: 76, lineHeight: 86 };
  if (display.length <= 6) return { fontSize: 52, lineHeight: 62 };
  return { fontSize: 34, lineHeight: 42 };
}

function StepperButton({ icon, label, onPressIn, onPressOut }: { icon: 'add' | 'remove'; label: string; onPressIn: () => void; onPressOut: () => void }) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={({ pressed }) => [styles.numberButton, pressed && styles.numberButtonPressed]}
    >
      <Ionicons color={colors.text} name={icon} size={26} />
    </Pressable>
  );
}

function BuildingState({ goal }: { goal: string }) {
  const { t } = useLanguage();
  return (
    <View style={styles.buildingCard}>
      <View style={styles.orbit}>
        <View style={styles.orbitInner}>
          <Ionicons color={colors.text} name="sparkles" size={28} />
        </View>
      </View>
      <Text style={styles.buildingTitle}>{t.onboarding.buildingHeadline}</Text>
      <Text style={styles.buildingText}>{t.onboarding.buildingBody(goal)}</Text>
    </View>
  );
}

function StartingPlan({ limited, profile, targets }: { limited: boolean; profile: UserProfile; targets: ReturnType<typeof calculateDailyTargets> }) {
  const { locale, t } = useLanguage();
  return (
    <View style={styles.startingCard}>
      <Text style={styles.cardEyebrow}>{t.onboarding.dailyGoal}</Text>
      <Text style={styles.calories}>{new Intl.NumberFormat(locale).format(targets.calories)}</Text>
      <Text style={styles.caloriesLabel}>{t.onboarding.kilocalories}</Text>
      <View style={styles.divider} />
      <View style={styles.planStats}>
        <View style={styles.planStat}>
          <Text numberOfLines={2} style={styles.planStatValue}>{targets.protein} g</Text>
          <Text style={styles.planStatLabel}>{t.common.protein}</Text>
        </View>
        <View style={styles.planStat}>
          <Text numberOfLines={2} style={styles.planStatValue}>{estimatedPace(profile.goal, profile.weeklyRateKg, t.common, profile.unitSystem)}</Text>
          <Text style={styles.planStatLabel}>{t.onboarding.estimatedPace}</Text>
        </View>
        <View style={styles.planStat}>
          <Text numberOfLines={2} style={styles.planStatValue}>{t.onboarding.flexible}</Text>
          <Text style={styles.planStatLabel}>{t.onboarding.mealTimes}</Text>
        </View>
      </View>
      <View style={styles.adaptsRow}>
        <Ionicons color={colors.accentDeep} name="sync" size={18} />
        <Text style={styles.adaptsText}>{t.onboarding.adapts}</Text>
      </View>
      {limited ? (
        <View style={styles.limitRow}>
          <Ionicons color={colors.attention} name="information-circle-outline" size={16} />
          <Text style={styles.limitText}>
            {profile.goal === 'gain' ? t.onboarding.rateLimitedGain : t.onboarding.rateLimited}
          </Text>
        </View>
      ) : null}
      <Text style={styles.safetyText}>{t.onboarding.safety}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 20 },
  flex: { flex: 1 },
  topBar: { height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center' },
  invisible: { opacity: 0 },
  stepLabel: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  skip: { minWidth: 92, color: colors.muted, fontSize: 13, fontWeight: '600', textAlign: 'right' },
  skipPlaceholder: { width: 92 },
  content: { flexGrow: 1, paddingTop: 26, paddingBottom: 8 },
  headingBlock: { gap: 10 },
  brandMark: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
  title: { color: colors.text, fontSize: 34, lineHeight: 40, fontWeight: '700', letterSpacing: -1.1 },
  subtitle: { color: colors.muted, fontSize: 16, lineHeight: 23, maxWidth: 360 },
  body: { flexGrow: 1, justifyContent: 'center', paddingVertical: 22 },
  footer: { gap: 12, paddingTop: 8, backgroundColor: colors.background },
  choiceList: { gap: 12 },
  choice: { minHeight: 82, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 13 },
  choiceActive: { borderColor: colors.accentDeep, backgroundColor: colors.neutralSoft },
  choicePressed: { transform: [{ scale: 0.985 }] },
  choiceIcon: { width: 48, height: 48, borderRadius: 18, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  choiceIconActive: { backgroundColor: colors.accent },
  choiceTextBlock: { flex: 1, minWidth: 0, gap: 3 },
  choiceTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  choiceDetail: { color: colors.muted, fontSize: 13 },
  nameField: { gap: 7 },
  nameInput: { minHeight: 64, borderRadius: radii.input, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, color: colors.text, fontSize: 22, fontWeight: '600', paddingHorizontal: 18 },
  numberStep: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  // 'stretch', not 'center': centring shrank the stepper to its content width,
  // and its space-between then pressed the number flat against the − and +
  // circles with no gap at all.
  unitStep: { flex: 1, justifyContent: 'space-between', paddingBottom: 24 },
  rateStep: { gap: 22 },
  unitToggle: { flexDirection: 'row', gap: 8, alignSelf: 'stretch' },
  unitStepValue: { flex: 1, justifyContent: 'center' },
  unitOption: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  unitOptionActive: { borderColor: colors.accentDeep, backgroundColor: colors.accent },
  unitLabel: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  unitLabelActive: { color: colors.text },
  numberButton: { width: 64, height: 64, borderRadius: 32, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  numberButtonPressed: { backgroundColor: colors.neutralSoft, transform: [{ scale: 0.94 }] },
  numberCenter: { flex: 1, minWidth: 0, alignItems: 'center', paddingHorizontal: 12 },
  number: { color: colors.text, fontSize: 76, lineHeight: 86, fontWeight: '700', letterSpacing: -2.5, fontVariant: ['tabular-nums'] },
  // Beside the value, on its baseline: underneath it read as a caption, and
  // people reported not seeing the unit at all.
  numberRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 6 },
  numberUnit: { color: colors.muted, fontSize: 20, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { minHeight: 52, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  buildingCard: { alignItems: 'center', gap: spacing.md },
  orbit: { width: 100, height: 100, borderRadius: 50, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.neutralSoft },
  orbitInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  buildingTitle: { color: colors.text, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  buildingText: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  startingCard: { borderRadius: radii.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 24, alignItems: 'center' },
  cardEyebrow: { color: colors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1.3 },
  calories: { color: colors.text, fontSize: 56, lineHeight: 64, fontWeight: '700', letterSpacing: -2, marginTop: 8, fontVariant: ['tabular-nums'] },
  caloriesLabel: { color: colors.muted, fontSize: 14 },
  divider: { width: '100%', height: 1, backgroundColor: colors.border, marginVertical: 22 },
  planStats: { width: '100%', flexDirection: 'row' },
  planStat: { flex: 1, minWidth: 0, paddingHorizontal: 4, alignItems: 'center', gap: 5 },
  planStatValue: { minHeight: 38, color: colors.text, fontSize: 14, lineHeight: 18, fontWeight: '700', textAlign: 'center' },
  planStatLabel: { color: colors.muted, fontSize: 11, textAlign: 'center' },
  adaptsRow: { marginTop: 22, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: colors.neutralSoft, borderRadius: radii.pill, paddingHorizontal: 13, paddingVertical: 9 },
  adaptsText: { flex: 1, color: colors.accentDeep, fontSize: 12, fontWeight: '700' },
  limitRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 16, backgroundColor: colors.attentionSoft, borderRadius: 14, padding: 11 },
  limitText: { flex: 1, color: colors.text, fontSize: 11, lineHeight: 16 },
  safetyText: { color: colors.muted, fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 16 },
  modalScrim: { flex: 1, backgroundColor: 'rgba(20,21,15,0.42)', justifyContent: 'flex-end' },
  consentSheet: { borderTopLeftRadius: radii.sheet, borderTopRightRadius: radii.sheet, backgroundColor: colors.surface, paddingHorizontal: 22, paddingTop: 24, gap: 14 },
  consentIcon: { width: 50, height: 50, borderRadius: 18, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  consentTitle: { color: colors.text, fontSize: 25, lineHeight: 30, fontWeight: '700' },
  consentText: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  consentLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: 18 },
  consentLink: { color: colors.accentDeep, fontSize: 12, fontWeight: '800', textDecorationLine: 'underline' },
  consentError: { color: colors.attention, fontSize: 12, lineHeight: 18 },
});
