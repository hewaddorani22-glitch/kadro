import { useTheme, useThemedStyles } from '@/context/ThemeContext';
import type { ThemeColors } from '@/constants/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs, usePathname } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KandroMark } from '@/components/KandroMark';
import { TAB_BAR_CONTENT_HEIGHT } from '@/constants/layout';
import { useLanguage } from '@/i18n/LanguageProvider';
import { shadows } from '@/constants/theme';

type IconName = keyof typeof Ionicons.glyphMap;

function TabIcon({ focused, active, inactive }: { focused: boolean; active: IconName; inactive: IconName }) {
  const { colors } = useTheme();
  return <Ionicons color={focused ? colors.text : colors.muted} name={focused ? active : inactive} size={22} />;
}

export default function TabLayout() {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const hideBar = pathname === '/scan';
  // A fixed 86pt bar pushed the labels straight onto the home indicator on every
  // notched iPhone. The bar now grows with the real bottom inset instead.
  const barStyle = {
    height: TAB_BAR_CONTENT_HEIGHT + insets.bottom,
    paddingBottom: insets.bottom + 6,
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: styles.label,
        tabBarStyle: [styles.tabBar, barStyle, hideBar && styles.hiddenBar],
      }}
    >
      <Tabs.Screen
        name="today"
        options={{
          title: t.tabs.today,
          tabBarIcon: ({ focused }) => <TabIcon active="today" focused={focused} inactive="today-outline" />,
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          title: t.tabs.plan,
          tabBarIcon: ({ focused }) => <TabIcon active="sparkles" focused={focused} inactive="sparkles-outline" />,
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: '',
          tabBarLabel: () => null,
          tabBarIcon: () => null,
          tabBarButton: ({ onPress, accessibilityState }) => (
            <View style={styles.scanSlot}>
              <Pressable
                accessibilityLabel={t.tabs.scan}
                accessibilityRole="button"
                accessibilityState={accessibilityState}
                onPress={onPress}
                style={({ pressed }) => [styles.scanButton, pressed && styles.scanPressed]}
              >
                <KandroMark dotColor={colors.onAccent} strokeColor={colors.onAccent} size={38} />
              </Pressable>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: t.tabs.progress,
          tabBarIcon: ({ focused }) => <TabIcon active="stats-chart" focused={focused} inactive="stats-chart-outline" />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t.tabs.profile,
          tabBarIcon: ({ focused }) => <TabIcon active="person" focused={focused} inactive="person-outline" />,
        }}
      />
    </Tabs>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  tabBar: {
    position: 'absolute',
    paddingTop: 8,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    elevation: 0,
  },
  hiddenBar: {
    display: 'none',
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  scanSlot: {
    flex: 1,
    alignItems: 'center',
  },
  scanButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accent,
    borderWidth: 5,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -27,
    ...shadows.scan,
  },
  scanPressed: {
    transform: [{ scale: 0.94 }],
  },
});
