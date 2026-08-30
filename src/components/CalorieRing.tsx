import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { colors } from '@/constants/theme';
import { formatNumber } from '@/utils/format';

export function CalorieRing({ remaining, total }: { remaining: number; total: number }) {
  const size = 220;
  const stroke = 17;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const consumedRatio = Math.min(1, Math.max(0, (total - remaining) / total));

  return (
    <View accessibilityLabel={`${remaining} Kilokalorien übrig`} style={styles.outer}>
      <View style={styles.track}>
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
            stroke={colors.accentDeep}
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - consumedRatio)}
            strokeLinecap="round"
            strokeWidth={stroke}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
        <View style={styles.inner}>
          <Text style={styles.value}>{formatNumber(remaining)}</Text>
          <Text style={styles.label}>kcal übrig</Text>
          <View style={styles.statusRow}>
            <View style={styles.statusDot} />
            <Text style={styles.status}>Im Plan</Text>
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
  track: {
    width: 220,
    height: 220,
    borderRadius: 110,
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
  },
  value: {
    color: colors.text,
    fontSize: 49,
    lineHeight: 54,
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
    backgroundColor: colors.success,
  },
  status: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '700',
  },
});
