import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton, ProgressBar } from '@/components/ui';
import { colors, radii, spacing } from '@/constants/theme';

type Choice = { label: string; detail: string; icon: keyof typeof Ionicons.glyphMap };

const goalChoices: Choice[] = [
  { label: 'Lose weight', detail: 'A steady, sustainable pace', icon: 'trending-down' },
  { label: 'Maintain', detail: 'Keep your current momentum', icon: 'remove' },
  { label: 'Gain strength', detail: 'Fuel muscle and performance', icon: 'trending-up' },
];

const activityChoices: Choice[] = [
  { label: 'Mostly seated', detail: 'Little structured movement', icon: 'desktop-outline' },
  { label: 'Lightly active', detail: '1–3 workouts each week', icon: 'walk-outline' },
  { label: 'Very active', detail: '4+ workouts each week', icon: 'barbell-outline' },
];

const TOTAL_STEPS = 8;

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState('Lose weight');
  const [age, setAge] = useState(29);
  const [height, setHeight] = useState(178);
  const [weight, setWeight] = useState(78);
  const [activity, setActivity] = useState('Lightly active');
  const [preferences, setPreferences] = useState<string[]>(['High protein']);

  const title = useMemo(
    () => [
      'What’s your goal?',
      'How old are you?',
      'What’s your height?',
      'What’s your current weight?',
      'How active are you?',
      'How do you like to eat?',
      'Your plan is adapting',
      'Your starting plan',
    ][step],
    [step],
  );

  const next = () => {
    void Haptics.selectionAsync();
    if (step === TOTAL_STEPS - 1) {
      router.replace('/(tabs)/today');
      return;
    }
    setStep((current) => current + 1);
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
          accessibilityLabel="Go back"
          disabled={step === 0}
          onPress={back}
          style={[styles.backButton, step === 0 && styles.hidden]}
        >
          <Ionicons color={colors.text} name="arrow-back" size={22} />
        </Pressable>
        <Text style={styles.stepLabel}>{step + 1} of {TOTAL_STEPS}</Text>
        <Pressable onPress={() => router.replace('/(tabs)/today')}>
          <Text style={styles.skip}>Skip</Text>
        </Pressable>
      </View>

      <ProgressBar value={(step + 1) / TOTAL_STEPS} />

      <View style={styles.content}>
        <View style={styles.headingBlock}>
          <View style={styles.brandMark}>
            <Ionicons color={colors.text} name="leaf" size={22} />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{getSubtitle(step)}</Text>
        </View>

        <View style={styles.body}>
          {step === 0 ? (
            <ChoiceList choices={goalChoices} selected={goal} onSelect={setGoal} />
          ) : null}
          {step === 1 ? <NumberStep value={age} unit="years" onChange={setAge} /> : null}
          {step === 2 ? <NumberStep value={height} unit="cm" onChange={setHeight} /> : null}
          {step === 3 ? <NumberStep value={weight} unit="kg" onChange={setWeight} /> : null}
          {step === 4 ? (
            <ChoiceList choices={activityChoices} selected={activity} onSelect={setActivity} />
          ) : null}
          {step === 5 ? (
            <View style={styles.chips}>
              {['High protein', 'Vegetarian', 'No pork', 'Dairy-free', 'Quick meals', 'No preference'].map((item) => {
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
          {step === 6 ? <PlanCalculation goal={goal} activity={activity} /> : null}
          {step === 7 ? <StartingPlan /> : null}
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.disclaimer}>Targets are estimates for general wellness, not medical advice.</Text>
        <PrimaryButton
          icon={step === TOTAL_STEPS - 1 ? 'camera' : 'arrow-forward'}
          label={step === TOTAL_STEPS - 1 ? 'Scan my first meal' : 'Continue'}
          onPress={next}
        />
      </View>
    </SafeAreaView>
  );
}

function getSubtitle(step: number) {
  return [
    'We’ll use this to shape your daily energy target.',
    'A quick estimate is enough. You can change this later.',
    'This helps us estimate your baseline needs.',
    'We’ll focus on a realistic pace, never punishment.',
    'Think about an average week, not your best one.',
    'Choose anything that should shape your suggestions.',
    'Balancing energy, protein and a pace you can keep.',
    'Flexible from the first bite. Every meal replans your day.',
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

function NumberStep({ value, unit, onChange }: { value: number; unit: string; onChange: (value: number) => void }) {
  return (
    <View style={styles.numberStep}>
      <Pressable onPress={() => onChange(value - 1)} style={styles.numberButton}>
        <Ionicons color={colors.text} name="remove" size={28} />
      </Pressable>
      <View style={styles.numberCenter}>
        <Text style={styles.number}>{value}</Text>
        <Text style={styles.numberUnit}>{unit}</Text>
      </View>
      <Pressable onPress={() => onChange(value + 1)} style={styles.numberButton}>
        <Ionicons color={colors.text} name="add" size={28} />
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
      <Text style={styles.calculatingTitle}>A flexible plan, not a rigid menu</Text>
      <Text style={styles.calculatingText}>Based on “{goal}” and “{activity}”, protein stays high while calories adapt after every meal.</Text>
      <View style={styles.signalRow}>
        <Signal label="Sustainable pace" />
        <Signal label="High protein" />
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
      <Text style={styles.cardEyebrow}>DAILY TARGET</Text>
      <Text style={styles.calories}>2,230</Text>
      <Text style={styles.caloriesLabel}>kilocalories</Text>
      <View style={styles.divider} />
      <View style={styles.planStats}>
        <View style={styles.planStat}>
          <Text style={styles.planStatValue}>140 g</Text>
          <Text style={styles.planStatLabel}>Protein</Text>
        </View>
        <View style={styles.planStat}>
          <Text style={styles.planStatValue}>0.4 kg</Text>
          <Text style={styles.planStatLabel}>Est. per week</Text>
        </View>
        <View style={styles.planStat}>
          <Text style={styles.planStatValue}>Flexible</Text>
          <Text style={styles.planStatLabel}>Meal timing</Text>
        </View>
      </View>
      <View style={styles.adaptsRow}>
        <Ionicons color={colors.accentDeep} name="sync" size={18} />
        <Text style={styles.adaptsText}>Your day replans after every meal</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 20 },
  topBar: { height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center' },
  hidden: { opacity: 0 },
  stepLabel: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  skip: { width: 40, color: colors.muted, fontSize: 14, fontWeight: '600', textAlign: 'right' },
  content: { flex: 1, paddingTop: 26 },
  headingBlock: { gap: 10 },
  brandMark: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
  title: { color: colors.text, fontSize: 34, lineHeight: 40, fontWeight: '700', letterSpacing: -1.1 },
  subtitle: { color: colors.muted, fontSize: 16, lineHeight: 23, maxWidth: 360 },
  body: { flex: 1, justifyContent: 'center', paddingVertical: 22 },
  footer: { gap: 12, paddingBottom: 12 },
  disclaimer: { color: colors.muted, fontSize: 11, lineHeight: 16, textAlign: 'center' },
  choiceList: { gap: 12 },
  choice: { minHeight: 82, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 13 },
  choiceActive: { borderColor: colors.accentDeep, backgroundColor: colors.accentSoft },
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { minHeight: 48, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 17, flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  calculatingCard: { borderRadius: radii.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 24, alignItems: 'center', gap: spacing.md },
  orbit: { width: 100, height: 100, borderRadius: 50, borderWidth: 1, borderColor: colors.accent, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft },
  orbitInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  calculatingTitle: { color: colors.text, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  calculatingText: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  signalRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  signal: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.successSoft, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 7 },
  signalText: { color: colors.success, fontSize: 12, fontWeight: '700' },
  startingCard: { borderRadius: radii.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 24, alignItems: 'center' },
  cardEyebrow: { color: colors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1.3 },
  calories: { color: colors.text, fontSize: 62, lineHeight: 70, fontWeight: '700', letterSpacing: -2, marginTop: 8 },
  caloriesLabel: { color: colors.muted, fontSize: 14 },
  divider: { width: '100%', height: 1, backgroundColor: colors.border, marginVertical: 22 },
  planStats: { width: '100%', flexDirection: 'row' },
  planStat: { flex: 1, alignItems: 'center', gap: 5 },
  planStatValue: { color: colors.text, fontSize: 15, fontWeight: '700' },
  planStatLabel: { color: colors.muted, fontSize: 11, textAlign: 'center' },
  adaptsRow: { marginTop: 22, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: colors.accentSoft, borderRadius: radii.pill, paddingHorizontal: 13, paddingVertical: 9 },
  adaptsText: { color: colors.accentDeep, fontSize: 12, fontWeight: '700' },
});
