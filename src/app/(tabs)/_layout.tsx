import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs, usePathname } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { KadroMark } from '@/components/KadroMark';
import { colors, shadows } from '@/constants/theme';

type IconName = keyof typeof Ionicons.glyphMap;

function TabIcon({ focused, active, inactive }: { focused: boolean; active: IconName; inactive: IconName }) {
  return <Ionicons color={focused ? colors.text : colors.muted} name={focused ? active : inactive} size={22} />;
}

export default function TabLayout() {
  const pathname = usePathname();
  const hideBar = pathname === '/scan';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: styles.label,
        tabBarStyle: [styles.tabBar, hideBar && styles.hiddenBar],
      }}
    >
      <Tabs.Screen
        name="today"
        options={{
          title: 'Heute',
          tabBarIcon: ({ focused }) => <TabIcon active="today" focused={focused} inactive="today-outline" />,
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          title: 'Plan',
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
                accessibilityLabel="Mahlzeit scannen"
                accessibilityRole="button"
                accessibilityState={accessibilityState}
                onPress={onPress}
                style={({ pressed }) => [styles.scanButton, pressed && styles.scanPressed]}
              >
                <KadroMark dotColor={colors.white} size={38} />
              </Pressable>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Verlauf',
          tabBarIcon: ({ focused }) => <TabIcon active="stats-chart" focused={focused} inactive="stats-chart-outline" />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Du',
          tabBarIcon: ({ focused }) => <TabIcon active="person" focused={focused} inactive="person-outline" />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    height: 86,
    paddingTop: 10,
    paddingBottom: 14,
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
