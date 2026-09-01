import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { Card, Eyebrow, PrimaryButton, Screen } from '@/components/ui';
import { colors, radii } from '@/constants/theme';
import { useApp } from '@/context/AppContext';
import {
  isEveningReminderEnabled,
  REMINDER_HOUR,
  REMINDER_MINUTE,
  remindersSupported,
  setEveningReminderEnabled,
} from '@/services/reminders';
import { formatNumber, mealTypeLabel } from '@/utils/format';

export default function EveningScreen() {
  const router = useRouter();
  const { consumed, meals, targets, userName } = useApp();
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderDismissed, setReminderDismissed] = useState(false);

  useEffect(() => {
    let active = true;
    void isEveningReminderEnabled().then((enabled) => {
      if (active) setReminderEnabled(enabled);
    });
    return () => {
      active = false;
    };
  }, []);

  const dateLabel = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  const over = Math.max(0, consumed.calories - targets.calories);
  const under = Math.max(0, targets.calories - consumed.calories);
  const logged = meals.length > 0;
  const proteinShare = targets.protein > 0 ? Math.round((consumed.protein / targets.protein) * 100) : 0;

  // The verdict never scolds. A day over budget is information, not a failure,
  // and tomorrow is always framed as already available.
  const verdict = !logged
    ? 'Heute nichts erfasst. Das ist völlig in Ordnung.'
    : over > 0
      ? `${formatNumber(over)} kcal über deinem Rahmen. Morgen stellt sich der Tag neu auf.`
      : under < 200
        ? 'Du hast deinen Rahmen ziemlich genau getroffen.'
        : `${formatNumber(under)} kcal unter deinem Rahmen.`;

  const headline = !logged
    ? 'Morgen ist auch ein Tag'
    : over > 0
      ? 'Heute etwas drüber'
      : 'Heute im Plan';

  const shareDay = async () => {
    const name = userName === 'Du' ? '' : `${userName}: `;
    await Share.share({
      message: logged
        ? `${name}${formatNumber(consumed.calories)} von ${formatNumber(targets.calories)} kcal und ${consumed.protein} g Protein an ${dateLabel}. Aufgestellt mit Kandro.`
        : `${name}Heute ohne Erfassung. Morgen stellt Kandro den Tag neu auf.`,
      title: 'Mein Tag mit Kandro',
    });
  };

  return (
    <Screen>
      <View style={styles.topBar}>
        <Pressable accessibilityLabel="Schließen" accessibilityRole="button" onPress={() => router.replace('/(tabs)/today')} style={styles.iconButton}>
          <Ionicons color={colors.text} name="close" size={22} />
        </Pressable>
        <Text style={styles.topTitle}>Tagesabschluss</Text>
        <Pressable accessibilityLabel="Tag teilen" accessibilityRole="button" onPress={() => void shareDay()} style={styles.iconButton}>
          <Ionicons color={colors.text} name="share-outline" size={21} />
        </Pressable>
      </View>

      <Card style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View style={styles.heroCopy}>
            <Eyebrow light>{dateLabel}</Eyebrow>
            <Text style={styles.headline}>{headline}</Text>
          </View>
          <View style={[styles.badge, over > 0 && styles.badgeAttention]}>
            <Ionicons
              color={over > 0 ? colors.attention : colors.accent}
              name={over > 0 ? 'partly-sunny-outline' : 'moon-outline'}
              size={22}
            />
          </View>
        </View>

        <View style={styles.numbersRow}>
          <View style={styles.numberBlock}>
            <Text style={styles.number}>{formatNumber(consumed.calories)}</Text>
            <Text style={styles.numberLabel}>kcal gegessen</Text>
          </View>
          <View style={styles.numberDivider} />
          <View style={styles.numberBlock}>
            <Text style={styles.number}>{consumed.protein} g</Text>
            <Text style={styles.numberLabel}>Protein · {proteinShare} % vom Ziel</Text>
          </View>
        </View>

        <Text style={styles.verdict}>{verdict}</Text>
      </Card>

      {logged ? (
        <Card style={styles.mealsCard}>
          <Text style={styles.sectionLabel}>DEINE MAHLZEITEN</Text>
          {meals.map((meal, index) => (
            <View key={meal.id}>
              <View style={styles.mealRow}>
                <Text style={styles.mealType}>{mealTypeLabel(meal.type)}</Text>
                <Text numberOfLines={1} style={styles.mealName}>{meal.title}</Text>
                <Text style={styles.mealCalories}>~{meal.calories}</Text>
              </View>
              {index < meals.length - 1 ? <View style={styles.divider} /> : null}
            </View>
          ))}
        </Card>
      ) : null}

      <Card style={styles.tomorrowCard}>
        <View style={styles.tomorrowTop}>
          <View style={styles.tomorrowIcon}><Ionicons color={colors.text} name="sunny-outline" size={20} /></View>
          <View style={styles.tomorrowCopy}>
            <Eyebrow>Morgen früh</Eyebrow>
            <Text style={styles.tomorrowTitle}>Dein erster Zug steht schon</Text>
          </View>
        </View>
        <Text style={styles.tomorrowText}>
          Frühstück mit {Math.round(targets.protein * 0.22 / 5) * 5} g+ Protein hält den Rest des Tages beweglich.
        </Text>
      </Card>

      {remindersSupported && !reminderEnabled && !reminderDismissed ? (
        <Card style={styles.offerCard}>
          <Text style={styles.offerTitle}>Soll ich dich abends erinnern?</Text>
          <Text style={styles.offerText}>
            Morgens dein Ziel, abends genau diese Karte. Zwei Nachrichten am Tag, keine Serien, keine Mahnungen, jederzeit abschaltbar.
          </Text>
          <PrimaryButton
            icon="notifications-outline"
            label="Ja, abends erinnern"
            onPress={() => void setEveningReminderEnabled(true, { calories: targets.calories, protein: targets.protein }).then(setReminderEnabled)}
          />
          <PrimaryButton label="Nicht jetzt" onPress={() => setReminderDismissed(true)} variant="ghost" />
        </Card>
      ) : null}

      <PrimaryButton icon="arrow-forward" label="Zum Tagesstand" onPress={() => router.replace('/(tabs)/today')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  topTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  heroCard: { backgroundColor: colors.text, borderColor: colors.text, gap: 22, paddingVertical: 24 },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  heroCopy: { flex: 1, minWidth: 0, gap: 6 },
  headline: { color: colors.white, fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.8 },
  badge: { width: 46, height: 46, borderRadius: 17, backgroundColor: 'rgba(187,220,142,0.16)', alignItems: 'center', justifyContent: 'center' },
  badgeAttention: { backgroundColor: 'rgba(200,155,75,0.18)' },
  numbersRow: { flexDirection: 'row', alignItems: 'center' },
  numberBlock: { flex: 1, minWidth: 0, gap: 4 },
  numberDivider: { width: 1, height: 42, backgroundColor: 'rgba(255,255,255,0.13)', marginHorizontal: 18 },
  number: { color: colors.white, fontSize: 26, fontWeight: '700', fontVariant: ['tabular-nums'] },
  numberLabel: { color: 'rgba(255,255,255,0.54)', fontSize: 10, lineHeight: 14 },
  verdict: { color: 'rgba(255,255,255,0.82)', fontSize: 14, lineHeight: 21 },
  mealsCard: { padding: 8, gap: 2 },
  sectionLabel: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 4 },
  mealRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10 },
  mealType: { width: 92, color: colors.text, fontSize: 13, fontWeight: '600' },
  mealName: { flex: 1, minWidth: 0, color: colors.muted, fontSize: 12 },
  mealCalories: { color: colors.text, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: 10 },
  tomorrowCard: { backgroundColor: colors.accentSoft, borderColor: colors.accent, gap: 14 },
  tomorrowTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tomorrowIcon: { width: 42, height: 42, borderRadius: 16, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  tomorrowCopy: { flex: 1, minWidth: 0, gap: 3 },
  tomorrowTitle: { color: colors.text, fontSize: 17, fontWeight: '600' },
  tomorrowText: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  offerCard: { gap: 12 },
  offerTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  offerText: { color: colors.muted, fontSize: 13, lineHeight: 20 },
});
