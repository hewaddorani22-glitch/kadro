import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MealPhoto, PrimaryButton } from '@/components/ui';
import { colors, radii } from '@/constants/theme';
import { useApp } from '@/context/AppContext';
import { AnalysisErrorKind } from '@/services/contracts';

const stages = ['Foto vorbereitet', 'Lebensmittel erkannt', 'Nährwerte abgeglichen', 'Bereit zur Bestätigung'];

const errorCopy: Record<AnalysisErrorKind, { title: string; detail: string }> = {
  'not-configured': {
    title: 'Echte Analyse noch nicht verbunden',
    detail: 'Starte den lokalen Kadro-Server und setze EXPO_PUBLIC_ANALYSIS_API_URL. Die Demo funktioniert sofort.',
  },
  offline: {
    title: 'Scan lokal vorgemerkt',
    detail: 'Sobald die Verbindung wieder da ist, kannst du diesen Scan erneut analysieren.',
  },
  'unclear-image': {
    title: 'Foto nicht eindeutig',
    detail: 'Bitte fotografiere den ganzen Teller bei gutem Licht und ohne starke Unschärfe.',
  },
  'multiple-dishes': {
    title: 'Mehrere Mahlzeiten erkannt',
    detail: 'Für eine verlässliche Schätzung sollte nur ein Teller vollständig im Bild sein.',
  },
  'provider-error': {
    title: 'Analyse gerade nicht möglich',
    detail: 'Der Scan bleibt lokal vorgemerkt. Versuche es gleich noch einmal.',
  },
};

export default function AnalyzingScreen() {
  const router = useRouter();
  const {
    analysisError,
    analysisMessage,
    analysisStatus,
    analyzeCurrentPhoto,
    photoUri,
    startDemoScan,
  } = useApp();
  const [visible, setVisible] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void analyzeCurrentPhoto();
  }, [analyzeCurrentPhoto]);

  useEffect(() => {
    if (analysisStatus !== 'analyzing') return;
    setVisible(0);
    const timers = stages.map((_, index) => setTimeout(() => setVisible(index + 1), 300 + index * 430));
    return () => timers.forEach(clearTimeout);
  }, [analysisStatus]);

  useEffect(() => {
    if (analysisStatus !== 'ready') return;
    setVisible(stages.length);
    const timer = setTimeout(() => router.replace('/confirm'), 260);
    return () => clearTimeout(timer);
  }, [analysisStatus, router]);

  const runDemo = () => {
    startDemoScan();
    started.current = true;
    void analyzeCurrentPhoto(true);
  };

  const retry = () => {
    started.current = true;
    void analyzeCurrentPhoto();
  };

  const error = analysisError ? errorCopy[analysisError] : null;
  const failed = analysisStatus === 'error' || analysisStatus === 'queued';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.replace('/(tabs)/scan')} style={styles.closeButton}>
          <Ionicons color={colors.text} name="close" size={23} />
        </Pressable>
        <Text style={styles.topTitle}>Mahlzeitenanalyse</Text>
        <View style={styles.closeButton} />
      </View>

      <View style={styles.photoWrap}>
        <MealPhoto height={330} uri={photoUri} />
        {!failed ? <View style={styles.scanLine} /> : null}
        <View style={styles.analyzingPill}>
          <View style={[styles.liveDot, failed && styles.warningDot]} />
          <Text style={styles.analyzingPillText}>{failed ? 'PRÜFEN' : 'ANALYSE'}</Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={[styles.sparkleCircle, failed && styles.warningCircle]}>
          <Ionicons color={colors.text} name={failed ? 'alert-outline' : 'sparkles'} size={25} />
        </View>
        <Text style={styles.title}>{failed ? error?.title : 'Wir analysieren deine Mahlzeit …'}</Text>
        <Text style={styles.subtitle}>
          {failed ? analysisMessage ?? error?.detail : 'Kadro erkennt Lebensmittel und schätzt Portionen. Im nächsten Schritt bestätigst du alles.'}
        </Text>

        {failed ? (
          <View style={styles.actions}>
            {analysisError !== 'not-configured' ? <PrimaryButton icon="refresh" label="Erneut versuchen" onPress={retry} /> : null}
            <PrimaryButton label="Demo-Mahlzeit öffnen" onPress={runDemo} variant={analysisError === 'not-configured' ? 'primary' : 'secondary'} />
            <PrimaryButton label="Foto wiederholen" onPress={() => router.replace('/(tabs)/scan')} variant="ghost" />
          </View>
        ) : (
          <View style={styles.chips}>
            {stages.map((stage, index) => (
              <View key={stage} style={[styles.chip, index >= visible && styles.chipWaiting]}>
                <Ionicons color={index < visible ? colors.success : colors.muted} name={index < visible ? 'checkmark-circle' : 'ellipse-outline'} size={17} />
                <Text style={[styles.chipText, index >= visible && styles.chipTextWaiting]}>{stage}</Text>
              </View>
            ))}
          </View>
        )}
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
  warningDot: { backgroundColor: colors.attention },
  analyzingPillText: { color: colors.white, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  content: { flex: 1, alignItems: 'center', paddingHorizontal: 30, paddingTop: 28 },
  sparkleCircle: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  warningCircle: { backgroundColor: colors.attentionSoft },
  title: { color: colors.text, fontSize: 24, fontWeight: '700', letterSpacing: -0.5, marginTop: 14, textAlign: 'center' },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 7, maxWidth: 340 },
  chips: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 22 },
  chip: { minHeight: 38, borderRadius: radii.pill, backgroundColor: colors.successSoft, borderWidth: 1, borderColor: '#D6E6D7', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipWaiting: { backgroundColor: colors.surface, borderColor: colors.border },
  chipText: { color: colors.text, fontSize: 12, fontWeight: '600' },
  chipTextWaiting: { color: colors.muted },
  actions: { alignSelf: 'stretch', gap: 8, marginTop: 22 },
});
