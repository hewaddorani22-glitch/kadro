export const lightColors = {
  background: '#F5F3EE',
  surface: '#FFFFFF',
  text: '#14150F',
  muted: '#6E7066',
  border: '#E4E2D9',
  accent: '#BBDC8E',
  accentSoft: '#EFF6E3',
  accentDeep: '#3F5233',
  accentText: '#3F5233',
  neutralSoft: '#F0EFE9',
  success: '#3F5233',
  successSoft: '#F0F1EC',
  /** Fills, bars and borders only: 2.5:1 on white is too faint for text. */
  attention: '#C89B4B',
  /** Amber for text and meaningful icons: 5.4:1 or better on surface, canvas and attentionSoft. */
  attentionText: '#7F5A1E',
  attentionSoft: '#F6EFE1',
  error: '#8A5D28',
  camera: '#14150F',
  cameraSoft: '#25261F',
  white: '#FFFFFF',
  onAccent: '#14150F',
  onDeep: '#FFFFFF',
  // Macro colours are for bars and dots. Their labels stay ink or muted:
  // carbs amber is 2.3:1 on white and would fail as text.
  macroProtein: '#5E8C3A',
  macroCarbs: '#D9A441',
  macroFat: '#C9775A',
} as const;

export type ThemeColors = { [Key in keyof typeof lightColors]: string };
export const darkColors: ThemeColors = {
  background: '#10120E',
  surface: '#191C16',
  text: '#F4F3EC',
  muted: '#A8AA9F',
  border: '#30342A',
  accent: '#BBDC8E',
  accentSoft: '#202A1C',
  accentDeep: '#3F5233',
  accentText: '#BBDC8E',
  neutralSoft: '#22251F',
  success: '#BBDC8E',
  successSoft: '#1C281B',
  attention: '#D7AA56',
  attentionText: '#D7AA56',
  attentionSoft: '#302719',
  error: '#E2A16C',
  camera: '#0C0E0B',
  cameraSoft: '#171A15',
  white: '#FFFFFF',
  onAccent: '#14150F',
  onDeep: '#FFFFFF',
  macroProtein: '#9CCB6E',
  macroCarbs: '#E5BA5E',
  macroFat: '#DE937A',
};

/**
 * The first launch follows the system appearance. Screens subscribe to
 * ThemeProvider; this fallback is only for the outer error boundary and pure defaults.
 */
export const colors = lightColors;

export const radii = {
  card: 18,
  sheet: 28,
  button: 999,
  chip: 12,
  input: 14,
  pill: 999,
} as const;

export const spacing = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
} as const;

/** The only shadow in the app: the central Scan button. It follows the active theme. */
export function scanShadow(mode: 'light' | 'dark') {
  const dark = mode === 'dark';
  return {
    shadowColor: dark ? '#000000' : '#14150F',
    shadowOpacity: dark ? 0.28 : 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  } as const;
}

export const typeScale = {
  display: 56,
  title: 32,
  heading: 22,
  body: 17,
  compact: 15,
  caption: 13,
  /** The floor: no rendered text goes below 12 pt. */
  micro: 12,
} as const;
