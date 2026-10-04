import { Text, View } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/i18n/LanguageProvider';
import { normalizePersonalGoal } from '@/services/personalGoal';
import type { UserProfile } from '@/types/nutrition';
import { formatWeight } from '@/utils/units';
import { formatDateParts } from '@/utils/format';

/** A user-entered adult wish, separate from the calculated nutrition plan. */
export function PersonalGoalSummary({ profile }: { profile: UserProfile }) {
  const { colors } = useTheme();
  const { t, locale } = useLanguage();
  const goal = normalizePersonalGoal(profile);
  if (goal.targetWeightKg === null) return null;
  const date = goal.targetDate ? formatDateParts(new Date(`${goal.targetDate}T12:00:00`), { day: 'numeric', month: 'short', year: 'numeric' }, locale) : null;
  return <View style={{ gap: 6 }}>
    <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>{t.onboarding.personalGoalTitle}</Text>
    <Text style={{ color: colors.text, fontSize: 18, fontWeight: '600' }}>{formatWeight(goal.targetWeightKg, profile.unitSystem, locale)}{date ? ` · ${date}` : ''}</Text>
    <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>{t.onboarding.personalGoalDisclaimer}</Text>
  </View>;
}
