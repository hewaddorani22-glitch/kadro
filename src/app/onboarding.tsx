import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { KadroMark } from '@/components/KadroMark';
import { PrimaryButton, ProgressBar } from '@/components/ui';
import { colors, radii, spacing } from '@/constants/theme';
import { trackEvent } from '@/services/telemetry';

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

const TOTAL_STEPS = 6;

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState('Gewicht reduzieren');
  const [age, setAge] = useState(29);
  const [height, setHeight] = useState(178);
  const [weight, setWeight] = useState(78);
  const [activity, setActivity] = useState('Leicht aktiv');
  const [preferences, setPreferences] = useState<string[]>(['Proteinreich']);

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

  const next = () => {
    void Haptics.selectionAsync();
    if (step === TOTAL_STEPS - 1) {
      trackEvent('onboarding completed', { completion: 'finished' });
      router.replace('/(tabs)/scan');
      return;
    }
    setStep((current) => current + 1);
  };

  const skip = () => {
    trackEvent('onboarding completed', { completion: 'skipped' });
    router.replace('/(tabs)/today');
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
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityLabel="Zurück"
          disabled={step === 0}
          onPress={back}
          style={[styles.backButton, step === 0 && styles.hidden]}
        >
          <Ionicons color={colors.text} name="arrow-back" size={22} />
        </Pressable>
        <Text style={styles.stepLabel}>{step + 1} von {TOTAL_STEPS}</Text>
        <Pressable onPress={skip}>
          <Text style={styles.skip}>Überspringen</Text>
        </Pressable>
      </View>

      <ProgressBar value={(step + 1) / TOTAL_STEPS} />

      <View style={styles.content}>
        <View style={styles.headingBlock}>
          <View style={styles.brandMark}><KadroMark size={46} /></View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{getSubtitle(step)}</Text>
        </View>

        <View style={styles.body}>
          {step === 0 ? (
            <ChoiceList choices={goalChoices} selected={goal} onSelect={setGoal} />
          ) : null}
          {step === 1 ? (
            <ProfileNumbers age={age} height={height} setAge={setAge} setHeight={setHeight} setWeight={setWeight} weight={weight} />
          ) : null}
          {step === 2 ? (
            <ChoiceList choices={activityChoices} selected={activity} onSelect={setActivity} />
          ) : null}
          {step === 3 ? (
            <View style={styles.chips}>
              {['Proteinreich', 'Vegetarisch', 'Ohne Schwein', 'Laktosefrei', 'Schnelle Mahlzeiten', 'Keine Präferenz'].map((item) => {
                const selected = preferences.includes(item);
                return (
                  <Pressable
                    key={item}
                    onPress={() => togglePreference(item)}
                    style={[styles.chip, selected && styles.chipSelected]}
                  >
                    {selected ? <Ionicons color={colors.text} name="checkmark" size={17} /> : null}
                    <Text style={styles.chipText}>{item}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          {step === 4 ? <PlanCalculation goal={goal} activity={activity} /> : null}
          {step === 5 ? <StartingPlan /> : null}
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.disclaimer}>Ziele sind Schätzwerte für allgemeines Wohlbefinden und kein medizinischer Rat.</Text>
        <PrimaryButton
          icon={step === TOTAL_STEPS - 1 ? 'camera' : 'arrow-forward'}
          label={step === TOTAL_STEPS - 1 ? 'Erste Mahlzeit scannen' : 'Weiter'}
          onPress={next}
        />
      </View>
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
          <Pressable key={choice.label} onPress={() => onSelect(choice.label)} style={[styles.choice, active && styles.choiceActive]}>
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

function ProfileNumbers({ age, height, setAge, setHeight, setWeight, weight }: { age: number; height: number; setAge: (value: number) => void; setHeight: (value: number) => void; setWeight: (value: number) => void; weight: number }) {
  return (
    <View style={styles.metrics}>
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
      <Pressable accessibilityLabel={`${label} verringern`} onPress={() => onChange(Math.max(min, value - 1))} style={styles.metricButton}>
        <Ionicons color={colors.text} name="remove" size={20} />
      </Pressable>
      <Text style={styles.metricValue}>{value} <Text style={styles.metricUnit}>{unit}</Text></Text>
      <Pressable accessibilityLabel={`${label} erhöhen`} onPress={() => onChange(Math.min(max, value + 1))} style={styles.metricButton}>
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

function StartingPlan() {
  return (
    <View style={styles.startingCard}>
      <Text style={styles.cardEyebrow}>TAGESZIEL</Text>
      <Text style={styles.calories}>2.230</Text>
      <Text style={styles.caloriesLabel}>Kilokalorien</Text>
      <View style={styles.divider} />
      <View style={styles.planStats}>
        <View style={styles.planStat}>
          <Text style={styles.planStatValue}>140 g</Text>
          <Text style={styles.planStatLabel}>Protein</Text>
        </View>
        <View style={styles.planStat}>
          <Text style={styles.planStatValue}>0,4 kg</Text>
          <Text style={styles.planStatLabel}>ca. pro Woche</Text>
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
      <Text style={styles.safetyText}>Kadro vermeidet extreme Zielwerte. Wenn du gesundheitliche Beschwerden hast, besprich Veränderungen bitte ärztlich.</Text>
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
  content: { flex: 1, paddingTop: 26 },
  headingBlock: { gap: 10 },
  brandMark: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
  title: { color: colors.text, fontSize: 34, lineHeight: 40, fontWeight: '700', letterSpacing: -1.1 },
  subtitle: { color: colors.muted, fontSize: 16, lineHeight: 23, maxWidth: 360 },
  body: { flex: 1, justifyContent: 'center', paddingVertical: 22 },
  footer: { gap: 12, paddingBottom: 12 },
  disclaimer: { color: colors.muted, fontSize: 11, lineHeight: 16, textAlign: 'center' },
  choiceList: { gap: 12 },
  choice: { minHeight: 82, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 13 },
  choiceActive: { borderColor: colors.accentDeep, backgroundColor: colors.neutralSoft },
  choiceIcon: { width: 48, height: 48, borderRadius: 18, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  choiceIconActive: { backgroundColor: colors.accent },
  choiceTextBlock: { flex: 1, gap: 3 },
  choiceTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  choiceDetail: { color: colors.muted, fontSize: 13 },
  numberStep: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 28 },
  numberButton: { width: 58, height: 58, borderRadius: 29, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  numberCenter: { minWidth: 128, alignItems: 'center' },
  number: { color: colors.text, fontSize: 68, lineHeight: 76, fontWeight: '700', letterSpacing: -2 },
  numberUnit: { color: colors.muted, fontSize: 15, fontWeight: '600' },
  metrics: { gap: 12 },
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
  planStat: { flex: 1, alignItems: 'center', gap: 5 },
  planStatValue: { color: colors.text, fontSize: 15, fontWeight: '700' },
  planStatLabel: { color: colors.muted, fontSize: 11, textAlign: 'center' },
  adaptsRow: { marginTop: 22, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: colors.neutralSoft, borderRadius: radii.pill, paddingHorizontal: 13, paddingVertical: 9 },
  adaptsText: { color: colors.accentDeep, fontSize: 12, fontWeight: '700' },
  safetyText: { color: colors.muted, fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 16 },
});
