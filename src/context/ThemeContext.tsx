import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Appearance, Platform } from 'react-native';
import { darkColors, lightColors, ThemeColors } from '@/constants/theme';

type ThemeMode = 'light' | 'dark';
const STORAGE_KEY = 'kandro:appearance:v1';
const ThemeContext = createContext({ mode: 'light' as ThemeMode, colors: lightColors as ThemeColors, setMode: (_mode: ThemeMode) => {} });

export function ThemeProvider({ children }: PropsWithChildren) {
  const [mode, updateMode] = useState<ThemeMode>('light');
  const [ready, setReady] = useState(false);
  const writes = useRef(Promise.resolve());
  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(STORAGE_KEY).then((value) => {
      if (active) updateMode(value === 'dark' ? 'dark' : 'light');
    }).catch(() => undefined).finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);
  useEffect(() => { if (Platform.OS !== 'web') Appearance.setColorScheme(mode); }, [mode]);
  const value = useMemo(() => ({
    mode, colors: mode === 'dark' ? darkColors : lightColors,
    setMode: (next: ThemeMode) => {
      updateMode(next);
      writes.current = writes.current.then(() => AsyncStorage.setItem(STORAGE_KEY, next)).catch(() => undefined);
    },
  }), [mode]);
  if (!ready) return null;
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
export function useThemedStyles<T>(factory: (colors: ThemeColors) => T): T {
  const { colors } = useTheme();
  return useMemo(() => factory(colors), [factory, colors]);
}
