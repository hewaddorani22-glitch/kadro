import { useTheme, useThemedStyles } from '@/context/ThemeContext';
import type { ThemeColors } from '@/constants/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { mealPhotoPlaceholder } from '@/utils/format';
import { PortionSheet } from '@/components/PortionSheet';
import { Card, ConfidenceBadge, MealPhoto, PrimaryButton, Screen } from '@/components/ui';
import { radii } from '@/constants/theme';
import { useApp } from '@/context/AppContext';
import { countBucket, trackEvent } from '@/services/telemetry';
import { useLanguage } from '@/i18n/LanguageProvider';
import { successHaptic } from '@/services/haptics';
import { PortionFactor } from '@/types/nutrition';
import { formatNumber } from '@/utils/format';
import { initialSelection, itemNutritionPer100g } from '@/utils/portions';

export default function ConfirmScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { adjustItem, analysisMessage, detectedItems, mealPortion, photoUri, scanMode, scannedMeal, setItemAmount, setMealPortion, toggleItem } = useApp();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [amountFor, setAmountFor] = useState<string | null>(null);
  const [preferGrams, setPreferGrams] = useState(false);
  // A barcode or a search hit is one food, and for one food the honest
  // question is "how many grams", not "0.7x of what we guessed".
  const singleItem = detectedItems.length === 1 ? detectedItems[0] : null;
  const hasIncludedFood = detectedItems.some((item) => item.included);
  const { locale, t } = useLanguage();

  const changeInput = () => {
    if (scanMode === 'search') {
      router.replace('/(tabs)/scan?mode=search');
      return;
    }
    if (scanMode === 'description') {
      router.replace('/(tabs)/scan?mode=description');
      return;
    }
    router.replace('/(tabs)/scan');
  };

  const confirm = () => {
    if (!hasIncludedFood) return;
    void successHaptic();
    const includedItems = detectedItems.filter((item) => item.included);
    trackEvent('meal confirmed', {
      confidence: scannedMeal.confidence,
      correction_applied: mealPortion !== 1 || detectedItems.some((item) => !item.included || item.amountG !== item.baseAmountG),
      included_item_count: countBucket(includedItems.length),
    });
    router.push('/result');
  };

  return (
    <Screen>
      <View style={styles.topBar}>
        <Pressable accessibilityLabel={t.common.back} accessibilityRole="button" onPress={() => router.back()} style={styles.iconButton}>
          <Ionicons color={colors.text} name="arrow-back" size={22} />
        </Pressable>
        <Text style={styles.topTitle}>{t.confirm.title}</Text>
        <View style={styles.iconButtonSpacer} />
      </View>

      <MealPhoto height={230} placeholder={mealPhotoPlaceholder(scanMode)} uri={photoUri} />

      <View style={styles.heading}>
        <View style={styles.headingRow}>
          <Text style={styles.title}>{t.confirm.heading}</Text>
          {hasIncludedFood ? <ConfidenceBadge uncertain={scannedMeal.confidence === 'medium'} /> : null}
        </View>
        <Text style={styles.subtitle}>{singleItem ? t.confirm.subtitleSingle : t.confirm.subtitle}</Text>
      </View>

      {analysisMessage ? (
        <View style={styles.analysisWarning}>
          <Ionicons color={colors.attention} name="alert-circle-outline" size={18} />
          <Text style={styles.analysisWarningText}>{analysisMessage}</Text>
        </View>
      ) : null}

      <View style={styles.chips}>
        {detectedItems.map((item) => (
          <Pressable
            accessibilityLabel={`${item.name} ${item.included ? t.confirm.remove : t.confirm.add}`}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: item.included }}
            key={item.id}
            onPress={() => toggleItem(item.id)}
            style={[styles.detectedChip, !item.included && styles.detectedChipOff, item.optional && item.included && styles.detectedChipQuestion]}
          >
            <Ionicons
              color={!item.included ? colors.muted : item.optional ? colors.attention : colors.success}
              name={!item.included ? 'add-circle-outline' : item.optional ? 'help-circle' : 'checkmark-circle'}
              size={17}
            />
            <Text style={[styles.detectedChipText, !item.included && styles.detectedChipTextOff]}>{item.name}</Text>
          </Pressable>
        ))}
      </View>

      {singleItem ? (
        <Card style={styles.portionCard}>
          <View style={styles.portionHeading}>
            <View>
              <Text style={styles.portionTitle}>{t.confirm.amountQuestion}</Text>
              <Text style={styles.portionSubtitle}>{singleItem.name}</Text>
            </View>
            <Ionicons color={colors.accentText} name="resize-outline" size={22} />
          </View>
          <Pressable
            accessibilityLabel={t.confirm.amountQuestion}
            accessibilityRole="button"
            onPress={() => setAmountFor(singleItem.id)}
            style={styles.amountField}
          >
            <Text style={styles.amountFieldValue}>{(() => {
              const selection = initialSelection(singleItem.amountG, singleItem.portions, { chosen: true });
              return selection.unitIndex >= 0 ? `${formatNumber(Number(selection.amount), locale)} × ${singleItem.portions![selection.unitIndex].label}` : `${formatNumber(singleItem.amountG, locale)} g`;
            })()}</Text>
            <Ionicons color={colors.muted} name="create-outline" size={20} />
          </Pressable>
        </Card>
      ) : (
      <Card style={styles.portionCard}>
        <View style={styles.portionHeading}>
          <View>
            <Text style={styles.portionTitle}>{t.confirm.portionQuestion}</Text>
            <Text style={styles.portionSubtitle}>{mealPortion ? t.confirm.portionQuick : t.confirm.portionCustom}</Text>
          </View>
          <Ionicons color={colors.accentText} name="resize-outline" size={22} />
        </View>
        <View style={styles.portionSelector}>
          {([
            { factor: 0.7 as PortionFactor, label: t.confirm.less, multiplier: `${formatNumber(0.7, locale)}×` },
            { factor: 1 as PortionFactor, label: t.confirm.fits, multiplier: '1×' },
            { factor: 1.4 as PortionFactor, label: t.confirm.more, multiplier: `${formatNumber(1.4, locale)}×` },
          ]).map((choice) => {
            const active = mealPortion === choice.factor;
            return (
              <Pressable
                aria-checked={active}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                key={choice.label}
                onPress={() => setMealPortion(choice.factor)}
                style={[styles.portionChoice, active && styles.portionChoiceActive]}
              >
                <Text style={[styles.portionChoiceLabel, active && styles.portionChoiceLabelActive]}>{choice.label}</Text>
                <Text style={[styles.portionMultiplier, active && styles.portionChoiceLabelActive]}>{choice.multiplier}</Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: detailsOpen }} onPress={() => setDetailsOpen((current) => !current)} style={styles.detailsToggle}>
          <Text style={styles.detailsToggleText}>{detailsOpen ? t.confirm.closeDetails : t.confirm.openDetails}</Text>
          <Ionicons color={colors.muted} name={detailsOpen ? 'chevron-up' : 'chevron-down'} size={18} />
        </Pressable>
      </Card>
      )}

      {!singleItem ? detectedItems.filter((item) => item.included && item.portions?.length).map((item) => (
        <Pressable key={`pieces-${item.id}`} accessibilityRole="button" accessibilityLabel={`${item.name}: ${t.confirm.amountQuestion}`} onPress={() => setAmountFor(item.id)} style={styles.amountField}>
          <View style={{ flex: 1 }}><Text style={styles.portionTitle}>{item.name}</Text><Text style={styles.portionSubtitle}>{formatNumber(Number((item.amountG / item.portions![0].grams).toFixed(2)), locale)} × {item.portions![0].label}</Text></View>
          <Ionicons color={colors.accentText} name="create-outline" size={22} />
        </Pressable>
      )) : null}

      <PortionSheet
        onCancel={() => { setAmountFor(null); setPreferGrams(false); }}
        onConfirm={(grams) => {
          if (amountFor) setItemAmount(amountFor, grams);
          setAmountFor(null);
          setPreferGrams(false);
        }}
        target={(() => {
          const item = detectedItems.find((entry) => entry.id === amountFor);
          if (!item || item.baseAmountG < 1) return null;
          return {
            name: item.name,
            per100g: itemNutritionPer100g(item),
            defaultGrams: item.amountG,
            // This is the amount already on the meal, not a database default.
            amountIsChosen: true,
            preferGrams,
            portions: item.portions,
            sourceLabel: item.source.label,
          };
        })()}
        visible={amountFor !== null}
      />

      {detailsOpen ? (
        <Card style={styles.listCard}>
          {detectedItems.map((item, index) => (
            <View key={item.id}>
              <View style={[styles.itemRow, !item.included && styles.itemRowOff]}>
                <Pressable accessibilityLabel={`${item.name} ${t.confirm.include}`} accessibilityRole="checkbox" accessibilityState={{ checked: item.included }} onPress={() => toggleItem(item.id)} style={[styles.checkButton, item.included && styles.checkButtonOn]}>
                  <Ionicons color={item.included ? colors.onAccent : colors.muted} name={item.included ? 'checkmark' : 'add'} size={17} />
                </Pressable>
                <View style={styles.itemCopy}>
                  <View style={styles.itemNameRow}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    {item.optional ? <Text style={styles.uncertain}>{t.confirm.check}</Text> : null}
                  </View>
                  <Text style={styles.itemCalories}>~{item.calories} kcal · {item.source.label}</Text>
                </View>
                <View style={styles.stepper}>
                  <Pressable accessibilityLabel={`${item.name} ${t.confirm.decrease}`} accessibilityRole="button" onPress={() => adjustItem(item.id, -1)} style={styles.stepperButton}>
                    <Ionicons color={colors.text} name="remove" size={17} />
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={`${item.name}: ${t.confirm.amountQuestion}`} onPress={() => { setPreferGrams(true); setAmountFor(item.id); }} style={{ minHeight: 44, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: colors.border, justifyContent: 'center' }}><Text style={styles.amount}>{formatNumber(item.amountG, locale)} g</Text></Pressable>
                  <Pressable accessibilityLabel={`${item.name} ${t.confirm.increase}`} accessibilityRole="button" onPress={() => adjustItem(item.id, 1)} style={styles.stepperButton}>
                    <Ionicons color={colors.text} name="add" size={17} />
                  </Pressable>
                </View>
              </View>
              {index < detectedItems.length - 1 ? <View style={styles.divider} /> : null}
            </View>
          ))}
        </Card>
      ) : null}

      <Card style={styles.estimateCard}>
        <View>
          <Text style={styles.estimateLabel}>{t.confirm.currentEstimate}</Text>
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

      {!hasIncludedFood ? <Text style={styles.subtitle}>{t.confirm.emptyMeal}</Text> : null}
      <PrimaryButton disabled={!hasIncludedFood} icon="arrow-forward" label={t.confirm.proceed} onPress={confirm} />
      <PrimaryButton
        label={scanMode === 'search' ? t.confirm.searchAgain : scanMode === 'description' ? t.confirm.editDescription : t.confirm.retake}
        onPress={changeInput}
        variant="ghost"
      />
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  iconButtonSpacer: { width: 42, height: 42 },
  topTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  heading: { gap: 8 },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { color: colors.text, fontSize: 30, fontWeight: '700', letterSpacing: -0.8 },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  analysisWarning: { minHeight: 48, borderRadius: 15, backgroundColor: colors.attentionSoft, paddingHorizontal: 13, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 9 },
  analysisWarningText: { flex: 1, color: colors.text, fontSize: 11, lineHeight: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  detectedChip: { minHeight: 38, borderRadius: radii.pill, backgroundColor: colors.successSoft, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 6 },
  detectedChipQuestion: { backgroundColor: colors.attentionSoft },
  detectedChipOff: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  detectedChipText: { color: colors.text, fontSize: 12, fontWeight: '600' },
  detectedChipTextOff: { color: colors.muted, textDecorationLine: 'line-through' },
  listCard: { padding: 8 },
  portionCard: { gap: 16 },
  amountField: { minHeight: 60, borderRadius: radii.input, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.neutralSoft, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  amountFieldValue: { color: colors.text, fontSize: 24, fontWeight: '700' },
  portionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  portionTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  portionSubtitle: { color: colors.muted, fontSize: 11, marginTop: 4 },
  portionSelector: { flexDirection: 'row', borderRadius: radii.input, backgroundColor: colors.neutralSoft, padding: 4, gap: 4 },
  portionChoice: { flex: 1, minHeight: 52, borderRadius: 11, alignItems: 'center', justifyContent: 'center', gap: 2 },
  portionChoiceActive: { backgroundColor: colors.accent },
  portionChoiceLabel: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  portionChoiceLabelActive: { color: colors.onAccent },
  portionMultiplier: { color: colors.muted, fontSize: 10, fontVariant: ['tabular-nums'] },
  detailsToggle: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detailsToggleText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  itemRow: { minHeight: 72, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 11, paddingHorizontal: 7, paddingVertical: 12 },
  itemRowOff: { opacity: 0.48 },
  checkButton: { width: 44, height: 44, borderRadius: 13, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkButtonOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  itemCopy: { flex: 1, minWidth: 0, gap: 3 },
  itemNameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  itemName: { flexShrink: 1, color: colors.text, fontSize: 14, fontWeight: '700' },
  uncertain: { color: colors.attention, fontSize: 8, fontWeight: '800', letterSpacing: 0.7 },
  itemCalories: { color: colors.muted, fontSize: 11, fontVariant: ['tabular-nums'] },
  stepper: { width: '100%', minHeight: 44, borderRadius: 14, backgroundColor: colors.background, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepperButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  amount: { minWidth: 44, color: colors.text, fontSize: 12, fontWeight: '700', textAlign: 'center', fontVariant: ['tabular-nums'] },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: 52 },
  estimateCard: { backgroundColor: colors.camera, borderColor: colors.camera, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  estimateLabel: { color: 'rgba(255,255,255,0.58)', fontSize: 9, fontWeight: '800', letterSpacing: 0.9 },
  estimateValue: { color: colors.white, fontSize: 22, fontWeight: '700', marginTop: 4, fontVariant: ['tabular-nums'] },
  macroSummary: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  macroSummaryText: { color: colors.accent, fontSize: 11, fontWeight: '700' },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)' },
});
