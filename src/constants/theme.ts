export const colors = {
  background: '#F5F3EE',
  surface: '#FFFFFF',
  text: '#14150F',
  muted: '#6E7066',
  border: '#E4E2D9',
  accent: '#BBDC8E',
  accentSoft: '#EFF6E3',
  accentDeep: '#3F5233',
  neutralSoft: '#F0EFE9',
  success: '#3F5233',
  successSoft: '#F0F1EC',
  attention: '#C89B4B',
  attentionSoft: '#F6EFE1',
  error: '#8A5D28',
  camera: '#14150F',
  cameraSoft: '#25261F',
  white: '#FFFFFF',
} as const;

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

export const shadows = {
  scan: {
    shadowColor: '#14150F',
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
} as const;

export const typeScale = {
  display: 56,
  title: 32,
  heading: 22,
  body: 17,
  compact: 15,
  caption: 13,
  micro: 11,
} as const;
