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
import { recordWellnessConsent } from '@/services/consent';
import { calculateDailyTargets, estimatedPace, isRateLimited, weeklyRateLabel } from '@/services/personalization';
import { trackEvent } from '@/services/telemetry';
import { NutritionGoal, UserProfile, WeeklyRateKg } from '@/types/nutrition';

type Choice = { label: string; detail: string; icon: keyof typeof Ionicons.glyphMap };

const goalChoices: Choice[] = [
  { label: 'Gewicht reduzieren', detail: 'In einem ruhigen, nachhaltigen Tempo', icon: 'trending-down' },
  { label: 'Gewicht halten', detail: 'Deinen aktuellen Kurs beibehalten', icon: 'remove' },
  { label: 'Stärker werden', detail: 'Muskeln und Leistung unterstützen', icon: 'trending-up' },
];

const activityChoices: Choice[] = [
  { label: 'Meist sitzend', detail: 'Wenig gezielte Bewegung', icon: 'desktop-outline' },
  { label: 'Leicht aktiv', detail: '1–3 Trainingseinheiten pro Woche', icon: 'walk-outline' },
  { label: 'Sehr aktiv', detail: '4 oder mehr Einheiten pro Woche', icon: 'barbell-outline' },
];

const preferenceChoices = [
  { id: 'high-protein', label: 'Proteinreich' },
  { id: 'vegetarian', label: 'Vegetarisch' },
  { id: 'pork-free', label: 'Ohne Schwein' },
  { id: 'lactose-free', label: 'Laktosefrei' },
  { id: 'quick', label: 'Schnelle Mahlzeiten' },
] as const;

const STEPS = ['goal', 'rate', 'name', 'age', 'height', 'weight', 'activity', 'preferences', 'building', 'plan'] as const;
type StepId = (typeof STEPS)[number];

const copy: Record<StepId, { title: string; subtitle: string }> = {
  goal: { title: 'Was möchtest du erreichen?', subtitle: 'Danach richtet sich dein täglicher Energiebedarf.' },
  rate: { title: 'Wie schnell?', subtitle: 'Langsamer heißt mehr Muskeln behalten und weniger Verzicht im Alltag.' },
  name: { title: 'Wie dürfen wir dich nennen?', subtitle: 'Nur für die Begrüßung. Du kannst das überspringen.' },
  age: { title: 'Wie alt bist du?', subtitle: 'Das Alter beeinflusst deinen Grundumsatz.' },
  height: { title: 'Wie groß bist du?', subtitle: 'Ungefähre Angaben reichen völlig.' },
  weight: { title: 'Was wiegst du aktuell?', subtitle: 'Kein Urteil. Nur ein Startpunkt, der sich mitbewegt.' },
  activity: { title: 'Wie aktiv bist du?', subtitle: 'Denk an eine durchschnittliche Woche, nicht an deine beste.' },
  preferences: { title: 'Wie möchtest du essen?', subtitle: 'Wähle alles, was zu dir passt – oder nichts davon.' },
  building: { title: 'Wir stellen deinen Tag auf', subtitle: 'Einen Moment.' },
  plan: { title: 'Dein Startplan', subtitle: 'Flexibel ab dem ersten Bissen. Jede Mahlzeit stellt den Tag neu auf.' },
};

/** Steps the user may leave without answering. Everything else has a safe default. */
const skippableSteps = new Set<StepId>(['name', 'preferences']);

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { completeOnboarding } = useApp();
  const [stepIndex, setStepIndex] = useState(0);
  const [goal, setGoal] = useState('Gewicht reduzieren');
  const [displayName, setDisplayName] = useState('');
  const [age, setAge] = useState(29);
  const [height, setHeight] = useState(178);
  const [weight, setWeight] = useState(78);
  const [activity, setActivity] = useState('Leicht aktiv');
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
      if (STEPS[next] === 'rate' && goalRef.current === 'Gewicht halten') next += 1;
      return Math.min(STEPS.length - 1, next);
    });
  }, [clearAdvance]);

  const goBack = () => {
    void Haptics.selectionAsync();
    clearAdvance();
    setStepIndex((current) => {
      let previous = Math.max(0, current - 1);
      if (STEPS[previous] === 'rate' && goalRef.current === 'Gewicht halten') previous -= 1;
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
    displayName: displayName.trim() || 'Du',
    goal: goal === 'Gewicht halten' ? 'maintain' : goal === 'Stärker werden' ? 'gain' : 'lose',
    age,
    heightCm: height,
    weightKg: weight,
    activityLevel: activity === 'Meist sitzend' ? 'low' : activity === 'Sehr aktiv' ? 'high' : 'light',
    weeklyRateKg: weeklyRate,
    preferences,
    completedAt: null,
  }), [activity, age, displayName, goal, height, preferences, weeklyRate, weight]);
  const startingTargets = useMemo(() => calculateDailyTargets(draftProfile), [draftProfile]);

  const acceptConsent = async () => {
    setConsentBusy(true);
    setConsentError(null);
    try {
      await recordWellnessConsent();
      await completeOnboarding(draftProfile);
      trackEvent('onboarding completed', { completion: skippedAnything ? 'skipped' : 'finished' });
      setShowConsent(false);
      router.replace('/(tabs)/scan');
    } catch {
      setConsentError('Das hat gerade nicht geklappt. Prüfe kurz deine Verbindung und tippe noch einmal.');
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
  const footerLabel = step === 'plan' ? 'Erste Mahlzeit scannen' : 'Weiter';

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityLabel="Zurück"
          accessibilityRole="button"
          accessibilityState={{ disabled: stepIndex === 0 }}
          disabled={stepIndex === 0}
          hitSlop={10}
          onPress={goBack}
          style={[styles.backButton, stepIndex === 0 && styles.invisible]}
        >
          <Ionicons color={colors.text} name="arrow-back" size={22} />
        </Pressable>
        <Text style={styles.stepLabel}>Schritt {stepIndex + 1} von {STEPS.length}</Text>
        {skippableSteps.has(step) ? (
          <Pressable accessibilityRole="button" hitSlop={10} onPress={skipStep}>
            <Text style={styles.skip}>Überspringen</Text>
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
              <ChoiceList choices={goalChoices} onSelect={(value) => selectAndAdvance(() => setGoal(value))} selected={goal} />
            ) : null}

            {step === 'rate' ? (
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
                        <Text style={styles.choiceTitle}>{weeklyRateLabel(draftProfile.goal, rate)}</Text>
                        <Text style={styles.choiceDetail}>
                          {rate === 0.25 ? 'Ruhig und gut durchzuhalten' : 'Zügig, verlangt mehr Disziplin'} · {draftProfile.goal === 'lose' ? '−' : '+'}{applied} kcal pro Tag
                        </Text>
                      </View>
                      <Ionicons color={active ? colors.accentDeep : colors.border} name={active ? 'checkmark-circle' : 'ellipse-outline'} size={24} />
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {step === 'name' ? (
              <View style={styles.nameField}>
                <TextInput
                  accessibilityLabel="Vorname"
                  autoCapitalize="words"
                  autoFocus
                  maxLength={40}
                  onChangeText={setDisplayName}
                  onSubmitEditing={goNext}
                  placeholder="Dein Vorname"
                  placeholderTextColor={colors.muted}
                  returnKeyType="done"
                  style={styles.nameInput}
                  value={displayName}
                />
              </View>
            ) : null}

            {step === 'age' ? (
              <NumberStep max={80} min={18} onChange={setAge} step={1} unit="Jahre" value={age} />
            ) : null}
            {step === 'height' ? (
              <NumberStep max={220} min={130} onChange={setHeight} step={1} unit="cm" value={height} />
            ) : null}
            {step === 'weight' ? (
              <NumberStep max={200} min={40} onChange={setWeight} step={1} unit="kg" value={weight} />
            ) : null}

            {step === 'activity' ? (
              <ChoiceList choices={activityChoices} onSelect={(value) => selectAndAdvance(() => setActivity(value))} selected={activity} />
            ) : null}

            {step === 'preferences' ? (
              <View style={styles.chips}>
                {[...preferenceChoices, { id: 'none', label: 'Keine Präferenz' }].map((item) => {
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

            {step === 'building' ? <BuildingState goal={goal} /> : null}
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
            <Text accessibilityRole="header" style={styles.consentTitle}>Deine Daten bleiben deine</Text>
            <Text style={styles.consentText}>Ich willige ausdrücklich ein, dass Kandro meine Ernährungs-, Ziel- und Mahlzeitendaten verarbeitet, um Tagesstände und Empfehlungen bereitzustellen. Ich kann das jederzeit widerrufen und meinen Account samt Daten löschen.</Text>
            <View style={styles.consentLinks}>
              <Pressable accessibilityRole="link" onPress={() => { setShowConsent(false); router.push('/privacy'); }}><Text style={styles.consentLink}>Datenschutz lesen</Text></Pressable>
              <Pressable accessibilityRole="link" onPress={() => { setShowConsent(false); router.push('/terms'); }}><Text style={styles.consentLink}>Bedingungen lesen</Text></Pressable>
            </View>
            {consentError ? <Text accessibilityLiveRegion="assertive" style={styles.consentError}>{consentError}</Text> : null}
            <PrimaryButton disabled={consentBusy} icon="checkmark" label={consentBusy ? 'Einen Moment …' : 'Einverstanden, los geht’s'} onPress={() => void acceptConsent()} />
            <PrimaryButton disabled={consentBusy} label="Zurück" onPress={() => setShowConsent(false)} variant="ghost" />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function isChoiceStep(step: StepId) {
  return step === 'goal' || step === 'rate' || step === 'activity';
}

function ChoiceList({ choices, onSelect, selected }: { choices: Choice[]; onSelect: (choice: string) => void; selected: string }) {
  return (
    <View style={styles.choiceList}>
      {choices.map((choice) => {
        const active = choice.label === selected;
        return (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            key={choice.label}
            onPress={() => onSelect(choice.label)}
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
function NumberStep({ max, min, onChange, step, unit, value }: { max: number; min: number; onChange: (value: number) => void; step: number; unit: string; value: number }) {
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

  return (
    <View style={styles.numberStep}>
      <StepperButton icon="remove" label={`${unit} verringern`} onPressIn={() => start(-1)} onPressOut={stop} />
      <View style={styles.numberCenter}>
        <Text adjustsFontSizeToFit numberOfLines={1} style={styles.number}>{value}</Text>
        <Text style={styles.numberUnit}>{unit}</Text>
      </View>
      <StepperButton icon="add" label={`${unit} erhöhen`} onPressIn={() => start(1)} onPressOut={stop} />
    </View>
  );
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
  return (
    <View style={styles.buildingCard}>
      <View style={styles.orbit}>
        <View style={styles.orbitInner}>
          <Ionicons color={colors.text} name="sparkles" size={28} />
        </View>
      </View>
      <Text style={styles.buildingTitle}>Ein flexibler Plan statt eines starren Menüs</Text>
      <Text style={styles.buildingText}>Für „{goal}“ bleibt Protein im Fokus, während sich der Rest nach jeder Mahlzeit anpasst.</Text>
    </View>
  );
}

function StartingPlan({ limited, profile, targets }: { limited: boolean; profile: UserProfile; targets: ReturnType<typeof calculateDailyTargets> }) {
  return (
    <View style={styles.startingCard}>
      <Text style={styles.cardEyebrow}>TAGESZIEL</Text>
      <Text style={styles.calories}>{new Intl.NumberFormat('de-DE').format(targets.calories)}</Text>
      <Text style={styles.caloriesLabel}>Kilokalorien</Text>
      <View style={styles.divider} />
      <View style={styles.planStats}>
        <View style={styles.planStat}>
          <Text numberOfLines={2} style={styles.planStatValue}>{targets.protein} g</Text>
          <Text style={styles.planStatLabel}>Protein</Text>
        </View>
        <View style={styles.planStat}>
          <Text numberOfLines={2} style={styles.planStatValue}>{estimatedPace(profile.goal, profile.weeklyRateKg)}</Text>
          <Text style={styles.planStatLabel}>geschätztes Tempo</Text>
        </View>
        <View style={styles.planStat}>
          <Text numberOfLines={2} style={styles.planStatValue}>Flexibel</Text>
          <Text style={styles.planStatLabel}>Essenszeiten</Text>
        </View>
      </View>
      <View style={styles.adaptsRow}>
        <Ionicons color={colors.accentDeep} name="sync" size={18} />
        <Text style={styles.adaptsText}>Dein Tag stellt sich nach jeder Mahlzeit neu auf</Text>
      </View>
      {limited ? (
        <View style={styles.limitRow}>
          <Ionicons color={colors.attention} name="information-circle-outline" size={16} />
          <Text style={styles.limitText}>
            Dein gewähltes Tempo würde unter eine sichere Untergrenze führen. Kandro hat dein Ziel entsprechend angehoben.
          </Text>
        </View>
      ) : null}
      <Text style={styles.safetyText}>Diese Ziele sind Schätzwerte für allgemeines Wohlbefinden und kein medizinischer Rat. Kandro vermeidet extreme Zielwerte. Bei gesundheitlichen Beschwerden besprich Veränderungen bitte ärztlich.</Text>
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
  numberButton: { width: 64, height: 64, borderRadius: 32, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  numberButtonPressed: { backgroundColor: colors.neutralSoft, transform: [{ scale: 0.94 }] },
  numberCenter: { flex: 1, minWidth: 0, alignItems: 'center' },
  number: { color: colors.text, fontSize: 76, lineHeight: 86, fontWeight: '700', letterSpacing: -2.5, fontVariant: ['tabular-nums'] },
  numberUnit: { color: colors.muted, fontSize: 15, fontWeight: '600', marginTop: -4 },
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
