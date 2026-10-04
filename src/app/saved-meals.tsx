import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Card, PrimaryButton } from '@/components/ui';
import { MealDetailSheet } from '@/components/MealDetailSheet';
import { useApp } from '@/context/AppContext';
import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/i18n/LanguageProvider';

/** Existing owner data stays editable after access expires; no create actions. */
export default function SavedMeals() {
  const { mealHistory } = useApp(); const { t } = useLanguage(); const { colors } = useTheme(); const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  return <Screen>
    <PrimaryButton variant="ghost" label={t.common.back} onPress={() => router.canGoBack() ? router.back() : router.replace('/account-help' as never)} />
    <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 28, fontWeight: '700' }}>{t.access.savedMeals}</Text>
    {!mealHistory.length ? <Text style={{ color: colors.muted }}>{t.access.emptyHistory}</Text> : null}
    {mealHistory.map(meal => <Pressable key={meal.id} accessibilityRole="button" accessibilityHint={t.common.mealHint} onPress={() => setSelected(meal.id)}>
      <Card><Text style={{ color: colors.text, fontSize: 17, fontWeight: '600' }}>{meal.title}</Text><Text style={{ color: colors.muted }}>{meal.date}</Text></Card>
    </Pressable>)}
    <MealDetailSheet meal={mealHistory.find(meal => meal.id === selected) ?? null} onClose={() => setSelected(null)} />
  </Screen>;
}
