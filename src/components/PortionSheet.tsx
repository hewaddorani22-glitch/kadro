import { useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/ui';
import { colors, radii } from '@/constants/theme';
import { useLanguage } from '@/i18n/LanguageProvider';
import type { Nutrition } from '@/types/nutrition';
import { type FoodPortion, initialSelection, resolveGrams, scaleNutrition } from '@/utils/portions';

export type { FoodPortion };

export type PortionTarget = {
  name: string;
  per100g: Nutrition;
  defaultGrams: number;
  portions?: FoodPortion[];
  /** True when defaultGrams is an amount the user set, not a database default. */
  amountIsChosen?: boolean;
  sourceLabel?: string;
};

/**
 * Amount entry for anything picked from search or a barcode.
 *
 * The old flow had a single grams field sitting above the result list, so you
 * had to decide "how much" before you knew "of what", and grams was the only
 * answer available. Nobody weighs a banana; they eat one, or two, or half.
 * So the amount is asked after the food is chosen, and a named portion counts
 * as a unit of its own — "2 × 1 banana" is 252 g without the user doing the
 * multiplication.
 */
export function PortionSheet({
  target,
  visible,
  onCancel,
  onConfirm,
}: {
  target: PortionTarget | null;
  visible: boolean;
  onCancel: () => void;
  onConfirm: (grams: number) => void;
}) {
  const { t } = useLanguage();
  const portions = target?.portions?.length ? target.portions : [];
  // A named portion is the friendlier default when the food has one.
  const [unitIndex, setUnitIndex] = useState(0);
  const [amount, setAmount] = useState('');

  // Re-key on the food so a second search does not inherit the first one's
  // count: "2" pieces of yoghurt is not "2" of the next thing.
  const signature = `${target?.name ?? ''}:${target?.defaultGrams ?? 0}`;
  // A sentinel no signature can equal, so the first target is initialised by
  // the same branch as every later one. Seeding this with the current
  // signature meant a sheet that mounted with a food already chosen opened
  // with an empty amount field.
  const [seen, setSeen] = useState('\u0000');
  if (seen !== signature) {
    const opening = initialSelection(target?.defaultGrams ?? 100, portions, { chosen: target?.amountIsChosen });
    setSeen(signature);
    setUnitIndex(opening.unitIndex);
    setAmount(opening.amount);
  }

  const activePortion = unitIndex >= 0 ? portions[unitIndex] : undefined;
  const grams = resolveGrams(amount, activePortion);
  const valid = grams !== null;

  const preview = useMemo(
    () => (target && grams !== null ? scaleNutrition(target.per100g, grams) : null),
    [grams, target],
  );

  const pickUnit = (index: number) => {
    if (index === unitIndex) return;
    setUnitIndex(index);
    // Carrying "150" from grams into a piece count would silently log 150
    // bananas, so each unit starts from what is sensible for it.
    setAmount(index >= 0 ? '1' : String(target?.defaultGrams ?? 100));
  };

  const quickCounts = activePortion ? ['0.5', '1', '1.5', '2', '3'] : ['50', '100', '150', '200', '250'];

  return (
    <Modal animationType="slide" onRequestClose={onCancel} transparent visible={visible && !!target}>
      <View style={styles.scrim}>
        <View accessibilityViewIsModal style={styles.sheet}>
          <View style={styles.grabber} />
          <Text accessibilityRole="header" numberOfLines={2} style={styles.title}>{target?.name}</Text>
          {target?.sourceLabel ? <Text style={styles.source}>{target.sourceLabel}</Text> : null}

          <View style={styles.amountRow}>
            <TextInput
              accessibilityLabel={t.portion.amount}
              autoFocus={Platform.OS !== 'web'}
              keyboardType="decimal-pad"
              maxLength={5}
              onChangeText={setAmount}
              selectTextOnFocus
              style={styles.amountInput}
              value={amount}
            />
            <Text style={styles.amountUnit} numberOfLines={2}>
              {activePortion ? `× ${activePortion.label}` : 'g'}
            </Text>
          </View>

          <ScrollView contentContainerStyle={styles.quickRow} horizontal showsHorizontalScrollIndicator={false}>
            {quickCounts.map((value) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: amount === value }}
                key={value}
                onPress={() => setAmount(value)}
                style={[styles.quickChip, amount === value && styles.quickChipOn]}
              >
                <Text style={[styles.quickChipText, amount === value && styles.quickChipTextOn]}>
                  {activePortion ? value.replace('.', t.portion.decimalMark) : `${value} g`}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {portions.length ? (
            <View style={styles.unitRow}>
              {portions.map((portion, index) => (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected: unitIndex === index }}
                  key={portion.label}
                  onPress={() => pickUnit(index)}
                  style={[styles.unitChip, unitIndex === index && styles.unitChipOn]}
                >
                  <Text numberOfLines={1} style={[styles.unitChipText, unitIndex === index && styles.unitChipTextOn]}>
                    {portion.label}
                  </Text>
                  <Text style={styles.unitChipGrams}>{portion.grams} g</Text>
                </Pressable>
              ))}
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected: unitIndex === -1 }}
                onPress={() => pickUnit(-1)}
                style={[styles.unitChip, unitIndex === -1 && styles.unitChipOn]}
              >
                <Text style={[styles.unitChipText, unitIndex === -1 && styles.unitChipTextOn]}>{t.portion.grams}</Text>
                <Text style={styles.unitChipGrams}>g</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.preview}>
            <Text style={styles.previewValue}>{preview ? `~${preview.calories} kcal` : '—'}</Text>
            {preview ? (
              <Text style={styles.previewMacros}>
                {preview.protein} g P · {preview.carbs} g C · {preview.fat} g F · {grams} g
              </Text>
            ) : (
              <Text style={styles.previewMacros}>{t.portion.invalid}</Text>
            )}
          </View>

          <PrimaryButton disabled={!valid} icon="add" label={t.portion.add} onPress={() => grams !== null && onConfirm(grams)} />
          <Pressable accessibilityRole="button" onPress={onCancel} style={styles.cancel}>
            <Text style={styles.cancelText}>{t.common.cancel}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(20,21,15,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 22, paddingBottom: 30, gap: 14 },
  grabber: { alignSelf: 'center', width: 42, height: 5, borderRadius: 3, backgroundColor: colors.border },
  title: { color: colors.text, fontSize: 20, fontWeight: '700', letterSpacing: -0.4 },
  source: { color: colors.muted, fontSize: 11, marginTop: -8 },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  amountInput: { minWidth: 108, minHeight: 64, borderRadius: radii.input, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.neutralSoft, color: colors.text, fontSize: 30, fontWeight: '700', paddingHorizontal: 16, textAlign: 'center' },
  amountUnit: { flex: 1, color: colors.text, fontSize: 17, fontWeight: '600' },
  quickRow: { gap: 8, paddingRight: 8 },
  quickChip: { minHeight: 40, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  quickChipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  quickChipText: { color: colors.muted, fontSize: 14, fontWeight: '700' },
  quickChipTextOn: { color: colors.text },
  unitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  unitChip: { minHeight: 48, borderRadius: radii.input, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 6, justifyContent: 'center' },
  unitChipOn: { backgroundColor: colors.accentSoft, borderColor: colors.accentText },
  unitChipText: { color: colors.text, fontSize: 13, fontWeight: '600', maxWidth: 170 },
  unitChipTextOn: { color: colors.accentText },
  unitChipGrams: { color: colors.muted, fontSize: 11 },
  preview: { borderRadius: radii.input, backgroundColor: colors.neutralSoft, padding: 14, gap: 3 },
  previewValue: { color: colors.text, fontSize: 22, fontWeight: '700' },
  previewMacros: { color: colors.muted, fontSize: 12 },
  cancel: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: colors.muted, fontSize: 14, fontWeight: '600' },
});
