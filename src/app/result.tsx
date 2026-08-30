import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, ConfidenceBadge, Eyebrow, MealPhoto, PrimaryButton, Screen, SectionTitle } from '@/components/ui';
import { colors, radii } from '@/constants/theme';
import { useApp } from '@/context/AppContext';
import { getRemaining } from '@/services/mockNutrition';

export default function ResultScreen() {
  const router = useRouter();
  const { consumed, hasLoggedScan, logScannedMeal, photoUri, remaining, scannedMeal, targets } = useApp();
  const projected = hasLoggedScan
    ? remaining
    : getRemaining(targets, {
      calories: consumed.calories + scannedMeal.calories,
      protein: consumed.protein + scannedMeal.protein,
      carbs: consumed.carbs + scannedMeal.carbs,
      fat: consumed.fat + scannedMeal.fat,
    });

  const showOptions = () => {
    logScannedMeal();
    router.replace({ pathname: '/(tabs)/plan', params: { context: 'home', fromScan: '1' } });
  };

  const saveForLater = () => {
    logScannedMeal();
    router.replace('/(tabs)/today');
  };

  return (
    <Screen>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.iconButton}>
          <Ionicons color={colors.text} name="arrow-back" size={22} />
        </Pressable>
        <Text style={styles.topTitle}>Meal result</Text>
        <Pressable style={styles.iconButton}>
          <Ionicons color={colors.text} name="share-outline" size={21} />
        </Pressable>
      </View>

      <MealPhoto height={270} uri={photoUri} />

      <View style={styles.resultHeading}>
        <View style={styles.titleRow}>
          <View style={styles.mealCopy}>
            <Text style={styles.mealTitle}>{scannedMeal.title}</Text>
            <ConfidenceBadge />
          </View>
          <View style={styles.calorieBlock}>
            <Text style={styles.calories}>~{scannedMeal.calories}</Text>
            <Text style={styles.calorieLabel}>kcal estimated</Text>
          </View>
        </View>
      </View>

      <View style={styles.macros}>
        <MacroResult label="Protein" value={scannedMeal.protein} unit="g" />
        <MacroResult label="Carbs" value={scannedMeal.carbs} unit="g" />
        <MacroResult label="Fat" value={scannedMeal.fat} unit="g" />
        <MacroResult label="Fiber" value={scannedMeal.fiber ?? 8} unit="g" />
      </View>

      <View style={styles.section}>
        <SectionTitle action={<Pressable onPress={() => router.replace('/confirm')}><Text style={styles.edit}>Edit</Text></Pressable>}>Ingredients detected</SectionTitle>
        <Card style={styles.ingredientsCard}>
          {scannedMeal.items.filter((item) => item.included).map((item, index, list) => (
            <View key={item.id}>
              <View style={styles.ingredientRow}>
                <View style={styles.ingredientCheck}><Ionicons color={colors.success} name="checkmark" size={15} /></View>
                <Text style={styles.ingredientName}>{item.name}</Text>
                <Text style={styles.ingredientAmount}>{item.amountG} g</Text>
              </View>
              {index < list.length - 1 ? <View style={styles.divider} /> : null}
            </View>
          ))}
        </Card>
      </View>

      <Card style={styles.dayCard}>
        <View style={styles.dayHeader}>
          <View style={styles.dayIcon}><Ionicons color={colors.text} name="sunny-outline" size={23} /></View>
          <View style={styles.dayHeading}>
            <Eyebrow>Your day after this meal</Eyebrow>
            <Text style={styles.onTrack}>You’re still on track</Text>
          </View>
          <Ionicons color={colors.success} name="checkmark-circle" size={25} />
        </View>
        <View style={styles.remainingRow}>
          <View>
            <Text style={styles.remainingValue}>{projected.calories.toLocaleString('en-US')}</Text>
            <Text style={styles.remainingLabel}>kcal remaining</Text>
          </View>
          <View style={styles.remainingDivider} />
          <View>
            <Text style={styles.remainingValue}>{projected.protein} g</Text>
            <Text style={styles.remainingLabel}>protein remaining</Text>
          </View>
        </View>
      </Card>

      <Card style={styles.nextCard}>
        <View style={styles.nextTop}>
          <View style={styles.nextBadge}><Ionicons color={colors.text} name="navigate" size={20} /></View>
          <View style={styles.nextCopy}>
            <Eyebrow>Recommended next meal</Eyebrow>
            <Text style={styles.nextTitle}>A lighter, protein-first dinner</Text>
          </View>
        </View>
        <View style={styles.aimRow}>
          <View style={styles.aimBlock}>
            <Text style={styles.aimValue}>450–550</Text>
            <Text style={styles.aimLabel}>kilocalories</Text>
          </View>
          <View style={styles.aimBlock}>
            <Text style={styles.aimValue}>35–45 g</Text>
            <Text style={styles.aimLabel}>protein</Text>
          </View>
          <View style={styles.aimBlock}>
            <Text style={styles.aimValue}>Light</Text>
            <Text style={styles.aimLabel}>on fats</Text>
          </View>
        </View>
        <PrimaryButton icon="arrow-forward" label="Show me 3 options" onPress={showOptions} />
      </Card>

      <PrimaryButton label="Save meal and finish" onPress={saveForLater} variant="ghost" />
      <Text style={styles.estimateNote}>Nutrition values are estimates. You stay in control of every ingredient and portion.</Text>
    </Screen>
  );
}

function MacroResult({ label, unit, value }: { label: string; unit: string; value: number }) {
  return (
    <View style={styles.macroResult}>
      <Text style={styles.macroValue}>{value}<Text style={styles.macroUnit}> {unit}</Text></Text>
      <Text style={styles.macroLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  topTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  resultHeading: { gap: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  mealCopy: { flex: 1, gap: 10 },
  mealTitle: { color: colors.text, fontSize: 29, lineHeight: 34, fontWeight: '700', letterSpacing: -0.8, textTransform: 'capitalize' },
  calorieBlock: { alignItems: 'flex-end' },
  calories: { color: colors.text, fontSize: 36, lineHeight: 41, fontWeight: '700', letterSpacing: -1.2 },
  calorieLabel: { color: colors.muted, fontSize: 10 },
  macros: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radii.card, borderWidth: 1, borderColor: colors.border, paddingVertical: 15 },
  macroResult: { flex: 1, alignItems: 'center', gap: 4 },
  macroValue: { color: colors.text, fontSize: 17, fontWeight: '700' },
  macroUnit: { fontSize: 11, fontWeight: '600' },
  macroLabel: { color: colors.muted, fontSize: 10 },
  section: { gap: 13 },
  edit: { color: colors.accentDeep, fontSize: 13, fontWeight: '700' },
  ingredientsCard: { padding: 8 },
  ingredientRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, gap: 10 },
  ingredientCheck: { width: 28, height: 28, borderRadius: 10, backgroundColor: colors.successSoft, alignItems: 'center', justifyContent: 'center' },
  ingredientName: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '600' },
  ingredientAmount: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: 46 },
  dayCard: { backgroundColor: colors.text, borderColor: colors.text, gap: 19 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  dayIcon: { width: 44, height: 44, borderRadius: 16, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  dayHeading: { flex: 1, gap: 4 },
  onTrack: { color: colors.white, fontSize: 18, fontWeight: '700' },
  remainingRow: { flexDirection: 'row', alignItems: 'center' },
  remainingValue: { color: colors.white, fontSize: 25, fontWeight: '700' },
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
  estimateNote: { color: colors.muted, fontSize: 10, lineHeight: 16, textAlign: 'center', paddingHorizontal: 18 },
});
