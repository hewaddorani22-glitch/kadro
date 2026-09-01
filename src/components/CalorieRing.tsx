import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { colors } from '@/constants/theme';
import { useLanguage } from '@/i18n/LanguageProvider';
import { formatNumber } from '@/utils/format';

// Screen padding (2 x 20) plus hero card padding (2 x 20).
const HORIZONTAL_CHROME = 80;
const MAX_SIZE = 220;
const MIN_SIZE = 168;

export function CalorieRing({
  consumed,
  total,
  proteinReached = false,
}: {
  consumed: number;
  total: number;
  /** Quietly acknowledges the one goal the user actually controls. */
  proteinReached?: boolean;
}) {
  const { width } = useWindowDimensions();
  const { locale, t } = useLanguage();
  // The ring used to be a hard 220pt, which overflowed the hero card on the
  // narrowest phones. It now shrinks with the viewport instead.
  const size = Math.round(Math.min(MAX_SIZE, Math.max(MIN_SIZE, width - HORIZONTAL_CHROME)));
  const stroke = Math.round(size * 0.077);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const safeTotal = total > 0 ? total : 1;
  const remaining = Math.max(0, total - consumed);
  const over = Math.max(0, consumed - total);
  const consumedRatio = Math.min(1, Math.max(0, consumed / safeTotal));
  const ringColor = over > 0 ? colors.attention : colors.accentDeep;
  const statusColor = over > 0 ? colors.attention : colors.success;
  const celebrating = proteinReached && over === 0;

  return (
    <View
      accessibilityLabel={over > 0
        ? `${over} ${t.ring.over}`
        : `${remaining} ${t.ring.left}`}
      style={styles.outer}
    >
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg height={size} style={styles.svg} width={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            fill="none"
            r={radius}
            stroke={colors.neutralSoft}
            strokeWidth={stroke}
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            fill="none"
            r={radius}
            stroke={ringColor}
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - consumedRatio)}
            strokeLinecap="round"
            strokeWidth={stroke}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
        <View style={styles.inner}>
          <Text
            adjustsFontSizeToFit
            numberOfLines={1}
            style={[styles.value, { fontSize: Math.round(size * 0.223), lineHeight: Math.round(size * 0.245) }]}
          >
            {formatNumber(over > 0 ? over : remaining, locale)}
          </Text>
          <Text style={styles.label}>{over > 0 ? t.ring.over : t.ring.left}</Text>
          <View style={styles.statusRow}>
            {celebrating
              ? <Ionicons color={statusColor} name="checkmark-circle" size={13} />
              : <View style={[styles.statusDot, { backgroundColor: statusColor }]} />}
            <Text style={[styles.status, { color: statusColor }]}>
              {over > 0 ? t.ring.slightlyOver : celebrating ? t.ring.proteinDone : t.ring.inPlan}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  svg: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  value: {
    color: colors.text,
    fontWeight: '700',
    letterSpacing: -1.7,
    fontVariant: ['tabular-nums'],
  },
  label: {
    color: colors.muted,
    fontSize: 15,
    marginTop: -2,
  },
  statusRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  status: {
    fontSize: 12,
    fontWeight: '700',
  },
});
