import Ionicons from '@expo/vector-icons/Ionicons';
import { useSegments } from 'expo-router';
import { PropsWithChildren, ReactNode } from 'react';
import {
  Image,
  ImageSourcePropType,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radii, spacing } from '@/constants/theme';
import { TAB_BAR_CONTENT_HEIGHT } from '@/constants/layout';

type ButtonProps = {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  variant?: 'primary' | 'secondary' | 'dark' | 'ghost';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function PrimaryButton({
  label,
  onPress,
  icon,
  variant = 'primary',
  disabled,
  style,
}: ButtonProps) {
  const dark = variant === 'dark';
  const ghost = variant === 'ghost';
  const secondary = variant === 'secondary';
  const lightText = variant === 'primary' || dark;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        dark && styles.buttonDark,
        secondary && styles.buttonSecondary,
        ghost && styles.buttonGhost,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      <Text style={[styles.buttonText, lightText && styles.buttonTextLight, ghost && styles.buttonTextDark]}>
        {label}
      </Text>
      {icon ? (
        <Ionicons
          color={lightText ? colors.white : colors.text}
          name={icon}
          size={18}
        />
      ) : null}
    </Pressable>
  );
}

export function Screen({
  children,
  scroll = true,
  style,
}: PropsWithChildren<{ scroll?: boolean; style?: StyleProp<ViewStyle> }>) {
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  // Tab screens scroll underneath the floating tab bar, every other screen only
  // has to clear the home indicator. Both used to share one hard-coded 126pt
  // padding, which cut content off on tall-inset phones and wasted space on the
  // rest.
  const underTabBar = segments[0] === '(tabs)';
  const paddingBottom = underTabBar
    ? TAB_BAR_CONTENT_HEIGHT + insets.bottom + spacing.xl
    : insets.bottom + spacing.xxl;

  if (!scroll) {
    return (
      <SafeAreaView edges={['top']} style={[styles.safe, style]}>
        {children}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, style]}>
      <ScrollView
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        contentContainerStyle={[styles.scrollContent, { paddingBottom }]}
        contentInsetAdjustmentBehavior="never"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Card({
  children,
  style,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Eyebrow({ children, light = false }: PropsWithChildren<{ light?: boolean }>) {
  return <Text style={[styles.eyebrow, light && styles.lightText]}>{children}</Text>;
}

export function PageTitle({ children }: PropsWithChildren) {
  return <Text style={styles.pageTitle}>{children}</Text>;
}

export function SectionTitle({ children, action }: PropsWithChildren<{ action?: ReactNode }>) {
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {action}
    </View>
  );
}

export function ProgressBar({ value, color = colors.accentDeep }: { value: number; color?: string }) {
  const percentage = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: percentage }} style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${percentage}%`, backgroundColor: color }]} />
    </View>
  );
}

export function MacroCard({
  label,
  current,
  target,
  unit = 'g',
  icon,
}: {
  label: string;
  current: number;
  target: number;
  unit?: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <Card style={styles.macroCard}>
      <View style={styles.macroIcon}>
        <Ionicons color={colors.text} name={icon} size={16} />
      </View>
      <Text numberOfLines={1} style={styles.macroLabel}>{label}</Text>
      <Text style={styles.macroValue}>{current}</Text>
      <Text style={styles.macroTarget}>von {target}{unit}</Text>
      <ProgressBar value={current / target} />
    </Card>
  );
}

export function ConfidenceBadge({ uncertain = false }: { uncertain?: boolean }) {
  return (
    <View style={[styles.confidence, uncertain && styles.confidenceUncertain]}>
      <Ionicons
        color={uncertain ? colors.attention : colors.success}
        name={uncertain ? 'help-circle' : 'checkmark-circle'}
        size={14}
      />
      <Text style={[styles.confidenceText, uncertain && styles.confidenceTextUncertain]}>
        {uncertain ? 'Portion unsicher' : 'Hohe Sicherheit'}
      </Text>
    </View>
  );
}

export function MealPhoto({ uri, height = 250, placeholder = 'demo', style }: { uri?: string | null; height?: number; placeholder?: 'demo' | 'description' | 'barcode'; style?: StyleProp<ViewStyle> }) {
  const source: ImageSourcePropType = uri ? { uri } : require('../../assets/meal-bowl.jpg');
  if (!uri && placeholder !== 'demo') {
    const barcode = placeholder === 'barcode';
    return (
      <View accessibilityLabel={barcode ? 'Mahlzeit über Barcode erfasst' : 'Mahlzeit per Beschreibung erfasst'} accessible style={[styles.photoFrame, styles.photoPlaceholder, { height }, style]}>
        <View style={styles.photoPlaceholderIcon}>
          <Ionicons color={colors.text} name={barcode ? 'barcode-outline' : 'create-outline'} size={36} />
        </View>
        <Text style={styles.photoPlaceholderTitle}>{barcode ? 'Barcode erkannt' : 'Mahlzeit beschrieben'}</Text>
        <Text style={styles.photoPlaceholderText}>{barcode ? 'Die Portion bestätigst du im nächsten Schritt.' : 'Deine Angaben werden mit Nährwertdaten abgeglichen.'}</Text>
      </View>
    );
  }
  return (
    <View style={[styles.photoFrame, { height }, style]}>
      <Image
        accessibilityLabel={uri ? 'Foto der aufgenommenen Mahlzeit' : 'Demo-Mahlzeit: Hähnchen-Reis-Bowl'}
        accessible
        resizeMode="cover"
        source={source}
        style={styles.photo}
      />
      {!uri ? (
        <View style={styles.demoBadge}>
          <Text style={styles.demoBadgeText}>DEMO-MAHLZEIT</Text>
        </View>
      ) : null}
    </View>
  );
}

export function IconCircle({
  name,
  tone = 'accent',
  size = 44,
}: {
  name: keyof typeof Ionicons.glyphMap;
  tone?: 'accent' | 'neutral' | 'dark';
  size?: number;
}) {
  return (
    <View
      style={[
        styles.iconCircle,
        { width: size, height: size, borderRadius: size / 2 },
        tone === 'neutral' && styles.iconCircleNeutral,
        tone === 'dark' && styles.iconCircleDark,
      ]}
    >
      <Ionicons color={tone === 'dark' ? colors.white : colors.text} name={name} size={Math.round(size * 0.45)} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
  },
  button: {
    minHeight: 56,
    borderRadius: radii.button,
    backgroundColor: colors.accentDeep,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  buttonDark: {
    backgroundColor: colors.text,
  },
  buttonSecondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonGhost: {
    backgroundColor: 'transparent',
    minHeight: 44,
  },
  buttonDisabled: {
    opacity: 0.42,
  },
  buttonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  buttonTextLight: {
    color: colors.white,
  },
  buttonTextDark: {
    color: colors.text,
  },
  pressed: {
    opacity: 0.76,
    transform: [{ scale: 0.988 }],
  },
  eyebrow: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  lightText: {
    color: 'rgba(255,255,255,0.72)',
  },
  pageTitle: {
    color: colors.text,
    fontSize: 34,
    lineHeight: 39,
    fontWeight: '700',
    letterSpacing: -1.1,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  progressTrack: {
    width: '100%',
    height: 6,
    overflow: 'hidden',
    borderRadius: 6,
    backgroundColor: colors.border,
  },
  progressFill: {
    height: '100%',
    borderRadius: 6,
  },
  macroCard: {
    flex: 1,
    minWidth: 0,
    padding: 14,
    borderRadius: 20,
    gap: 4,
  },
  macroIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.neutralSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  macroLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  macroValue: {
    color: colors.text,
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  macroTarget: {
    color: colors.muted,
    fontSize: 11,
    marginBottom: 7,
    fontVariant: ['tabular-nums'],
  },
  confidence: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.neutralSoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  confidenceUncertain: {
    backgroundColor: colors.attentionSoft,
  },
  confidenceText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '700',
  },
  confidenceTextUncertain: {
    color: colors.attention,
  },
  photoFrame: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: radii.card,
    backgroundColor: colors.cameraSoft,
  },
  photoPlaceholder: { backgroundColor: colors.neutralSoft, alignItems: 'center', justifyContent: 'center', padding: 24 },
  photoPlaceholderIcon: { width: 70, height: 70, borderRadius: 26, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  photoPlaceholderTitle: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 13 },
  photoPlaceholderText: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 5, maxWidth: 260 },
  photo: {
    width: '100%',
    height: '100%',
  },
  demoBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    backgroundColor: 'rgba(23,24,22,0.72)',
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  demoBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  iconCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  iconCircleNeutral: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconCircleDark: {
    backgroundColor: colors.text,
  },
});
