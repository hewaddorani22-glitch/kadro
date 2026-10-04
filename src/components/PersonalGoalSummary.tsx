import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, View } from 'react-native';
import { radii } from '@/constants/theme';
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
  const weight = formatWeight(goal.targetWeightKg, profile.unitSystem, locale);
  const date = goal.targetDate ? formatDateParts(new Date(`${goal.targetDate}T12:00:00`), { day: 'numeric', month: 'short', year: 'numeric' }, locale) : null;
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radii.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 16 }}>
    <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons color={colors.onAccent} name="flag" size={18} />
    </View>
    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700' }}>{t.onboarding.personalGoalTitle}</Text>
      <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>{date ? t.onboarding.goalBy(weight, date) : weight}</Text>
      <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 15 }}>{t.onboarding.personalGoalDisclaimer}</Text>
    </View>
  </View>;
}
