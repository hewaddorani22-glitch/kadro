import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/ui';
import { colors, radii } from '@/constants/theme';
import { useApp } from '@/context/AppContext';
import { Meal, PortionFactor } from '@/types/nutrition';
import { useLanguage } from '@/i18n/LanguageProvider';
import { formatNumber } from '@/utils/format';
import { MEAL_TYPES, mealTypeIcon, mealTypeLabel } from '@/utils/format';

/**
 * Everything a user can do to a meal after it is saved.
 *
 * Without this a mis-scan or a stray tap stayed in the day permanently, which
 * contradicted the promise the result screen makes about staying in control.
 */
export function MealDetailSheet({ meal, onClose }: { meal: Meal | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { adjustLoggedMealPortion, deleteLoggedMeal, setLoggedMealType } = useApp();
  const { locale, t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (!meal) return null;

  const currentFactor = meal.items[0]
    ? Math.round((meal.items[0].amountG / Math.max(1, meal.items[0].baseAmountG)) * 10) / 10
    : 1;

  const close = () => {
    setConfirmingDelete(false);
    onClose();
  };

  const adjust = async (factor: PortionFactor) => {
    if (busy) return;
    setBusy(true);
    void Haptics.selectionAsync();
    try {
      await adjustLoggedMealPortion(meal.id, factor);
      close();
    } finally {
      setBusy(false);
    }
  };

  const changeType = async (type: Meal['type']) => {
    if (busy || type === meal.type) return;
    setBusy(true);
    void Haptics.selectionAsync();
    try {
      await setLoggedMealType(meal.id, type);
      close();
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (busy) return;
    setBusy(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    try {
      await deleteLoggedMeal(meal.id);
      close();
    } finally {
      setBusy(false);
    }
  };

  const included = meal.items.filter((item) => item.included);

  return (
    <Modal animationType="slide" onRequestClose={close} transparent visible>
      <Pressable accessibilityLabel={t.common.close} onPress={close} style={styles.scrim} />
      <View accessibilityViewIsModal style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.grabber} />

        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.type}>{mealTypeLabel(meal.type, t.common)} · {meal.time}</Text>
            <Text style={styles.title}>{meal.title}</Text>
          </View>
          <Pressable accessibilityLabel={t.common.close} accessibilityRole="button" hitSlop={8} onPress={close} style={styles.closeButton}>
            <Ionicons color={colors.text} name="close" size={20} />
          </Pressable>
        </View>

        <View style={styles.macroRow}>
          <Macro label="kcal" value={`~${meal.calories}`} />
          <Macro label={t.common.protein} value={`${meal.protein} g`} />
          <Macro label={t.common.carbs} value={`${meal.carbs} g`} />
          <Macro label={t.common.fat} value={`${meal.fat} g`} />
        </View>

        <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
          {included.length ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{t.mealSheet.contains}</Text>
              {included.map((item) => (
                <View key={item.id} style={styles.itemRow}>
                  <Text numberOfLines={1} style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemAmount}>{item.amountG} g · ~{item.calories} kcal</Text>
                </View>
              ))}
              <Text style={styles.sourceNote}>{included[0].source.label}</Text>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t.mealSheet.mealMoment}</Text>
            <Text style={styles.sectionHint}>{t.mealSheet.mealMomentHint}</Text>
            <View style={styles.typeRow}>
              {MEAL_TYPES.map((type) => {
                const active = meal.type === type;
                return (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ disabled: busy, selected: active }}
                    disabled={busy}
                    key={type}
                    onPress={() => void changeType(type)}
                    style={[styles.typeChip, active && styles.typeChipActive]}
                  >
                    <Ionicons color={colors.text} name={mealTypeIcon(type)} size={15} />
                    <Text style={styles.typeChipText}>{mealTypeLabel(type, t.common)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t.mealSheet.correctPortion}</Text>
            <Text style={styles.sectionHint}>{t.mealSheet.correctPortionHint}</Text>
            <View style={styles.portionSelector}>
              {([
                { factor: 0.7 as PortionFactor, label: t.confirm.less, multiplier: `${formatNumber(0.7, locale)}×` },
                { factor: 1 as PortionFactor, label: t.mealSheet.original, multiplier: '1×' },
                { factor: 1.4 as PortionFactor, label: t.confirm.more, multiplier: `${formatNumber(1.4, locale)}×` },
              ]).map((choice) => {
                const active = Math.abs(currentFactor - choice.factor) < 0.05;
                return (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ disabled: busy, selected: active }}
                    disabled={busy}
                    key={choice.label}
                    onPress={() => void adjust(choice.factor)}
                    style={[styles.portionChoice, active && styles.portionActive]}
                  >
                    <Text style={[styles.portionLabel, active && styles.portionActiveText]}>{choice.label}</Text>
                    <Text style={[styles.portionMultiplier, active && styles.portionActiveText]}>{choice.multiplier}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>

        {confirmingDelete ? (
          <View style={styles.confirmBlock}>
            <Text style={styles.confirmText}>{t.mealSheet.confirmRemove}</Text>
            <PrimaryButton
              disabled={busy}
              icon="trash-outline"
              label={busy ? t.mealSheet.removing : t.mealSheet.confirmYes}
              onPress={() => void remove()}
              variant="dark"
            />
            <PrimaryButton disabled={busy} label={t.common.keep} onPress={() => setConfirmingDelete(false)} variant="ghost" />
          </View>
        ) : (
          <PrimaryButton
            disabled={busy}
            icon="trash-outline"
            label={t.mealSheet.remove}
            onPress={() => setConfirmingDelete(true)}
            variant="secondary"
          />
        )}
      </View>
    </Modal>
  );
}

function Macro({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.macro}>
      <Text style={styles.macroValue}>{value}</Text>
      <Text style={styles.macroLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(20,21,15,0.42)' },
  sheet: {
    maxHeight: '82%',
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    backgroundColor: colors.surface,
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 14,
  },
  grabber: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: colors.border },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 4 },
  headerCopy: { flex: 1, minWidth: 0, gap: 3 },
  type: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  title: { color: colors.text, fontSize: 22, lineHeight: 27, fontWeight: '700', letterSpacing: -0.5 },
  closeButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  macroRow: { flexDirection: 'row', backgroundColor: colors.background, borderRadius: radii.card, paddingVertical: 13 },
  macro: { flex: 1, minWidth: 0, alignItems: 'center', gap: 3 },
  macroValue: { color: colors.text, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  macroLabel: { color: colors.muted, fontSize: 10 },
  body: { flexGrow: 0 },
  section: { gap: 8, marginBottom: 18 },
  sectionLabel: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  sectionHint: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 34 },
  itemName: { flex: 1, minWidth: 0, color: colors.text, fontSize: 13, fontWeight: '600' },
  itemAmount: { color: colors.muted, fontSize: 11, fontVariant: ['tabular-nums'] },
  sourceNote: { color: colors.muted, fontSize: 10, marginTop: 2 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: { minHeight: 40, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 6 },
  typeChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  typeChipText: { color: colors.text, fontSize: 12, fontWeight: '600' },
  portionSelector: { flexDirection: 'row', borderRadius: radii.input, backgroundColor: colors.background, padding: 4, gap: 4 },
  portionChoice: { flex: 1, minWidth: 0, minHeight: 52, borderRadius: 11, alignItems: 'center', justifyContent: 'center', gap: 2 },
  portionActive: { backgroundColor: colors.accent },
  portionLabel: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  portionActiveText: { color: colors.text },
  portionMultiplier: { color: colors.muted, fontSize: 10, fontVariant: ['tabular-nums'] },
  confirmBlock: { gap: 8 },
  confirmText: { color: colors.text, fontSize: 14, fontWeight: '700', textAlign: 'center' },
});
