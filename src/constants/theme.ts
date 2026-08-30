export const colors = {
  background: '#F6F5F1',
  surface: '#FFFFFF',
  text: '#171816',
  muted: '#73756F',
  border: '#E8E8E2',
  accent: '#B7D58A',
  accentSoft: '#EAF2DC',
  accentDeep: '#719148',
  success: '#6FA375',
  successSoft: '#E7F0E7',
  attention: '#D2A553',
  attentionSoft: '#F6ECD8',
  error: '#D5665E',
  camera: '#11130F',
  cameraSoft: '#23271F',
  white: '#FFFFFF',
} as const;

export const radii = {
  card: 24,
  button: 22,
  input: 18,
  pill: 999,
} as const;

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 44,
} as const;

export const shadows = {
  soft: {
    shadowColor: '#171816',
    shadowOpacity: 0.045,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
} as const;
