import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PortionSheet } from '@/components/PortionSheet';
import { Card, PrimaryButton, Screen } from '@/components/ui';
import type { ThemeColors } from '@/constants/theme';
import { useApp } from '@/context/AppContext';
import { useTheme, useThemedStyles } from '@/context/ThemeContext';
import { useLanguage } from '@/i18n/LanguageProvider';
import { FoodSearchResult, MealAnalysisError, searchIngredientReplacement } from '@/services/mealAnalysis';
import { formatNumber } from '@/utils/format';

export default function CorrectFoodScreen() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const { detectedItems, replaceDetectedItem } = useApp();
  const item = detectedItems.find(entry => entry.id === itemId);
  const { t, locale } = useLanguage();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const [query, setQuery] = useState(item?.name ?? '');
  const [results, setResults] = useState<FoodSearchResult[]>([]);
  const [pendingFood, setPendingFood] = useState<FoodSearchResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const inFlight = useRef(false);
  useFocusEffect(useCallback(() => () => {
    generation.current += 1;
    inFlight.current = false;
  }, []));

  const changeQuery = (value: string) => {
    generation.current += 1;
    inFlight.current = false;
    setBusy(false);
    setQuery(value);
    setResults([]);
    setError(null);
    setSearched(false);
  };

  const search = async () => {
    if (inFlight.current || query.trim().length < 2) return;
    const current = ++generation.current;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    setResults([]);
    Keyboard.dismiss();
    try {
      const foods = await searchIngredientReplacement(query);
      if (current !== generation.current) return;
      setResults(foods);
      setSearched(true);
    } catch (failure) {
      if (current !== generation.current) return;
      setError(failure instanceof MealAnalysisError ? failure.message : t.errors.analysisFailed);
    } finally {
      if (current === generation.current) {
        setBusy(false);
        inFlight.current = false;
      }
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel={t.common.back} onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" color={colors.text} size={22} />
        </Pressable>
        <Text style={styles.title}>{t.confirm.replaceFood}</Text>
      </View>
      {!item ? <PrimaryButton label={t.common.back} onPress={() => router.replace('/confirm')} /> : <>
        <Text style={styles.foodName}>{item.name}</Text>
        <Text style={styles.copy}>{t.confirm.correctionHint}</Text>
        <TextInput
          accessibilityLabel={t.confirm.correctionSearch}
          placeholder={t.confirm.correctionSearch}
          placeholderTextColor={colors.muted}
          value={query}
          onChangeText={changeQuery}
          onSubmitEditing={() => void search()}
          maxLength={120}
          returnKeyType="search"
          autoCorrect={false}
          style={styles.input}
        />
        <PrimaryButton disabled={busy || query.trim().length < 2} label={busy ? t.scan.searchSearching : t.confirm.correctionSearchButton} onPress={() => void search()} />
        {busy ? <ActivityIndicator color={colors.accentText} /> : null}
        {error ? <Text accessibilityRole="alert" style={styles.copy}>{error}</Text> : null}
        {!busy && searched && !results.length ? <Text style={styles.copy}>{t.scan.searchEmpty}</Text> : null}
        {results.map(food => (
          <Pressable accessibilityRole="button" accessibilityLabel={`${food.name}: ${t.confirm.replaceFood}`} key={food.id} onPress={() => { Keyboard.dismiss(); setPendingFood(food); }}>
            <Card style={styles.result}>
              <View style={styles.resultCopy}>
                <Text style={styles.foodName}>{food.name}</Text>
                <Text style={styles.copy}>{formatNumber(food.per100g.calories, locale)} kcal · {t.scan.searchPer100}</Text>
                <Text style={styles.source}>{food.source.label}</Text>
              </View>
              <Ionicons name="chevron-forward" color={colors.accentText} size={22} />
            </Card>
          </Pressable>
        ))}
        <PortionSheet
          visible={pendingFood !== null}
          target={pendingFood ? {
            name: pendingFood.name, per100g: pendingFood.per100g,
            defaultGrams: item.amountG, amountIsChosen: true,
            portions: pendingFood.portions, sourceLabel: pendingFood.source.label,
          } : null}
          onCancel={() => setPendingFood(null)}
          onConfirm={grams => {
            if (!pendingFood) return;
            replaceDetectedItem(item.id, pendingFood, grams);
            setPendingFood(null);
            router.back();
          }}
        />
      </>}
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  title: { flex: 1, color: colors.text, fontSize: 22, fontWeight: '700' },
  foodName: { color: colors.text, fontSize: 18, fontWeight: '700', flexShrink: 1 },
  copy: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  source: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  input: { minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, color: colors.text, padding: 14, fontSize: 17 },
  result: { minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: 12 },
  resultCopy: { flex: 1, gap: 6 },
});
