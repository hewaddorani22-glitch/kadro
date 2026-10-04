import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, PrimaryButton } from '@/components/ui';
import { useApp } from '@/context/AppContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/i18n/LanguageProvider';
import { useLocalDay } from '@/hooks/useLocalDay';
import { weeklyReview } from '@/services/weeklyReview';
import { formatDateParts } from '@/utils/format';

export function WeeklyReviewCard() {
  const { colors } = useTheme();
  const { t, locale } = useLanguage();
  const { mealHistory, profile, targets, hydrationReady } = useApp();
  const { status } = useSubscription();
  const router = useRouter();
  const today = useLocalDay();
  if (!hydrationReady || !profile.completedAt || profile.age < 18) return null;
  const copy = t.weeklyReview;
  const { current, previous, proteinChangePercent } = weeklyReview(mealHistory, targets.calories, today);
  const number = (value: number) => value.toLocaleString(locale);
  const text = { color: colors.muted, fontSize: 15, lineHeight: 22 };
  return <Card>
    <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 21, fontWeight: '700' }}>{copy.title}</Text>
    {status === 'active' ? <>
      <Text style={text}>{formatDateParts(current.from, { day: 'numeric', month: 'short' }, locale)} – {formatDateParts(current.to, { day: 'numeric', month: 'short' }, locale)}</Text>
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: '600' }}>{copy.loggedDays(current.loggedDays)}</Text>
      {current.loggedDays ? <View style={{ gap: 8 }}>
        <Text style={text}>{copy.averages(number(current.averageCalories!), number(current.averageProtein!))}</Text>
        {current.daysNearCurrentTarget !== null ? <Text style={text}>{copy.nearTarget(current.daysNearCurrentTarget, current.loggedDays, number(targets.calories))}</Text> : null}
        <Text style={text}>{proteinChangePercent !== null
          ? copy.proteinComparison(`${proteinChangePercent > 0 ? '+' : ''}${number(proteinChangePercent)}%`, current.loggedDays, previous.loggedDays)
          : copy.comparisonPending}</Text>
        <Text style={text}>{copy.dataNote}</Text>
      </View> : <Text style={text}>{copy.empty}</Text>}
    </> : <>
      <Text style={text}>{copy.proDescription}</Text>
      <PrimaryButton label={copy.openPro} variant="secondary" onPress={() => router.push('/paywall')} />
    </>}
  </Card>;
}
