import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { KandroMark } from '@/components/KandroMark';
import { PrimaryButton, ProgressBar } from '@/components/ui';
import { colors, radii, spacing } from '@/constants/theme';
import { useApp } from '@/context/AppContext';
import { recordWellnessConsent } from '@/services/consent';
import { calculateDailyTargets, estimatedPace } from '@/services/personalization';
import { trackEvent } from '@/services/telemetry';
import { NutritionGoal, UserProfile } from '@/types/nutrition';

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

const TOTAL_STEPS = 6;

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { completeOnboarding } = useApp();
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState('Gewicht reduzieren');
  const [displayName, setDisplayName] = useState('');
  const [age, setAge] = useState(29);
  const [height, setHeight] = useState(178);
  const [weight, setWeight] = useState(78);
  const [activity, setActivity] = useState('Leicht aktiv');
  const [preferences, setPreferences] = useState<string[]>(['high-protein']);
  const [showConsent, setShowConsent] = useState(false);
  const [consentBusy, setConsentBusy] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [skippedPersonalization, setSkippedPersonalization] = useState(false);

  const title = useMemo(
    () => [
      'Was möchtest du erreichen?',
      'Ein paar Angaben zu dir',
      'Wie aktiv bist du?',
      'Wie möchtest du essen?',
      'Dein Plan stellt sich auf',
      'Dein Startplan',
    ][step],
    [step],
  );

  const draftProfile = useMemo<UserProfile>(() => ({
    displayName: displayName.trim() || 'Du',
    goal: goal === 'Gewicht halten' ? 'maintain' : goal === 'Stärker werden' ? 'gain' : 'lose',
    age,
    heightCm: height,
    weightKg: weight,
    activityLevel: activity === 'Meist sitzend' ? 'low' : activity === 'Sehr aktiv' ? 'high' : 'light',
    preferences,
    completedAt: null,
  }), [activity, age, displayName, goal, height, preferences, weight]);
  const startingTargets = useMemo(() => calculateDailyTargets(draftProfile), [draftProfile]);

  const next = () => {
    void Haptics.selectionAsync();
    if (step === TOTAL_STEPS - 1) {
      setShowConsent(true);
      return;
    }
    setStep((current) => current + 1);
  };

  const skip = () => {
    setSkippedPersonalization(true);
    setStep(TOTAL_STEPS - 1);
  };

  const acceptConsent = async () => {
    setConsentBusy(true);
    setConsentError(null);
    try {
      await recordWellnessConsent();
      await completeOnboarding(draftProfile);
      trackEvent('onboarding completed', { completion: skippedPersonalization ? 'skipped' : 'finished' });
      setShowConsent(false);
      router.replace('/(tabs)/scan');
    } catch {
      setConsentError('Die Einwilligung konnte gerade nicht gespeichert werden. Prüfe deine Verbindung und versuche es erneut.');
    } finally {
      setConsentBusy(false);
    }
  };

  const back = () => {
    void Haptics.selectionAsync();
    setStep((current) => Math.max(0, current - 1));
  };

  const togglePreference = (preference: string) => {
    setPreferences((current) =>
      current.includes(preference)
        ? current.filter((item) => item !== preference)
        : [...current, preference],
    );
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityLabel="Zurück"
          accessibilityRole="button"
          accessibilityState={{ disabled: step === 0 }}
          disabled={step === 0}
          onPress={back}
          style={[styles.backButton, step === 0 && styles.hidden]}
        >
          <Ionicons color={colors.text} name="arrow-back" size={22} />
        </Pressable>
        <Text style={styles.stepLabel}>{step + 1} von {TOTAL_STEPS}</Text>
        {step < TOTAL_STEPS - 1 ? (
          <Pressable accessibilityRole="button" onPress={skip}>
            <Text style={styles.skip}>Überspringen</Text>
          </Pressable>
        ) : <View style={styles.skipPlaceholder} />}
      </View>

      <ProgressBar value={(step + 1) / TOTAL_STEPS} />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.scroll}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.scroll}
        >
          <View style={styles.headingBlock}>
            <View style={styles.brandMark}><KandroMark size={46} /></View>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{getSubtitle(step)}</Text>
          </View>

          <View style={styles.body}>
            {step === 0 ? (
              <ChoiceList choices={goalChoices} selected={goal} onSelect={setGoal} />
            ) : null}
            {step === 1 ? (
              <ProfileNumbers age={age} displayName={displayName} height={height} setAge={setAge} setDisplayName={setDisplayName} setHeight={setHeight} setWeight={setWeight} weight={weight} />
            ) : null}
            {step === 2 ? (
              <ChoiceList choices={activityChoices} selected={activity} onSelect={setActivity} />
            ) : null}
            {step === 3 ? (
              <View style={styles.chips}>
                {[...preferenceChoices, { id: 'none', label: 'Keine Präferenz' }].map((item) => {
                  const selected = item.id === 'none' ? preferences.length === 0 : preferences.includes(item.id);
                  return (
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                      key={item.id}
                      onPress={() => item.id === 'none' ? setPreferences([]) : togglePreference(item.id)}
                      style={[styles.chip, selected && styles.chipSelected]}
                    >
                      {selected ? <Ionicons color={colors.text} name="checkmark" size={17} /> : null}
                      <Text style={styles.chipText}>{item.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
            {step === 4 ? <PlanCalculation goal={goal} activity={activity} /> : null}
            {step === 5 ? <StartingPlan goal={draftProfile.goal} targets={startingTargets} /> : null}
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <Text style={styles.disclaimer}>Ziele sind Schätzwerte für allgemeines Wohlbefinden und kein medizinischer Rat.</Text>
          <PrimaryButton
            icon={step === TOTAL_STEPS - 1 ? 'camera' : 'arrow-forward'}
            label={step === TOTAL_STEPS - 1 ? 'Erste Mahlzeit scannen' : 'Weiter'}
            onPress={next}
          />
        </View>
      </KeyboardAvoidingView>

      <Modal animationType="fade" onRequestClose={() => setShowConsent(false)} transparent visible={showConsent}>
        <View style={styles.modalScrim}>
          <View accessibilityViewIsModal style={[styles.consentSheet, { paddingBottom: insets.bottom + 18 }]}>
            <View style={styles.consentIcon}><Ionicons color={colors.text} name="shield-checkmark-outline" size={26} /></View>
            <Text accessibilityRole="header" style={styles.consentTitle}>Deine Daten, deine Entscheidung</Text>
            <Text style={styles.consentText}>Ich willige ausdrücklich ein, dass Kandro meine Ernährungs-, Ziel- und Mahlzeitendaten verarbeitet, um Tagesstände und Empfehlungen bereitzustellen. Ich kann diese Einwilligung für die Zukunft widerrufen und meinen Account samt Daten löschen.</Text>
            <View style={styles.consentLinks}>
              <Pressable accessibilityRole="link" onPress={() => { setShowConsent(false); router.push('/privacy'); }}><Text style={styles.consentLink}>Datenschutz lesen</Text></Pressable>
              <Pressable accessibilityRole="link" onPress={() => { setShowConsent(false); router.push('/terms'); }}><Text style={styles.consentLink}>Bedingungen lesen</Text></Pressable>
            </View>
            {consentError ? <Text accessibilityLiveRegion="assertive" style={styles.consentError}>{consentError}</Text> : null}
            <PrimaryButton disabled={consentBusy} icon="checkmark" label={consentBusy ? 'Wird gespeichert …' : 'Einwilligen und starten'} onPress={() => void acceptConsent()} />
            <PrimaryButton disabled={consentBusy} label="Noch nicht" onPress={() => setShowConsent(false)} variant="ghost" />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function getSubtitle(step: number) {
  return [
    'Damit richten wir deinen täglichen Energiebedarf aus.',
    'Ungefähre Angaben reichen. Du kannst sie später ändern.',
    'Denk an eine durchschnittliche Woche, nicht an deine beste.',
    'Wähle alles, was deine Vorschläge beeinflussen soll.',
    'Energie, Protein und ein Tempo, das zu deinem Alltag passt.',
    'Flexibel ab dem ersten Bissen. Jede Mahlzeit stellt den Tag neu auf.',
  ][step];
}

function ChoiceList({ choices, selected, onSelect }: { choices: Choice[]; selected: string; onSelect: (choice: string) => void }) {
  return (
    <View style={styles.choiceList}>
      {choices.map((choice) => {
        const active = choice.label === selected;
        return (
          <Pressable accessibilityRole="radio" accessibilityState={{ selected: active }} key={choice.label} onPress={() => onSelect(choice.label)} style={[styles.choice, active && styles.choiceActive]}>
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

function ProfileNumbers({ age, displayName, height, setAge, setDisplayName, setHeight, setWeight, weight }: { age: number; displayName: string; height: number; setAge: (value: number) => void; setDisplayName: (value: string) => void; setHeight: (value: number) => void; setWeight: (value: number) => void; weight: number }) {
  return (
    <View style={styles.metrics}>
      <View style={styles.nameField}>
        <Text style={styles.nameLabel}>Vorname (optional)</Text>
        <TextInput
          accessibilityLabel="Vorname"
          autoCapitalize="words"
          maxLength={40}
          onChangeText={setDisplayName}
          placeholder="z. B. Alex"
          placeholderTextColor={colors.muted}
          style={styles.nameInput}
          value={displayName}
        />
      </View>
      <MetricRow label="Alter" max={80} min={18} onChange={setAge} unit="Jahre" value={age} />
      <MetricRow label="Größe" max={220} min={130} onChange={setHeight} unit="cm" value={height} />
      <MetricRow label="Gewicht" max={200} min={40} onChange={setWeight} unit="kg" value={weight} />
    </View>
  );
}

function MetricRow({ label, max, min, onChange, unit, value }: { label: string; max: number; min: number; onChange: (value: number) => void; unit: string; value: number }) {
  return (
    <View style={styles.metricRow}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Pressable accessibilityLabel={`${label} verringern`} accessibilityRole="button" onPress={() => onChange(Math.max(min, value - 1))} style={styles.metricButton}>
        <Ionicons color={colors.text} name="remove" size={20} />
      </Pressable>
      <Text style={styles.metricValue}>{value} <Text style={styles.metricUnit}>{unit}</Text></Text>
      <Pressable accessibilityLabel={`${label} erhöhen`} accessibilityRole="button" onPress={() => onChange(Math.min(max, value + 1))} style={styles.metricButton}>
        <Ionicons color={colors.text} name="add" size={20} />
      </Pressable>
    </View>
  );
}

function PlanCalculation({ goal, activity }: { goal: string; activity: string }) {
  return (
    <View style={styles.calculatingCard}>
      <View style={styles.orbit}>
        <View style={styles.orbitInner}>
          <Ionicons color={colors.text} name="sparkles" size={28} />
        </View>
      </View>
      <Text style={styles.calculatingTitle}>Ein flexibler Plan statt eines starren Menüs</Text>
      <Text style={styles.calculatingText}>Für „{goal}“ und „{activity}“ bleibt Protein im Fokus, während sich der Rest nach jeder Mahlzeit anpasst.</Text>
      <View style={styles.signalRow}>
        <Signal label="Nachhaltiges Tempo" />
        <Signal label="Protein im Blick" />
      </View>
    </View>
  );
}

function Signal({ label }: { label: string }) {
  return (
    <View style={styles.signal}>
      <Ionicons color={colors.success} name="checkmark-circle" size={17} />
      <Text style={styles.signalText}>{label}</Text>
    </View>
  );
}

function StartingPlan({ goal, targets }: { goal: NutritionGoal; targets: ReturnType<typeof calculateDailyTargets> }) {
  return (
    <View style={styles.startingCard}>
      <Text style={styles.cardEyebrow}>TAGESZIEL</Text>
      <Text style={styles.calories}>{new Intl.NumberFormat('de-DE').format(targets.calories)}</Text>
      <Text style={styles.caloriesLabel}>Kilokalorien</Text>
      <View style={styles.divider} />
      <View style={styles.planStats}>
        <View style={styles.planStat}>
          <Text style={styles.planStatValue}>{targets.protein} g</Text>
          <Text style={styles.planStatLabel}>Protein</Text>
        </View>
        <View style={styles.planStat}>
          <Text adjustsFontSizeToFit numberOfLines={1} style={styles.planStatValue}>{estimatedPace(goal)}</Text>
          <Text style={styles.planStatLabel}>geschätztes Tempo</Text>
        </View>
        <View style={styles.planStat}>
          <Text style={styles.planStatValue}>Flexibel</Text>
          <Text style={styles.planStatLabel}>Essenszeiten</Text>
        </View>
      </View>
      <View style={styles.adaptsRow}>
        <Ionicons color={colors.accentDeep} name="sync" size={18} />
        <Text style={styles.adaptsText}>Dein Tag stellt sich nach jeder Mahlzeit neu auf</Text>
      </View>
      <Text style={styles.safetyText}>Kandro vermeidet extreme Zielwerte. Wenn du gesundheitliche Beschwerden hast, besprich Veränderungen bitte ärztlich.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 20 },
  topBar: { height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center' },
  hidden: { opacity: 0 },
  stepLabel: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  skip: { minWidth: 92, color: colors.muted, fontSize: 13, fontWeight: '600', textAlign: 'right' },
  skipPlaceholder: { width: 92 },
  scroll: { flex: 1 },
  content: { flexGrow: 1, paddingTop: 26, paddingBottom: 8 },
  headingBlock: { gap: 10 },
  brandMark: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
  title: { color: colors.text, fontSize: 34, lineHeight: 40, fontWeight: '700', letterSpacing: -1.1 },
  subtitle: { color: colors.muted, fontSize: 16, lineHeight: 23, maxWidth: 360 },
  body: { flexGrow: 1, justifyContent: 'center', paddingVertical: 22 },
  footer: { gap: 12, paddingTop: 8, backgroundColor: colors.background },
  disclaimer: { color: colors.muted, fontSize: 11, lineHeight: 16, textAlign: 'center' },
  choiceList: { gap: 12 },
  choice: { minHeight: 82, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 13 },
  choiceActive: { borderColor: colors.accentDeep, backgroundColor: colors.neutralSoft },
  choiceIcon: { width: 48, height: 48, borderRadius: 18, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  choiceIconActive: { backgroundColor: colors.accent },
  choiceTextBlock: { flex: 1, gap: 3 },
  choiceTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  choiceDetail: { color: colors.muted, fontSize: 13 },
  metrics: { gap: 12 },
  nameField: { gap: 7 },
  nameLabel: { color: colors.text, fontSize: 13, fontWeight: '600' },
  nameInput: { minHeight: 48, borderRadius: radii.input, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, color: colors.text, fontSize: 16, paddingHorizontal: 14 },
  metricRow: { minHeight: 72, borderRadius: radii.card, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  metricLabel: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '600' },
  metricButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.neutralSoft, alignItems: 'center', justifyContent: 'center' },
  metricValue: { minWidth: 88, color: colors.text, fontSize: 18, fontWeight: '700', textAlign: 'center', fontVariant: ['tabular-nums'] },
  metricUnit: { color: colors.muted, fontSize: 12, fontWeight: '500' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { minHeight: 48, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 17, flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  calculatingCard: { borderRadius: radii.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 24, alignItems: 'center', gap: spacing.md },
  orbit: { width: 100, height: 100, borderRadius: 50, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.neutralSoft },
  orbitInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  calculatingTitle: { color: colors.text, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  calculatingText: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  signalRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  signal: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.successSoft, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 7 },
  signalText: { color: colors.success, fontSize: 12, fontWeight: '700' },
  startingCard: { borderRadius: radii.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 24, alignItems: 'center' },
  cardEyebrow: { color: colors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1.3 },
  calories: { color: colors.text, fontSize: 56, lineHeight: 64, fontWeight: '700', letterSpacing: -2, marginTop: 8, fontVariant: ['tabular-nums'] },
  caloriesLabel: { color: colors.muted, fontSize: 14 },
  divider: { width: '100%', height: 1, backgroundColor: colors.border, marginVertical: 22 },
  planStats: { width: '100%', flexDirection: 'row' },
  planStat: { flex: 1, minWidth: 0, paddingHorizontal: 4, alignItems: 'center', gap: 5 },
  planStatValue: { color: colors.text, fontSize: 15, fontWeight: '700' },
  planStatLabel: { color: colors.muted, fontSize: 11, textAlign: 'center' },
  adaptsRow: { marginTop: 22, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: colors.neutralSoft, borderRadius: radii.pill, paddingHorizontal: 13, paddingVertical: 9 },
  adaptsText: { color: colors.accentDeep, fontSize: 12, fontWeight: '700' },
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
