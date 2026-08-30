import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CalorieRing } from '@/components/CalorieRing';
import { Card, Eyebrow, IconCircle, MacroCard, PrimaryButton, Screen, SectionTitle } from '@/components/ui';
import { colors, radii } from '@/constants/theme';
import { useApp } from '@/context/AppContext';

export default function TodayScreen() {
  const router = useRouter();
  const { consumed, hasLoggedScan, meals, remaining, resetScan, targets, userName } = useApp();

  const startScan = () => {
    resetScan();
    router.push('/(tabs)/scan');
  };

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text style={styles.date}>SUNDAY, AUGUST 30</Text>
          <Text style={styles.greeting}>Good morning, {userName}</Text>
        </View>
        <Pressable accessibilityLabel="Open profile" onPress={() => router.push('/(tabs)/profile')} style={styles.avatar}>
          <Text style={styles.avatarText}>A</Text>
        </Pressable>
      </View>

      <Card style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View>
            <Eyebrow>Today’s balance</Eyebrow>
            <Text style={styles.onTrack}>{hasLoggedScan ? 'Still on track' : 'A fresh day'}</Text>
          </View>
          <View style={styles.moreButton}>
            <Ionicons color={colors.muted} name="ellipsis-horizontal" size={20} />
          </View>
        </View>
        <CalorieRing remaining={remaining.calories} total={targets.calories} />
        <Text style={styles.consumed}>{consumed.calories.toLocaleString('en-US')} eaten · {targets.calories.toLocaleString('en-US')} target</Text>
      </Card>

      <View style={styles.macroRow}>
        <MacroCard current={consumed.protein} icon="barbell-outline" label="Protein" target={targets.protein} />
        <MacroCard current={consumed.carbs} icon="flash-outline" label="Carbs" target={targets.carbs} />
        <MacroCard current={consumed.fat} icon="water-outline" label="Fat" target={targets.fat} />
      </View>

      <Card style={styles.nextCard}>
        <View style={styles.nextHeader}>
          <IconCircle name="navigate" size={48} />
          <View style={styles.nextHeading}>
            <Eyebrow>Your next move</Eyebrow>
            <Text style={styles.mealMoment}>{hasLoggedScan ? 'Dinner' : 'Lunch'}</Text>
          </View>
          <Ionicons color={colors.text} name="arrow-forward" size={22} />
        </View>
        <View style={styles.targetRow}>
          <View style={styles.targetBlock}>
            <Text style={styles.targetLabel}>AIM FOR</Text>
            <Text style={styles.targetValue}>{hasLoggedScan ? '450–550' : '600–750'} kcal</Text>
          </View>
          <View style={styles.targetDivider} />
          <View style={styles.targetBlock}>
            <Text style={styles.targetLabel}>PROTEIN</Text>
            <Text style={styles.targetValue}>{hasLoggedScan ? '35–45' : '40+'} g</Text>
          </View>
        </View>
        <PrimaryButton icon="sparkles" label="See 3 ideas" onPress={() => router.push('/(tabs)/plan')} variant="secondary" />
      </Card>

      <View style={styles.sectionBlock}>
        <SectionTitle action={<Text style={styles.link}>View all</Text>}>Today</SectionTitle>
        <Card style={styles.timelineCard}>
          {meals.map((meal, index) => (
            <View key={meal.id}>
              <View style={styles.mealRow}>
                <View style={[styles.mealIcon, meal.type === 'Lunch' && styles.mealIconLunch]}>
                  <Ionicons color={colors.text} name={meal.type === 'Breakfast' ? 'cafe-outline' : 'restaurant-outline'} size={20} />
                </View>
                <View style={styles.mealInfo}>
                  <Text style={styles.mealType}>{meal.type}</Text>
                  <Text numberOfLines={1} style={styles.mealName}>{meal.title}</Text>
                </View>
                <View style={styles.mealNumbers}>
                  <Text style={styles.mealCalories}>{meal.calories}</Text>
                  <Text style={styles.mealUnit}>kcal</Text>
                </View>
              </View>
              {index < meals.length - 1 ? <View style={styles.rowDivider} /> : null}
            </View>
          ))}
          <Pressable onPress={startScan} style={styles.addMealRow}>
            <View style={styles.addIcon}>
              <Ionicons color={colors.text} name="add" size={20} />
            </View>
            <Text style={styles.addMealText}>Scan {hasLoggedScan ? 'another meal' : 'lunch'}</Text>
            <Ionicons color={colors.muted} name="chevron-forward" size={18} />
          </Pressable>
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  date: { color: colors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  greeting: { color: colors.text, fontSize: 28, lineHeight: 35, fontWeight: '700', letterSpacing: -0.8, marginTop: 5 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.white, fontSize: 15, fontWeight: '800' },
  heroCard: { gap: 18, paddingVertical: 22 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  onTrack: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 4 },
  moreButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  consumed: { color: colors.muted, fontSize: 12, textAlign: 'center' },
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
  link: { color: colors.accentDeep, fontSize: 13, fontWeight: '700' },
  timelineCard: { padding: 8 },
  mealRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, gap: 12 },
  mealIcon: { width: 44, height: 44, borderRadius: 16, backgroundColor: colors.attentionSoft, alignItems: 'center', justifyContent: 'center' },
  mealIconLunch: { backgroundColor: colors.accentSoft },
  mealInfo: { flex: 1, gap: 3 },
  mealType: { color: colors.text, fontSize: 15, fontWeight: '700' },
  mealName: { color: colors.muted, fontSize: 12 },
  mealNumbers: { alignItems: 'flex-end' },
  mealCalories: { color: colors.text, fontSize: 16, fontWeight: '700' },
  mealUnit: { color: colors.muted, fontSize: 10 },
  rowDivider: { height: 1, backgroundColor: colors.border, marginLeft: 64 },
  addMealRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, gap: 12 },
  addIcon: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
  addMealText: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '700' },
});
