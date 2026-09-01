import { StyleProp, ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { colors } from '@/constants/theme';

export function KandroMark({
  dotColor = colors.accent,
  size = 48,
  strokeColor = colors.accentDeep,
  style,
}: {
  dotColor?: string;
  size?: number;
  strokeColor?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Svg accessibilityLabel="Kandro" height={size} style={style} viewBox="0 0 64 64" width={size}>
      <Path
        d="M 47.56 16.44 A 22 22 0 1 1 16.44 16.44"
        fill="none"
        stroke={strokeColor}
        strokeLinecap="round"
        strokeWidth="6.5"
      />
      <Circle cx="32" cy="7.5" fill={dotColor} r="4.8" />
    </Svg>
  );
}
