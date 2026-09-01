import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/ui';
import { legalVersion } from '@/constants/legal';
import { colors, radii } from '@/constants/theme';

export type LegalSection = {
  title: string;
  paragraphs: string[];
};

export function LegalDocument({ title, intro, sections }: { title: string; intro: string; sections: LegalSection[] }) {
  const router = useRouter();
  return (
    <Screen>
      <View style={styles.topBar}>
        <Pressable accessibilityLabel="Zurück" accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
          <Ionicons color={colors.text} name="arrow-back" size={22} />
        </Pressable>
        <Text style={styles.topTitle}>Rechtliches</Text>
        <View style={styles.backButton} />
      </View>
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        <Text style={styles.version}>Version {legalVersion}</Text>
        <Text style={styles.intro}>{intro}</Text>
      </View>
      {sections.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>{section.title}</Text>
          {section.paragraphs.map((paragraph) => <Text key={paragraph} style={styles.paragraph}>{paragraph}</Text>)}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  topTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  heading: { gap: 9 },
  title: { color: colors.text, fontSize: 32, lineHeight: 38, fontWeight: '700', letterSpacing: -0.8 },
  version: { color: colors.muted, fontSize: 11 },
  intro: { color: colors.text, fontSize: 15, lineHeight: 23, marginTop: 5 },
  section: { borderRadius: radii.card, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 20, gap: 10 },
  sectionTitle: { color: colors.text, fontSize: 18, lineHeight: 23, fontWeight: '700' },
  paragraph: { color: colors.muted, fontSize: 13, lineHeight: 20 },
});
