import { useTheme, useThemedStyles } from '@/context/ThemeContext';
import type { ThemeColors } from '@/constants/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { KandroMark } from '@/components/KandroMark';
import { PlanBuilder, BUILDING_MS } from '@/components/PlanBuilder';
import { PrimaryButton, ProgressBar } from '@/components/ui';
import { radii, spacing } from '@/constants/theme';
import { useApp } from '@/context/AppContext';
import { BIOLOGICAL_SEXES, calculateDailyTargets, estimatedPace, isRateLimited, isTeenProfile, weeklyRateLabel } from '@/services/personalization';
import { getGuardianConsentStatus, requestGuardianConsent } from '@/services/guardianConsent';
import { trackEvent } from '@/services/telemetry';
import { errorHaptic, selectionHaptic, stepHaptic, successHaptic } from '@/services/haptics';
import { useLanguage } from '@/i18n/LanguageProvider';
import { formatNumber } from '@/utils/format';
import { parseDecimalInput } from '@/utils/decimalInput';
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
import type { BiologicalSex } from '@/types/nutrition';

type Choice = { label: string; detail: string; icon: keyof typeof Ionicons.glyphMap };


const STEPS = ['goal', 'name', 'sex', 'age', 'rate', 'height', 'weight', 'activity', 'preferences', 'building', 'plan'] as const;
// The same questions, minus the first-run theatre and age. Age is declared once
// because crossing 16 changes guardian consent and crossing 18 changes the
// analytics policy. A correction needs a trusted support path that updates
// those states together; a local edit must never outrun the server trigger.
const EDIT_STEPS = STEPS.filter((id) => id !== 'building' && id !== 'age');
type StepId = (typeof STEPS)[number];

type Dict = ReturnType<typeof useLanguage>['t'];

function goalChoicesFor(t: Dict): Choice[] {
  return [
    { label: t.onboarding.goalLose, detail: t.onboarding.goalLoseDetail, icon: 'trending-down' },
    { label: t.onboarding.goalMaintain, detail: t.onboarding.goalMaintainDetail, icon: 'remove' },
    { label: t.onboarding.goalGain, detail: t.onboarding.goalGainDetail, icon: 'trending-up' },
  ];
}

/**
 * Asked because it is worth about 115 kcal a day, and offered with a real
 * third option: nobody has to answer to use the app.
 */
function sexChoicesFor(t: Dict): Choice[] {
  return [
    { label: t.onboarding.sexFemale, detail: t.onboarding.sexFemaleDetail, icon: 'female' },
    { label: t.onboarding.sexMale, detail: t.onboarding.sexMaleDetail, icon: 'male' },
    { label: t.onboarding.sexUnspecified, detail: t.onboarding.sexUnspecifiedDetail, icon: 'help' },
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
    { id: 'vegan', label: t.onboarding.prefVegan },
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
    sex: { title: t.onboarding.sexTitle, subtitle: t.onboarding.sexSubtitle },
    age: { title: t.onboarding.ageTitle, subtitle: t.onboarding.ageSubtitle },
    height: { title: t.onboarding.heightTitle, subtitle: t.onboarding.heightSubtitle },
    weight: { title: t.onboarding.weightTitle, subtitle: t.onboarding.weightSubtitle },
    activity: { title: t.onboarding.activityTitle, subtitle: t.onboarding.activitySubtitle },
    preferences: { title: t.onboarding.preferencesTitle, subtitle: t.onboarding.preferencesSubtitle },
    building: { title: t.onboarding.buildingTitle, subtitle: t.onboarding.buildingSubtitle },
    plan: { title: t.onboarding.planTitle, subtitle: t.onboarding.planSubtitle },
  };
}

/** Steps the user may leave without answering. Age needs an explicit confirmation. */
const skippableSteps = new Set<StepId>(['name', 'preferences']);

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const compactHeight = windowHeight <= 600;
  const { completeOnboarding, grantWellnessConsent, profile } = useApp();
  const { language, locale, t } = useLanguage();
  const copy = copyFor(t);
  const goalChoices = goalChoicesFor(t);
  const sexChoices = sexChoicesFor(t);
  const activityChoices = activityChoicesFor(t);
  const preferenceChoices = preferenceChoicesFor(t);
  const params = useLocalSearchParams<{ edit?: string }>();
  const editing = params.edit === '1' && !!profile.completedAt;
  const steps: readonly StepId[] = editing ? EDIT_STEPS : STEPS;
  const [stepIndex, setStepIndex] = useState(0);
  const [goal, setGoal] = useState<NutritionGoal>(() => (editing ? profile.goal : 'lose'));
  const [displayName, setDisplayName] = useState(() => (editing ? profile.displayName : ''));
  const [sex, setSex] = useState<BiologicalSex>(() => (editing ? profile.sex : 'unspecified'));
  // Guessed from the device so most people never touch it, but visible and
  // switchable right on the step where it matters.
  const [unitSystem, setUnitSystem] = useState<UnitSystem>(() => (editing ? profile.unitSystem : defaultUnitSystem()));
  const [age, setAge] = useState(() => (editing ? profile.age : 29));
  // The visible starting value is only a convenient picker position. It must
  // never become the user's declared age until they adjust or affirm it.
  const [ageConfirmed, setAgeConfirmed] = useState(() => editing);
  const [height, setHeight] = useState(() => (editing ? profile.heightCm : 178));
  const [weight, setWeight] = useState(() => (editing ? profile.weightKg : 78));
  const [activity, setActivity] = useState<UserProfile['activityLevel']>(() => (editing ? profile.activityLevel : 'light'));
  const [weeklyRate, setWeeklyRate] = useState<WeeklyRateKg>(() => (editing ? profile.weeklyRateKg : 0.5));
  const [preferences, setPreferences] = useState<string[]>(() => (editing ? profile.preferences : ['high-protein']));
  const [showConsent, setShowConsent] = useState(false);
  const [consentBusy, setConsentBusy] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [guardianEmail, setGuardianEmail] = useState('');
  const [guardianRequestSent, setGuardianRequestSent] = useState(false);
  const [skippedAnything, setSkippedAnything] = useState(false);
  const goalRef = useRef(goal);
  goalRef.current = goal;
  const ageRef = useRef(age);
  ageRef.current = age;

  const step = steps[stepIndex];

  const goNext = useCallback(() => {
    setStepIndex((current) => {
      let next = Math.min(steps.length - 1, current + 1);
      // Holding weight has no rate to choose.
      if (steps[next] === 'rate' && (goalRef.current === 'maintain' || ageRef.current < 18)) next += 1;
      return Math.min(steps.length - 1, next);
    });
  }, [steps]);

  const goBack = () => {
    void selectionHaptic();
    setStepIndex((current) => {
      let previous = Math.max(0, current - 1);
      if (steps[previous] === 'rate' && (goalRef.current === 'maintain' || ageRef.current < 18)) previous -= 1;
      return Math.max(0, previous);
    });
  };

  // A selection stays on screen until the user explicitly confirms it with
  // Next. Auto-advancing made a stray tap feel irreversible and prevented a
  // final visual check of the selected answer.
  const selectChoice = (apply: () => void) => {
    void selectionHaptic();
    apply();
  };

  const skipStep = () => {
    void selectionHaptic();
    setSkippedAnything(true);
    if (step === 'name') setDisplayName('');
    if (step === 'preferences') setPreferences([]);
    goNext();
  };

  // The "building" beat is a deliberate pause before the payoff, not a fake
  // loading bar: it never blocks and always resolves.
  useEffect(() => {
    if (step !== 'building') return;
    // A tail after the animation lands, so the final figure is readable
    // before the plan replaces it.
    const timer = setTimeout(() => setStepIndex((current) => Math.min(steps.length - 1, current + 1)), BUILDING_MS + 450);
    return () => clearTimeout(timer);
  }, [step, steps]);

  // The payoff has its own feel: the ticks during the build are the work, this
  // is the result arriving.
  useEffect(() => {
    if (step !== 'plan') return;
    void successHaptic();
  }, [step]);

  const draftProfile = useMemo<UserProfile>(() => ({
    displayName: displayName.trim(),
    sex,
    unitSystem,
    goal,
    age,
    heightCm: height,
    weightKg: weight,
    activityLevel: activity,
    weeklyRateKg: weeklyRate,
    preferences,
    completedAt: editing ? profile.completedAt : null,
  }), [activity, editing, profile.completedAt, age, displayName, goal, height, preferences, sex, unitSystem, weeklyRate, weight]);
  const startingTargets = useMemo(() => calculateDailyTargets(draftProfile), [draftProfile]);

  const finishOnboarding = async () => {
    await grantWellnessConsent(draftProfile.age);
    await completeOnboarding(draftProfile);
    trackEvent('onboarding completed', { completion: skippedAnything ? 'skipped' : 'finished' });
    void successHaptic();
    setShowConsent(false);
    router.replace('/(tabs)/scan');
  };

  const acceptConsent = async () => {
    setConsentBusy(true);
    setConsentError(null);
    try {
      if (draftProfile.age < 16) {
        if (!guardianRequestSent) {
          const normalized = guardianEmail.trim().toLowerCase();
          if (!/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(normalized)) {
            setConsentError(t.onboarding.guardianInvalidEmail);
            return;
          }
          const status = await requestGuardianConsent(normalized, draftProfile.age, language);
          if (status === 'approved') await finishOnboarding();
          else setGuardianRequestSent(true);
          return;
        }
        if (!await getGuardianConsentStatus()) {
          setConsentError(t.onboarding.guardianPending);
          return;
        }
      }
      await finishOnboarding();
    } catch {
      void errorHaptic();
      setConsentError(draftProfile.age < 16 ? t.onboarding.guardianCloudRequired : t.onboarding.consentError);
    } finally {
      setConsentBusy(false);
    }
  };

  /**
   * Editing skips the consent sheet: consent was given once and is not
   * re-asked because someone changed their activity level.
   */
  const saveEdits = async () => {
    await completeOnboarding(draftProfile);
    trackEvent('plan edited', { completion: 'finished' });
    router.replace('/(tabs)/profile');
  };

  const primaryAction = async () => {
    void selectionHaptic();
    // Keep the invariant here as well as on the disabled button: navigation
    // must not persist the convenient picker default through another caller.
    if (step === 'age' && !ageConfirmed) return;
    if (step === 'plan') {
      if (editing) {
        if (draftProfile.age < 16 && !await getGuardianConsentStatus().catch(() => false)) {
          setGuardianRequestSent(false);
          setConsentError(null);
          setShowConsent(true);
        } else {
          await saveEdits();
        }
        return;
      }
      setGuardianRequestSent(false);
      setConsentError(null);
      setShowConsent(true);
      return;
    }
    goNext();
  };

  const showFooterButton = step !== 'building';
  const footerLabel = step === 'plan' ? (editing ? t.onboarding.saveChanges : t.onboarding.scanFirstMeal) : t.common.next;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityLabel={t.common.back}
          accessibilityRole="button"
          accessibilityState={{ disabled: stepIndex === 0 && !editing }}
          disabled={stepIndex === 0 && !editing}
          hitSlop={10}
          onPress={stepIndex === 0 && editing ? () => router.replace('/(tabs)/profile') : goBack}
          style={[styles.backButton, stepIndex === 0 && !editing && styles.invisible]}
        >
          <Ionicons color={colors.text} name="arrow-back" size={22} />
        </Pressable>
        <Text style={styles.stepLabel}>{t.onboarding.step(stepIndex + 1, steps.length)}</Text>
        {skippableSteps.has(step) ? (
          <Pressable accessibilityRole="button" hitSlop={10} onPress={skipStep}>
            <Text style={styles.skip}>{t.common.skip}</Text>
          </Pressable>
        ) : <View style={styles.skipPlaceholder} />}
      </View>

      <ProgressBar value={(stepIndex + 1) / steps.length} />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView
          contentContainerStyle={[styles.content, compactHeight && styles.contentCompact]}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.flex}
        >
          <View style={[styles.headingBlock, compactHeight && styles.headingBlockCompact]}>
            {step === 'goal' || step === 'plan' ? (
              <View style={[styles.brandMark, compactHeight && styles.brandMarkCompact]}><KandroMark size={compactHeight ? 34 : 42} /></View>
            ) : null}
            <Text accessibilityRole="header" style={[styles.title, compactHeight && styles.titleCompact]}>{copy[step].title}</Text>
            <Text style={[styles.subtitle, compactHeight && styles.subtitleCompact]}>
              {/* The rate question means something different for each goal. */}
              {step === 'rate' && goal === 'gain' ? t.onboarding.rateSubtitleGain : copy[step].subtitle}
            </Text>
          </View>

          <View style={[styles.body, compactHeight && styles.bodyCompact]}>
            {step === 'goal' ? (
              <ChoiceList choices={goalChoices} compact={compactHeight} onSelect={(value) => selectChoice(() => setGoal(value))} selected={goal} values={['lose', 'maintain', 'gain'] as NutritionGoal[]} />
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
                      aria-checked={active}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: active }}
                      key={rate}
                      onPress={() => selectChoice(() => setWeeklyRate(rate))}
                      style={({ pressed }) => [styles.choice, compactHeight && styles.choiceCompact, active && styles.choiceActive, pressed && styles.choicePressed]}
                    >
                      <View style={[styles.choiceIcon, compactHeight && styles.choiceIconCompact, active && styles.choiceIconActive]}>
                        <Ionicons color={active ? colors.onAccent : colors.text} name={rate === 0.25 ? 'leaf-outline' : 'flash-outline'} size={22} />
                      </View>
                      <View style={styles.choiceTextBlock}>
                        <Text style={styles.choiceTitle}>{weeklyRateLabel(draftProfile.goal, rate, t.common, unitSystem)}</Text>
                        <Text style={styles.choiceDetail}>
                          {/*
                            Building muscle and losing weight are not the same
                            trade-off: a faster deficit costs adherence, a
                            faster surplus costs body composition.
                          */}
                          {draftProfile.goal === 'gain'
                            ? (rate === 0.25 ? t.onboarding.rateCalmGain : t.onboarding.rateBriskGain)
                            : (rate === 0.25 ? t.onboarding.rateCalm : t.onboarding.rateBrisk)}
                          {' · '}{draftProfile.goal === 'lose' ? '−' : '+'}{applied} {t.onboarding.perDay}
                        </Text>
                      </View>
                      <Ionicons color={active ? colors.accentText : colors.border} name={active ? 'checkmark-circle' : 'ellipse-outline'} size={24} />
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

            {step === 'sex' ? (
              <ChoiceList
                choices={sexChoices}
                compact={compactHeight}
                onSelect={(value) => selectChoice(() => setSex(value))}
                selected={sex}
                values={BIOLOGICAL_SEXES}
              />
            ) : null}
            {step === 'age' ? (
              <View style={styles.ageStep}>
                <NumberStep
                  max={100}
                  min={14}
                  onChange={(nextAge) => {
                    setAge(nextAge);
                    setAgeConfirmed(true);
                  }}
                  step={1}
                  unit={t.onboarding.years}
                  value={age}
                />
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: ageConfirmed }}
                  onPress={() => {
                    void selectionHaptic();
                    setAgeConfirmed(true);
                  }}
                  style={[styles.ageConfirmation, ageConfirmed && styles.ageConfirmationChecked]}
                >
                  <Ionicons
                    color={ageConfirmed ? colors.accentText : colors.muted}
                    name={ageConfirmed ? 'checkmark-circle' : 'ellipse-outline'}
                    size={22}
                  />
                  <Text style={styles.ageConfirmationText}>{t.onboarding.confirmAge(age)}</Text>
                </Pressable>
              </View>
            ) : null}
            {step === 'height' ? (
              <View style={styles.unitStep}>
                <UnitToggle onChange={setUnitSystem} value={unitSystem} />
                <View style={styles.unitStepValue}>
                  {usesMetricHeight(unitSystem) ? (
                    <NumberStep max={220} min={130} onChange={setHeight} step={1} unit="cm" value={height} />
                  ) : (
                    <NumberStep
                      accessibilityUnit="in"
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
                    <NumberStep
                      editable
                      format={(kilos) => formatNumber(kilos, locale)}
                      max={200}
                      min={40}
                      onChange={setWeight}
                      step={0.1}
                      unit="kg"
                      value={weight}
                    />
                  ) : (
                    <NumberStep
                      editable
                      accessibilityUnit="lb"
                      format={(pounds) => (unitSystem === 'uk'
                        ? formatWeight(poundsToKg(pounds), 'uk', locale)
                        : formatNumber(pounds, locale))}
                      max={Math.floor(kgToPounds(200) * 10) / 10}
                      min={Math.ceil(kgToPounds(40) * 10) / 10}
                      onChange={(pounds) => setWeight(poundsToKg(pounds))}
                      step={unitSystem === 'us' ? 0.1 : 1}
                      unit={unitSystem === 'uk' ? '' : 'lb'}
                      value={Math.round(kgToPounds(weight) * 10) / 10}
                    />
                  )}
                </View>
              </View>
            ) : null}

            {step === 'activity' ? (
              <ChoiceList choices={activityChoices} compact={compactHeight} onSelect={(value) => selectChoice(() => setActivity(value))} selected={activity} values={['low', 'light', 'high'] as UserProfile['activityLevel'][]} />
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
                        void selectionHaptic();
                        if (item.id === 'none') setPreferences([]);
                        else setPreferences((current) => current.includes(item.id)
                          ? current.filter((entry) => entry !== item.id)
                          : [...current, item.id]);
                      }}
                      style={[styles.chip, selected && styles.chipSelected]}
                    >
                      {selected ? <Ionicons color={colors.onAccent} name="checkmark" size={17} /> : null}
                      <Text style={[styles.chipText, selected && { color: colors.onAccent }]}>{item.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {step === 'building' ? (
              <View style={styles.buildingCard}>
                <PlanBuilder profile={draftProfile} />
                <Text style={styles.buildingText}>
                  {t.onboarding.buildingBody(goalChoices[['lose', 'maintain', 'gain'].indexOf(goal)].label)}
                </Text>
              </View>
            ) : null}
            {step === 'plan' ? <StartingPlan limited={isRateLimited(draftProfile)} profile={draftProfile} targets={startingTargets} /> : null}
          </View>
        </ScrollView>

        {showFooterButton ? (
          <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
            <PrimaryButton
              disabled={step === 'age' && !ageConfirmed}
              icon={step === 'plan' ? 'camera' : 'arrow-forward'}
              label={footerLabel}
              onPress={() => void primaryAction()}
            />
          </View>
        ) : null}
      </KeyboardAvoidingView>

      <Modal animationType="fade" onRequestClose={() => setShowConsent(false)} transparent visible={showConsent}>
        <View style={styles.modalScrim}>
          <View accessibilityViewIsModal style={[styles.consentSheet, { paddingBottom: insets.bottom + 18 }]}>
            <View style={styles.consentIcon}><Ionicons color={colors.onAccent} name="shield-checkmark-outline" size={26} /></View>
            <Text accessibilityRole="header" style={styles.consentTitle}>
              {draftProfile.age < 16 ? t.onboarding.guardianTitle : t.onboarding.consentTitle}
            </Text>
            <Text style={styles.consentText}>
              {draftProfile.age < 16 ? t.onboarding.guardianBody : t.onboarding.consentBody}
            </Text>
            {draftProfile.age < 16 ? (
              <View style={styles.guardianBlock}>
                <Text style={styles.guardianLabel}>{t.onboarding.guardianEmail}</Text>
                <TextInput
                  accessibilityLabel={t.onboarding.guardianEmail}
                  autoCapitalize="none"
                  autoComplete="email"
                  editable={!guardianRequestSent && !consentBusy}
                  inputMode="email"
                  onChangeText={setGuardianEmail}
                  placeholder={t.onboarding.guardianPlaceholder}
                  placeholderTextColor={colors.muted}
                  style={styles.guardianInput}
                  value={guardianEmail}
                />
                {guardianRequestSent ? <Text style={styles.guardianSent}>{t.onboarding.guardianSent}</Text> : null}
              </View>
            ) : null}
            <View style={styles.consentLinks}>
              <Pressable accessibilityRole="link" onPress={() => { setShowConsent(false); router.push('/privacy'); }}><Text style={styles.consentLink}>{t.onboarding.consentPrivacy}</Text></Pressable>
              <Pressable accessibilityRole="link" onPress={() => { setShowConsent(false); router.push('/terms'); }}><Text style={styles.consentLink}>{t.onboarding.consentTerms}</Text></Pressable>
            </View>
            {consentError ? <Text accessibilityLiveRegion="assertive" style={styles.consentError}>{consentError}</Text> : null}
            <PrimaryButton
              disabled={consentBusy}
              icon={draftProfile.age < 16 && !guardianRequestSent ? 'mail-outline' : 'checkmark'}
              label={consentBusy
                ? t.common.moment
                : draftProfile.age < 16
                  ? (guardianRequestSent ? t.onboarding.guardianCheck : t.onboarding.guardianSend)
                  : t.onboarding.consentAccept}
              onPress={() => void acceptConsent()}
            />
            <PrimaryButton disabled={consentBusy} label={t.common.back} onPress={() => setShowConsent(false)} variant="ghost" />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function ChoiceList<T extends string>({ choices, compact = false, onSelect, selected, values }: { choices: Choice[]; compact?: boolean; onSelect: (choice: T) => void; selected: T; values: T[] }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.choiceList}>
      {choices.map((choice, index) => {
        const value = values[index];
        const active = value === selected;
        return (
          <Pressable
            aria-checked={active}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            key={value}
            onPress={() => onSelect(value)}
            style={({ pressed }) => [styles.choice, compact && styles.choiceCompact, active && styles.choiceActive, pressed && styles.choicePressed]}
          >
            <View style={[styles.choiceIcon, compact && styles.choiceIconCompact, active && styles.choiceIconActive]}>
              <Ionicons color={active ? colors.onAccent : colors.text} name={choice.icon} size={22} />
            </View>
            <View style={styles.choiceTextBlock}>
              <Text style={styles.choiceTitle}>{choice.label}</Text>
              <Text style={styles.choiceDetail}>{choice.detail}</Text>
            </View>
            <Ionicons color={active ? colors.accentText : colors.border} name={active ? 'checkmark-circle' : 'ellipse-outline'} size={24} />
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
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
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
            onPress={() => { void selectionHaptic(); onChange(system); }}
            style={[styles.unitOption, active && styles.unitOptionActive]}
          >
            <Text style={[styles.unitLabel, active && styles.unitLabelActive]}>{labels[system]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function NumberStep({ editable = false, accessibilityUnit, format, max, min, onChange, step, unit, value }: { editable?: boolean; accessibilityUnit?: string; format?: (value: number) => string; max: number; min: number; onChange: (value: number) => void; step: number; unit: string; value: number }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t, locale } = useLanguage();
  const [editingNumber, setEditingNumber] = useState(false);
  const [draft, setDraft] = useState('');
  const parsed = parseDecimalInput(draft, min, max);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gesture = useRef(0);
  const latest = useRef(value);
  latest.current = value;

  /**
   * Every value ticks, not just the first.
   *
   * A held stepper ran from 78 to 95 kg in silence after one tap's feedback,
   * which is the opposite of what the vibration is for: it is how you feel the
   * number moving without watching it. Holding at a bound stays silent: there
   * is nothing to feel when nothing changed.
   */
  const apply = useCallback((direction: -1 | 1, repeating = false) => {
    // A value that came back through a unit conversion does not sit on the step
    // grid: 176 lb is 79.8 kg, and adding a whole step to that kept the .8 for
    // ever, so only the digits in front of the separator ever moved. The first
    // press lands on the neighbouring whole step in the direction pressed;
    // after that it moves a full step at a time.
    const steps = latest.current / step;
    const onGrid = Math.abs(steps - Math.round(steps)) < 1e-9;
    const raw = onGrid
      ? latest.current + direction * step
      : (direction > 0 ? Math.ceil(steps) : Math.floor(steps)) * step;
    const next = Math.min(max, Math.max(min, Math.round(raw * 1e10) / 1e10));
    if (next === latest.current) return;
    latest.current = next;
    void stepHaptic(repeating);
    onChange(next);
  }, [max, min, onChange, step]);

  const stop = useCallback(() => {
    gesture.current += 1;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const start = (direction: -1 | 1) => {
    // A fast second tap used to replace the timer reference without cancelling
    // the first timer. That orphan kept changing age or height after release.
    stop();
    const activeGesture = gesture.current;
    apply(direction);
    let delay = 340;
    const tick = () => {
      if (activeGesture !== gesture.current) return;
      apply(direction, true);
      // Faster than this turns distinct taps into a cheap continuous buzz.
      delay = Math.max(72, delay * 0.82);
      timer.current = setTimeout(tick, delay);
    };
    timer.current = setTimeout(tick, delay);
  };

  useEffect(() => stop, [stop]);

  const display = String(format ? format(value) : value);

  return (
    <View style={styles.numberStep}>
      <View style={styles.numberCenter}>
        <View style={styles.numberRow}>
          {editable ? <Pressable accessibilityRole="button" accessibilityLabel={`${t.onboarding.editWeight}: ${display} ${accessibilityUnit ?? unit}`} onPress={() => { stop(); setDraft(formatNumber(value, locale)); setEditingNumber(true); }}>
            <Text adjustsFontSizeToFit numberOfLines={1} style={[styles.number, numberSize(display)]}>{display}</Text>
          </Pressable> : <Text adjustsFontSizeToFit numberOfLines={1} style={[styles.number, numberSize(display)]}>{display}</Text>}
          {unit ? <Text style={styles.numberUnit}>{unit}</Text> : null}
        </View>
      </View>
      <Text style={styles.adjustHint}>{editable ? t.onboarding.exactWeightHint : t.onboarding.adjustHint}</Text>
      <View style={styles.numberControls}>
        <StepperButton icon="remove" label={t.common.decreaseUnit(accessibilityUnit ?? unit)} onPressIn={() => start(-1)} onPressOut={stop} />
        <StepperButton icon="add" label={t.common.increaseUnit(accessibilityUnit ?? unit)} onPressIn={() => start(1)} onPressOut={stop} />
      </View>
      <Modal visible={editingNumber} transparent animationType="fade" onRequestClose={() => setEditingNumber(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.numberEditorScrim}>
          <View accessibilityViewIsModal style={styles.numberEditor}>
            <Text accessibilityRole="header" style={styles.numberEditorTitle}>{t.onboarding.editWeight} ({accessibilityUnit ?? unit})</Text>
            <TextInput accessibilityLabel={t.onboarding.editWeight} autoFocus selectTextOnFocus keyboardType="decimal-pad" maxLength={6} value={draft} onChangeText={setDraft} style={styles.guardianInput} />
            <Text accessibilityLiveRegion="polite" style={styles.adjustHint}>{t.onboarding.weightRange.replace('{min}', formatNumber(min, locale)).replace('{max}', formatNumber(max, locale))} {accessibilityUnit ?? unit}</Text>
            <PrimaryButton label={t.common.save} disabled={parsed === null} onPress={() => { if (parsed === null) return; onChange(parsed); setEditingNumber(false); }} />
            <PrimaryButton label={t.common.cancel} variant="ghost" onPress={() => setEditingNumber(false)} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  if (display.length <= 3) return { fontSize: 100, lineHeight: 112 };
  if (display.length <= 6) return { fontSize: 70, lineHeight: 80 };
  return { fontSize: 46, lineHeight: 56 };
}

function StepperButton({ icon, label, onPressIn, onPressOut }: { icon: 'add' | 'remove'; label: string; onPressIn: () => void; onPressOut: () => void }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
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

function StartingPlan({ limited, profile, targets }: { limited: boolean; profile: UserProfile; targets: ReturnType<typeof calculateDailyTargets> }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
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
          <Text numberOfLines={2} style={styles.planStatValue}>
            {isTeenProfile(profile)
              ? t.onboarding.teenPace
              : estimatedPace(profile.goal, profile.weeklyRateKg, t.common, profile.unitSystem)}
          </Text>
          <Text style={styles.planStatLabel}>{t.onboarding.estimatedPace}</Text>
        </View>
        <View style={styles.planStat}>
          <Text numberOfLines={2} style={styles.planStatValue}>{t.onboarding.flexible}</Text>
          <Text style={styles.planStatLabel}>{t.onboarding.mealTimes}</Text>
        </View>
      </View>
      <View style={styles.adaptsRow}>
        <Ionicons color={colors.accentText} name="sync" size={18} />
        <Text style={styles.adaptsText}>{t.onboarding.adapts}</Text>
      </View>
      {limited ? (
        <View style={styles.limitRow}>
          <Ionicons color={colors.attention} name="information-circle-outline" size={16} />
          <Text style={styles.limitText}>
            {t.onboarding.rateLimited}
          </Text>
        </View>
      ) : null}
      {isTeenProfile(profile) ? (
        <View style={styles.teenRow}>
          <Ionicons color={colors.accentText} name="shield-checkmark-outline" size={16} />
          <Text style={styles.teenText}>{t.onboarding.teenPlanNotice}</Text>
        </View>
      ) : null}
      <Text style={styles.safetyText}>{t.onboarding.safety}</Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 20 },
  flex: { flex: 1 },
  topBar: { height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center' },
  invisible: { opacity: 0 },
  stepLabel: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  skip: { minWidth: 92, color: colors.muted, fontSize: 13, fontWeight: '600', textAlign: 'right' },
  skipPlaceholder: { width: 92 },
  content: { flexGrow: 1, paddingTop: 26, paddingBottom: 8 },
  contentCompact: { paddingTop: 12, paddingBottom: 6 },
  headingBlock: { gap: 10 },
  headingBlockCompact: { gap: 6 },
  brandMark: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
  brandMarkCompact: { width: 34, height: 34, marginBottom: 2 },
  title: { color: colors.text, fontSize: 34, lineHeight: 40, fontWeight: '700', letterSpacing: -1.1 },
  titleCompact: { fontSize: 28, lineHeight: 33, letterSpacing: -0.8 },
  subtitle: { color: colors.muted, fontSize: 16, lineHeight: 23, maxWidth: 360 },
  subtitleCompact: { fontSize: 14, lineHeight: 19 },
  body: { flexGrow: 1, justifyContent: 'center', paddingVertical: 22 },
  bodyCompact: { justifyContent: 'flex-start', paddingVertical: 12 },
  footer: { gap: 12, paddingTop: 8, backgroundColor: colors.background },
  choiceList: { gap: 12 },
  choice: { minHeight: 82, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 13 },
  choiceCompact: { minHeight: 70, borderRadius: 20, padding: 10, gap: 10 },
  choiceActive: { borderColor: colors.accentText, backgroundColor: colors.neutralSoft },
  choicePressed: { transform: [{ scale: 0.985 }] },
  choiceIcon: { width: 48, height: 48, borderRadius: 18, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  choiceIconCompact: { width: 42, height: 42, borderRadius: 15 },
  choiceIconActive: { backgroundColor: colors.accent },
  choiceTextBlock: { flex: 1, minWidth: 0, gap: 3 },
  choiceTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  choiceDetail: { color: colors.muted, fontSize: 13 },
  nameField: { gap: 7 },
  nameInput: { minHeight: 64, borderRadius: radii.input, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, color: colors.text, fontSize: 22, fontWeight: '600', paddingHorizontal: 18 },
  ageStep: { width: '100%', alignItems: 'center', gap: 4 },
  ageConfirmation: { minHeight: 52, alignSelf: 'stretch', borderRadius: radii.input, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  ageConfirmationChecked: { borderColor: colors.accentText, backgroundColor: colors.neutralSoft },
  ageConfirmationText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  numberStep: { width: '100%', alignItems: 'center', justifyContent: 'center', gap: 14, paddingVertical: 24 },
  // 'stretch', not 'center': centring shrank the stepper to its content width,
  // and its space-between then pressed the number flat against the − and +
  // circles with no gap at all.
  unitStep: { flex: 1, gap: 18, paddingBottom: 10 },
  rateStep: { gap: 22 },
  unitToggle: { flexDirection: 'row', gap: 8, alignSelf: 'stretch' },
  unitStepValue: { flex: 1, minHeight: 292, justifyContent: 'center', borderRadius: radii.card, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 18 },
  unitOption: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  unitOptionActive: { borderColor: colors.accentText, backgroundColor: colors.accent },
  unitLabel: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  unitLabelActive: { color: colors.onAccent },
  numberControls: { width: '100%', flexDirection: 'row', justifyContent: 'center', gap: 14 },
  numberButton: { flex: 1, maxWidth: 240, height: 72, borderRadius: 24, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  numberButtonPressed: { backgroundColor: colors.neutralSoft, transform: [{ scale: 0.94 }] },
  numberCenter: { width: '100%', minHeight: 112, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  number: { color: colors.text, fontSize: 100, lineHeight: 112, fontWeight: '700', letterSpacing: -3, fontVariant: ['tabular-nums'] },
  // Beside the value, on its baseline: underneath it read as a caption, and
  // people reported not seeing the unit at all.
  numberRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 6 },
  numberUnit: { color: colors.muted, fontSize: 30, fontWeight: '700' },
  adjustHint: { color: colors.muted, fontSize: 13, lineHeight: 18, textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { minHeight: 52, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  buildingCard: { alignItems: 'center', gap: spacing.md },
  orbit: { width: 100, height: 100, borderRadius: 50, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.neutralSoft },
  orbitInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  buildingSteps: { alignSelf: 'stretch', marginTop: 16, gap: 9 },
  buildingStep: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  buildingStepHidden: { opacity: 0 },
  buildingStepLabel: { flex: 1, color: colors.muted, fontSize: 13 },
  buildingStepValue: { color: colors.text, fontSize: 14, fontWeight: '700' },
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
  adaptsText: { flex: 1, color: colors.accentText, fontSize: 12, fontWeight: '700' },
  limitRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 16, backgroundColor: colors.attentionSoft, borderRadius: 14, padding: 11 },
  limitText: { flex: 1, color: colors.text, fontSize: 11, lineHeight: 16 },
  safetyText: { color: colors.muted, fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 16 },
  modalScrim: { flex: 1, backgroundColor: 'rgba(20,21,15,0.42)', justifyContent: 'flex-end' },
  numberEditorScrim: { flex: 1, backgroundColor: 'rgba(20,21,15,0.42)', justifyContent: 'center', padding: 24 },
  numberEditor: { backgroundColor: colors.surface, borderRadius: radii.card, padding: 20, gap: 14 },
  numberEditorTitle: { color: colors.text, fontSize: 20, fontWeight: '700' },
  consentSheet: { borderTopLeftRadius: radii.sheet, borderTopRightRadius: radii.sheet, backgroundColor: colors.surface, paddingHorizontal: 22, paddingTop: 24, gap: 14 },
  consentIcon: { width: 50, height: 50, borderRadius: 18, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  consentTitle: { color: colors.text, fontSize: 25, lineHeight: 30, fontWeight: '700' },
  consentText: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  guardianBlock: { gap: 7 },
  guardianLabel: { color: colors.text, fontSize: 12, fontWeight: '700' },
  guardianInput: { minHeight: 52, borderRadius: radii.input, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, color: colors.text, fontSize: 16, paddingHorizontal: 15 },
  guardianSent: { color: colors.accentText, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  consentLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: 18 },
  consentLink: { color: colors.accentText, fontSize: 12, fontWeight: '800', textDecorationLine: 'underline' },
  consentError: { color: colors.attention, fontSize: 12, lineHeight: 18 },
  teenRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 16, backgroundColor: colors.neutralSoft, borderRadius: 14, padding: 11 },
  teenText: { flex: 1, color: colors.text, fontSize: 11, lineHeight: 16 },
});
