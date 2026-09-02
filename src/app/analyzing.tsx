import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { MealPhoto, PrimaryButton } from '@/components/ui';
import { colors, radii } from '@/constants/theme';
import { useApp } from '@/context/AppContext';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useLanguage } from '@/i18n/LanguageProvider';
import { AnalysisErrorKind } from '@/services/contracts';



export default function AnalyzingScreen() {
  const router = useRouter();
  const {
    analysisError,
    analysisMessage,
    analysisStatus,
    analyzeCurrentPhoto,
    detectedItems,
    photoUri,
    scanMode,
    scannedMeal,
    startDemoScan,
  } = useApp();
  const [visible, setVisible] = useState(0);
  const started = useRef(false);
  const reduceMotion = useReducedMotion();
  const { t } = useLanguage();
  const stages = [t.analyzing.stage1, t.analyzing.stage2, t.analyzing.stage3, t.analyzing.stage4];
  const errorCopy: Record<AnalysisErrorKind, { title: string; detail: string }> = {
    'not-configured': { title: t.analyzing.errNotConfiguredTitle, detail: t.analyzing.errNotConfiguredBody },
    offline: { title: t.analyzing.errOfflineTitle, detail: t.analyzing.errOfflineBody },
    'unclear-image': { title: t.analyzing.errUnclearTitle, detail: t.analyzing.errUnclearBody },
    'multiple-dishes': { title: t.analyzing.errMultipleTitle, detail: t.analyzing.errMultipleBody },
    'product-not-found': { title: t.analyzing.errProductTitle, detail: t.analyzing.errProductBody },
    'provider-error': { title: t.analyzing.errProviderTitle, detail: t.analyzing.errProviderBody },
  };
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  // A fixed 330pt photo pushed the retry buttons off small screens. Scale it to
  // the viewport and let the whole screen scroll as a fallback.
  const photoHeight = Math.round(Math.min(330, Math.max(180, windowHeight * 0.34)));

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void analyzeCurrentPhoto();
  }, [analyzeCurrentPhoto]);

  useEffect(() => {
    if (analysisStatus !== 'analyzing') return;
    if (reduceMotion) {
      setVisible(stages.length);
      return;
    }
    setVisible(0);
    const timers = stages.map((_, index) => setTimeout(() => setVisible(index + 1), 300 + index * 430));
    return () => timers.forEach(clearTimeout);
  }, [analysisStatus, reduceMotion]);

  useEffect(() => {
    if (analysisStatus !== 'ready') return;
    setVisible(stages.length);
    // The confirmation step cost a full screen and a tap on every single meal,
    // including the ones the model was sure about. It now appears only when
    // there is genuinely something to check: a hedged estimate, a warning from
    // the gateway, or an ingredient flagged as uncertain.
    const needsReview = scannedMeal.confidence === 'medium'
      || Boolean(analysisMessage)
      || detectedItems.some((item) => item.optional);
    const destination = needsReview ? '/confirm' : '/result';
    const timer = setTimeout(() => router.replace(destination), reduceMotion ? 0 : 260);
    return () => clearTimeout(timer);
  }, [analysisMessage, analysisStatus, detectedItems, reduceMotion, router, scannedMeal.confidence]);

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
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
      <View style={styles.topBar}>
        <Pressable accessibilityLabel={t.analyzing.close} accessibilityRole="button" onPress={() => router.replace('/(tabs)/scan')} style={styles.closeButton}>
          <Ionicons color={colors.text} name="close" size={23} />
        </Pressable>
        <Text style={styles.topTitle}>{t.analyzing.title}</Text>
        <View style={styles.closeButtonSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        <View style={styles.photoWrap}>
          <MealPhoto height={photoHeight} placeholder={scanMode === 'barcode' ? 'barcode' : scanMode === 'description' ? 'description' : 'demo'} uri={photoUri} />
          {!failed ? <View style={styles.scanLine} /> : null}
          <View style={styles.analyzingPill}>
            <View style={[styles.liveDot, failed && styles.warningDot]} />
            <Text style={styles.analyzingPillText}>{failed ? t.analyzing.badgeCheck : t.analyzing.badgeAnalysing}</Text>
          </View>
        </View>

        <View style={styles.content}>
          <View style={[styles.sparkleCircle, failed && styles.warningCircle]}>
            <Ionicons color={colors.text} name={failed ? 'alert-outline' : 'sparkles'} size={25} />
          </View>
          <Text accessibilityLiveRegion="polite" style={styles.title}>{failed ? error?.title : t.analyzing.working}</Text>
          <Text style={styles.subtitle}>
            {failed ? analysisMessage ?? error?.detail : t.analyzing.workingText}
          </Text>

          {failed ? (
            <View style={styles.actions}>
              {analysisError === 'product-not-found' ? (
                <>
                  <PrimaryButton
                    icon="create-outline"
                    label={t.analyzing.describeInstead}
                    onPress={() => router.replace('/(tabs)/scan?mode=description')}
                  />
                  <PrimaryButton label={t.analyzing.changeInput} onPress={() => router.replace('/(tabs)/scan')} variant="ghost" />
                </>
              ) : (
                <>
                  {analysisError !== 'not-configured' ? <PrimaryButton icon="refresh" label={t.analyzing.retry} onPress={retry} /> : null}
                  <PrimaryButton label={t.analyzing.openDemo} onPress={runDemo} variant={analysisError === 'not-configured' ? 'primary' : 'secondary'} />
                  <PrimaryButton label={t.analyzing.changeInput} onPress={() => router.replace('/(tabs)/scan')} variant="ghost" />
                </>
              )}
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  topBar: { height: 58, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  closeButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  closeButtonSpacer: { width: 40, height: 40 },
  topTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  photoWrap: { marginHorizontal: 20 },
  scanLine: { position: 'absolute', left: 16, right: 16, top: '48%', height: 2, backgroundColor: colors.accent },
  analyzingPill: { position: 'absolute', top: 14, left: 14, height: 30, borderRadius: 15, backgroundColor: 'rgba(23,24,22,0.75)', paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent },
  warningDot: { backgroundColor: colors.attention },
  analyzingPillText: { color: colors.white, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  content: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 30, paddingTop: 28 },
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
