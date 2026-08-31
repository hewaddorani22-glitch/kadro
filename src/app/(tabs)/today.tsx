import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CalorieRing } from '@/components/CalorieRing';
import { Card, Eyebrow, IconCircle, MacroCard, PrimaryButton, Screen, SectionTitle } from '@/components/ui';
import { colors, radii } from '@/constants/theme';
import { useApp } from '@/context/AppContext';
import { formatNumber, mealTypeLabel } from '@/utils/format';

export default function TodayScreen() {
  const router = useRouter();
  const { consumed, hasLoggedScan, meals, pendingAnalysisCount, remaining, resetScan, resumeLatestAnalysis, targets, userName } = useApp();
  const dateLabel = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: 'numeric', month: 'long' }).format(new Date());
  const greeting = userName === 'Du' ? 'Guten Morgen' : `Guten Morgen, ${userName}`;
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

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text style={styles.date}>{dateLabel}</Text>
          <Text style={styles.greeting}>{greeting}</Text>
        </View>
        <Pressable accessibilityLabel="Profil öffnen" onPress={() => router.push('/(tabs)/profile')} style={styles.avatar}>
          <Text style={styles.avatarText}>{userName === 'Du' ? 'K' : userName.trim().charAt(0).toUpperCase()}</Text>
        </Pressable>
      </View>

      {pendingAnalysisCount > 0 ? (
        <Pressable onPress={resumePending} style={styles.pendingBanner}>
          <View style={styles.pendingIcon}><Ionicons color={colors.text} name="cloud-offline-outline" size={19} /></View>
          <View style={styles.pendingCopy}>
            <Text style={styles.pendingTitle}>{pendingAnalysisCount} Scan{pendingAnalysisCount === 1 ? '' : 's'} wartet lokal</Text>
            <Text style={styles.pendingText}>Tippen und mit Verbindung erneut analysieren</Text>
          </View>
          <Ionicons color={colors.text} name="refresh" size={19} />
        </Pressable>
      ) : null}

      <Card style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View>
            <Eyebrow>Dein Tagesstand</Eyebrow>
            <Text style={styles.onTrack}>{hasLoggedScan ? 'Weiter im Plan' : 'Dein nächster Zug steht'}</Text>
          </View>
        </View>
        <CalorieRing remaining={remaining.calories} total={targets.calories} />
        <Text style={styles.consumed}>{formatNumber(consumed.calories)} gegessen · {formatNumber(targets.calories)} Ziel</Text>
      </Card>

      <View style={styles.macroRow}>
        <MacroCard current={consumed.protein} icon="barbell-outline" label="Protein" target={targets.protein} />
        <MacroCard current={consumed.carbs} icon="flash-outline" label="Kohlenh." target={targets.carbs} />
        <MacroCard current={consumed.fat} icon="water-outline" label="Fett" target={targets.fat} />
      </View>

      <Card style={styles.nextCard}>
        <View style={styles.nextHeader}>
          <IconCircle name="navigate" size={48} />
          <View style={styles.nextHeading}>
            <Eyebrow>Dein nächster Zug</Eyebrow>
            <Text style={styles.mealMoment}>{hasLoggedScan ? 'Nächste Mahlzeit' : 'Erste Mahlzeit'}</Text>
          </View>
          <Ionicons color={colors.text} name="arrow-forward" size={22} />
        </View>
        <View style={styles.targetRow}>
          <View style={styles.targetBlock}>
            <Text style={styles.targetLabel}>ZIELBEREICH</Text>
            <Text style={styles.targetValue}>{calorieRange} kcal</Text>
          </View>
          <View style={styles.targetDivider} />
          <View style={styles.targetBlock}>
            <Text style={styles.targetLabel}>PROTEIN</Text>
            <Text style={styles.targetValue}>{proteinRange} g</Text>
          </View>
        </View>
        <PrimaryButton icon="arrow-forward" label="3 Ideen zeigen" onPress={() => router.push('/(tabs)/plan')} />
      </Card>

      <View style={styles.sectionBlock}>
        <SectionTitle>Heute</SectionTitle>
        <Card style={styles.timelineCard}>
          {meals.map((meal, index) => (
            <View key={meal.id}>
              <View style={styles.mealRow}>
                <View style={[styles.mealIcon, meal.type === 'Lunch' && styles.mealIconLunch]}>
                  <Ionicons color={colors.text} name={meal.type === 'Breakfast' ? 'cafe-outline' : 'restaurant-outline'} size={20} />
                </View>
                <View style={styles.mealInfo}>
                  <Text style={styles.mealType}>{mealTypeLabel(meal.type)}</Text>
                  <Text numberOfLines={1} style={styles.mealName}>{meal.title}</Text>
                </View>
                <View style={styles.mealNumbers}>
                  <Text style={styles.mealCalories}>~{meal.calories}</Text>
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
            <Text style={styles.addMealText}>{hasLoggedScan ? 'Weitere Mahlzeit scannen' : 'Erste Mahlzeit scannen'}</Text>
            <Ionicons color={colors.muted} name="chevron-forward" size={18} />
          </Pressable>
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  date: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  greeting: { color: colors.text, fontSize: 28, lineHeight: 35, fontWeight: '700', letterSpacing: -0.8, marginTop: 5 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.white, fontSize: 15, fontWeight: '800' },
  pendingBanner: { minHeight: 66, borderRadius: radii.card, backgroundColor: colors.attentionSoft, borderWidth: 1, borderColor: colors.attention, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 11 },
  pendingIcon: { width: 38, height: 38, borderRadius: 14, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  pendingCopy: { flex: 1, gap: 2 },
  pendingTitle: { color: colors.text, fontSize: 13, fontWeight: '800' },
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
  mealRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, gap: 12 },
  mealIcon: { width: 44, height: 44, borderRadius: 16, backgroundColor: colors.attentionSoft, alignItems: 'center', justifyContent: 'center' },
  mealIconLunch: { backgroundColor: colors.neutralSoft },
  mealInfo: { flex: 1, gap: 3 },
  mealType: { color: colors.text, fontSize: 15, fontWeight: '700' },
  mealName: { color: colors.muted, fontSize: 12 },
  mealNumbers: { alignItems: 'flex-end' },
  mealCalories: { color: colors.text, fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  mealUnit: { color: colors.muted, fontSize: 10 },
  rowDivider: { height: 1, backgroundColor: colors.border, marginLeft: 64 },
  addMealRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, gap: 12 },
  addIcon: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
  addMealText: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '700' },
});
