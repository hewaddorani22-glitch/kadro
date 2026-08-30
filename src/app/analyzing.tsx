import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MealPhoto } from '@/components/ui';
import { colors, radii } from '@/constants/theme';
import { useApp } from '@/context/AppContext';

const stages = ['Gegrilltes Hähnchen', 'Weißer Reis', 'Avocado', 'Sesamsauce'];

export default function AnalyzingScreen() {
  const router = useRouter();
  const { photoUri } = useApp();
  const [visible, setVisible] = useState(0);

  useEffect(() => {
    const timers = stages.map((_, index) => setTimeout(() => setVisible(index + 1), 500 + index * 520));
    const navigationTimer = setTimeout(() => router.replace('/confirm'), 3000);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(navigationTimer);
    };
  }, [router]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.closeButton}>
          <Ionicons color={colors.text} name="close" size={23} />
        </Pressable>
        <Text style={styles.topTitle}>Mahlzeitenanalyse</Text>
        <View style={styles.closeButton} />
      </View>

      <View style={styles.photoWrap}>
        <MealPhoto height={330} uri={photoUri} />
        <View style={styles.scanLine} />
        <View style={styles.analyzingPill}>
          <View style={styles.liveDot} />
          <Text style={styles.analyzingPillText}>ANALYSE</Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.sparkleCircle}>
          <Ionicons color={colors.text} name="sparkles" size={25} />
        </View>
        <Text style={styles.title}>Wir analysieren deine Mahlzeit …</Text>
        <Text style={styles.subtitle}>Kadro erkennt Lebensmittel und schätzt Portionen. Im nächsten Schritt bestätigst du alles.</Text>

        <View style={styles.chips}>
          {stages.map((stage, index) => (
            <View key={stage} style={[styles.chip, index >= visible && styles.chipWaiting]}>
              <Ionicons color={index < visible ? colors.success : colors.muted} name={index < visible ? 'checkmark-circle' : 'ellipse-outline'} size={17} />
              <Text style={[styles.chipText, index >= visible && styles.chipTextWaiting]}>{stage}</Text>
            </View>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  topBar: { height: 58, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  closeButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  topTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  photoWrap: { marginHorizontal: 20 },
  scanLine: { position: 'absolute', left: 16, right: 16, top: '48%', height: 2, backgroundColor: colors.accent },
  analyzingPill: { position: 'absolute', top: 14, left: 14, height: 30, borderRadius: 15, backgroundColor: 'rgba(23,24,22,0.75)', paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent },
  analyzingPillText: { color: colors.white, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  content: { flex: 1, alignItems: 'center', paddingHorizontal: 30, paddingTop: 28 },
  sparkleCircle: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, fontSize: 24, fontWeight: '700', letterSpacing: -0.5, marginTop: 14 },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 7, maxWidth: 330 },
  chips: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 22 },
  chip: { minHeight: 38, borderRadius: radii.pill, backgroundColor: colors.successSoft, borderWidth: 1, borderColor: '#D6E6D7', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipWaiting: { backgroundColor: colors.surface, borderColor: colors.border },
  chipText: { color: colors.text, fontSize: 12, fontWeight: '600' },
  chipTextWaiting: { color: colors.muted },
});
