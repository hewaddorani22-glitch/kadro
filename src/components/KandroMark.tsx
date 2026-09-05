import { StyleProp, ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { useTheme } from '@/context/ThemeContext';

export function KandroMark({
  dotColor,
  size = 48,
  strokeColor,
  style,
}: {
  dotColor?: string;
  size?: number;
  strokeColor?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <Svg accessibilityLabel="Kandro" height={size} style={style} viewBox="0 0 64 64" width={size}>
      <Path
        d="M 47.56 16.44 A 22 22 0 1 1 16.44 16.44"
        fill="none"
        stroke={strokeColor ?? colors.accentText}
        strokeLinecap="round"
        strokeWidth="6.5"
      />
      <Circle cx="32" cy="7.5" fill={dotColor ?? colors.accent} r="4.8" />
    </Svg>
  );
}
