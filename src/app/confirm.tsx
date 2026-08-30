import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, ConfidenceBadge, MealPhoto, PrimaryButton, Screen } from '@/components/ui';
import { colors, radii } from '@/constants/theme';
import { useApp } from '@/context/AppContext';

export default function ConfirmScreen() {
  const router = useRouter();
  const { adjustItem, detectedItems, photoUri, scannedMeal, toggleItem } = useApp();

  const confirm = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.push('/result');
  };

  return (
    <Screen>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.iconButton}>
          <Ionicons color={colors.text} name="arrow-back" size={22} />
        </Pressable>
        <Text style={styles.topTitle}>Confirm meal</Text>
        <Pressable style={styles.iconButton}>
          <Ionicons color={colors.text} name="ellipsis-horizontal" size={21} />
        </Pressable>
      </View>

      <MealPhoto height={230} uri={photoUri} />

      <View style={styles.heading}>
        <View style={styles.headingRow}>
          <Text style={styles.title}>Looks right?</Text>
          <ConfidenceBadge />
        </View>
        <Text style={styles.subtitle}>Tap a food to remove it, or adjust the portion. Two seconds now makes the estimate much better.</Text>
      </View>

      <View style={styles.chips}>
        {detectedItems.map((item) => (
          <Pressable key={item.id} onPress={() => toggleItem(item.id)} style={[styles.detectedChip, !item.included && styles.detectedChipOff, item.optional && item.included && styles.detectedChipQuestion]}>
            <Ionicons
              color={!item.included ? colors.muted : item.optional ? colors.attention : colors.success}
              name={!item.included ? 'add-circle-outline' : item.optional ? 'help-circle' : 'checkmark-circle'}
              size={17}
            />
            <Text style={[styles.detectedChipText, !item.included && styles.detectedChipTextOff]}>{item.name}</Text>
          </Pressable>
        ))}
      </View>

      <Card style={styles.listCard}>
        {detectedItems.map((item, index) => (
          <View key={item.id}>
            <View style={[styles.itemRow, !item.included && styles.itemRowOff]}>
              <Pressable onPress={() => toggleItem(item.id)} style={[styles.checkButton, item.included && styles.checkButtonOn]}>
                <Ionicons color={item.included ? colors.text : colors.muted} name={item.included ? 'checkmark' : 'add'} size={17} />
              </Pressable>
              <View style={styles.itemCopy}>
                <View style={styles.itemNameRow}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  {item.optional ? <Text style={styles.uncertain}>CHECK</Text> : null}
                </View>
                <Text style={styles.itemCalories}>~{item.calories} kcal</Text>
              </View>
              <View style={styles.stepper}>
                <Pressable onPress={() => adjustItem(item.id, -1)} style={styles.stepperButton}>
                  <Ionicons color={colors.text} name="remove" size={17} />
                </Pressable>
                <Text style={styles.amount}>{item.amountG} g</Text>
                <Pressable onPress={() => adjustItem(item.id, 1)} style={styles.stepperButton}>
                  <Ionicons color={colors.text} name="add" size={17} />
                </Pressable>
              </View>
            </View>
            {index < detectedItems.length - 1 ? <View style={styles.divider} /> : null}
          </View>
        ))}
      </Card>

      <Card style={styles.estimateCard}>
        <View>
          <Text style={styles.estimateLabel}>CURRENT ESTIMATE</Text>
          <Text style={styles.estimateValue}>~{scannedMeal.calories} kcal</Text>
        </View>
        <View style={styles.macroSummary}>
          <Text style={styles.macroSummaryText}>{scannedMeal.protein}g P</Text>
          <View style={styles.dot} />
          <Text style={styles.macroSummaryText}>{scannedMeal.carbs}g C</Text>
          <View style={styles.dot} />
          <Text style={styles.macroSummaryText}>{scannedMeal.fat}g F</Text>
        </View>
      </Card>

      <PrimaryButton icon="arrow-forward" label="Yes, continue" onPress={confirm} />
      <PrimaryButton label="Retake photo" onPress={() => router.replace('/(tabs)/scan')} variant="ghost" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  topTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  heading: { gap: 8 },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { color: colors.text, fontSize: 30, fontWeight: '700', letterSpacing: -0.8 },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  detectedChip: { minHeight: 38, borderRadius: radii.pill, backgroundColor: colors.successSoft, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 6 },
  detectedChipQuestion: { backgroundColor: colors.attentionSoft },
  detectedChipOff: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  detectedChipText: { color: colors.text, fontSize: 12, fontWeight: '600' },
  detectedChipTextOff: { color: colors.muted, textDecorationLine: 'line-through' },
  listCard: { padding: 8 },
  itemRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 7 },
  itemRowOff: { opacity: 0.48 },
  checkButton: { width: 34, height: 34, borderRadius: 13, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkButtonOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  itemCopy: { flex: 1, gap: 3 },
  itemNameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  itemName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  uncertain: { color: colors.attention, fontSize: 8, fontWeight: '800', letterSpacing: 0.7 },
  itemCalories: { color: colors.muted, fontSize: 11 },
  stepper: { height: 38, borderRadius: 14, backgroundColor: colors.background, flexDirection: 'row', alignItems: 'center' },
  stepperButton: { width: 34, height: 38, alignItems: 'center', justifyContent: 'center' },
  amount: { minWidth: 44, color: colors.text, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: 52 },
  estimateCard: { backgroundColor: colors.text, borderColor: colors.text, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  estimateLabel: { color: 'rgba(255,255,255,0.58)', fontSize: 9, fontWeight: '800', letterSpacing: 0.9 },
  estimateValue: { color: colors.white, fontSize: 22, fontWeight: '700', marginTop: 4 },
  macroSummary: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  macroSummaryText: { color: colors.accent, fontSize: 11, fontWeight: '700' },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)' },
});
