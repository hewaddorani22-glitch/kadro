import Ionicons from '@expo/vector-icons/Ionicons';
import { BarcodeScanningResult, CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { usePathname, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { FREE_SCAN_ALLOWANCE } from '@/constants/product';
import { colors, radii } from '@/constants/theme';
import { useApp } from '@/context/AppContext';
import { useSubscription } from '@/context/SubscriptionContext';

export default function ScanScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const { freeScansLeft, hasEverLoggedScan, setCapturedPhoto, startBarcodeScan, startDemoScan, startDescriptionScan } = useApp();
  const { status: subscriptionStatus } = useSubscription();
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [mode, setMode] = useState<'photo' | 'description' | 'barcode'>('photo');
  const [description, setDescription] = useState('');
  const [showDescription, setShowDescription] = useState(false);
  const [barcodeBusy, setBarcodeBusy] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const insets = useSafeAreaInsets();
  const cameraActive = pathname.endsWith('/scan') && mode !== 'description' && permission?.granted === true;

  useEffect(() => {
    setCameraReady(false);
    setBarcodeBusy(false);
  }, [cameraActive, mode]);

  const requestCameraAccess = async () => {
    if (permission && !permission.canAskAgain) {
      Alert.alert(
        'Kamera in den Einstellungen erlauben',
        'Öffne die Einstellungen deines Geräts, wähle Kandro und aktiviere dort die Kamera.',
        [
          { text: 'Abbrechen', style: 'cancel' },
          { text: 'Einstellungen öffnen', onPress: () => void Linking.openSettings() },
        ],
      );
      return;
    }

    const nextPermission = await requestPermission();
    if (!nextPermission.granted) {
      Alert.alert(
        'Kamerazugriff fehlt',
        nextPermission.canAskAgain
          ? 'Bitte erlaube den Kamerazugriff, damit Kandro dein Essen fotografieren kann.'
          : 'Aktiviere die Kamera bitte in den Geräteeinstellungen unter Kandro.',
      );
    }
  };

  const close = () => router.replace('/(tabs)/today');

  const subscribed = subscriptionStatus === 'active';
  // hasEverLoggedScan is kept so the copy can distinguish a first-time user from
  // someone who has simply used up the allowance.
  const showAllowance = !subscribed && freeScansLeft > 0 && hasEverLoggedScan;

  const hasScanAccess = () => {
    if (subscribed || freeScansLeft > 0) return true;
    // The paywall reads very differently when it interrupted someone mid-scan
    // than when it was opened out of curiosity.
    router.push('/paywall?reason=blocked');
    return false;
  };

  const capture = async () => {
    if (capturing) return;
    if (!hasScanAccess()) return;
    setCapturing(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      if (!permission?.granted || !cameraReady || !cameraRef.current) {
        Alert.alert('Kamera noch nicht bereit', 'Erlaube die Kamera oder nutze rechts den Demo-Button.');
        return;
      }
      const result = await cameraRef.current.takePictureAsync({ quality: 0.9 });
      if (!result?.uri) throw new Error('missing camera uri');
      setCapturedPhoto(result.uri);
      router.push('/analyzing');
    } catch {
      Alert.alert('Foto nicht aufgenommen', 'Bitte versuche es noch einmal oder nutze die Demo-Mahlzeit.');
    } finally {
      setCapturing(false);
    }
  };

  // The demo meal never reaches the analysis gateway, so it costs nothing and
  // must not spend one of the three free meals. A user trying it first should
  // not lose a third of their trial on a meal they did not eat.
  const runDemo = () => {
    startDemoScan();
    router.push('/analyzing');
  };

  const chooseMode = (nextMode: 'photo' | 'description' | 'barcode') => {
    setMode(nextMode);
    if (nextMode === 'description') setShowDescription(true);
  };

  const submitDescription = () => {
    const value = description.trim();
    if (value.length < 3) {
      Alert.alert('Beschreibung zu kurz', 'Schreibe kurz auf, was und ungefähr wie viel du gegessen hast.');
      return;
    }
    if (!hasScanAccess()) return;
    setShowDescription(false);
    startDescriptionScan(value);
    router.push('/analyzing');
  };

  const handleBarcode = ({ data }: BarcodeScanningResult) => {
    if (barcodeBusy || !/^\d{7,14}$/.test(data)) return;
    if (!hasScanAccess()) {
      setBarcodeBusy(true);
      return;
    }
    setBarcodeBusy(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    startBarcodeScan(data);
    router.push('/analyzing');
  };

  return (
    <View style={styles.container}>
      {cameraActive ? (
        <CameraView
          active={Platform.OS === 'ios' ? cameraActive : undefined}
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
          facing="back"
          onCameraReady={() => setCameraReady(true)}
          onBarcodeScanned={mode === 'barcode' ? handleBarcode : undefined}
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <View style={styles.fallback}>
          <View style={styles.fallbackOrb}>
            <Ionicons color={colors.accent} name="restaurant" size={58} />
          </View>
          <Text style={styles.fallbackTitle}>{mode === 'description' ? 'Mahlzeit beschreiben' : 'Zeig die ganze Mahlzeit'}</Text>
          <Text style={styles.fallbackText}>{mode === 'description' ? 'Zum Beispiel: eine Schüssel Pasta mit Hähnchen und etwas Sahnesauce.' : 'Natürliches Licht und eine klare Ansicht helfen bei der Portionsschätzung.'}</Text>
          {mode !== 'description' && !permission ? <Text style={styles.permissionStatus}>Kameraberechtigung wird geprüft …</Text> : null}
          {mode !== 'description' && permission && !permission.granted ? (
            <Pressable accessibilityRole="button" onPress={() => void requestCameraAccess()} style={styles.permissionButton}>
              <Ionicons color={colors.text} name="camera-outline" size={18} />
              <Text style={styles.permissionText}>{permission.canAskAgain ? 'Kamera erlauben' : 'Einstellungen öffnen'}</Text>
            </Pressable>
          ) : null}
        </View>
      )}

      <View style={styles.scrimTop} />
      <View style={styles.scrimBottom} />

      <SafeAreaView edges={['top', 'bottom']} style={styles.overlay}>
        <View style={styles.topBar}>
          <Pressable accessibilityLabel="Scanner schließen" accessibilityRole="button" onPress={close} style={styles.circleButton}>
            <Ionicons color={colors.white} name="close" size={24} />
          </Pressable>
          <View style={styles.titlePill}>
            <Ionicons color={colors.accent} name="sparkles" size={15} />
            <Text style={styles.screenTitle}>Mahlzeit scannen</Text>
          </View>
          <View style={styles.circlePlaceholder} />
        </View>

        {cameraActive ? (
          <View style={styles.guideArea}>
            <View style={styles.cornerTopLeft} />
            <View style={styles.cornerTopRight} />
            <View style={styles.cornerBottomLeft} />
            <View style={styles.cornerBottomRight} />
            <View style={styles.tipPill}>
              <View style={styles.tipDot} />
              <Text style={styles.tipText}>{mode === 'barcode' ? 'Barcode ruhig in den Rahmen halten' : 'Den ganzen Teller sichtbar halten'}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.guideSpacer} />
        )}

        <View style={styles.controls}>
          {showAllowance ? (
            <View style={styles.allowancePill}>
              <Ionicons color={colors.accent} name="sparkles" size={13} />
              <Text style={styles.allowanceText}>
                Noch {freeScansLeft} von {FREE_SCAN_ALLOWANCE} Mahlzeiten gratis
              </Text>
            </View>
          ) : null}
          <View accessibilityRole="radiogroup" style={styles.modeLabel}>
            <ModeButton active={mode === 'photo'} label="Foto" onPress={() => chooseMode('photo')} />
            <ModeButton active={mode === 'description'} label="Beschreiben" onPress={() => chooseMode('description')} />
            <ModeButton active={mode === 'barcode'} label="Barcode" onPress={() => chooseMode('barcode')} />
          </View>
          {mode === 'photo' ? (
            <View style={styles.shutterRow}>
              <View style={styles.smallPlaceholder} />
              <Pressable accessibilityLabel="Mahlzeit fotografieren" accessibilityRole="button" accessibilityState={{ disabled: capturing }} disabled={capturing} onPress={capture} style={({ pressed }) => [styles.shutterOuter, pressed && styles.shutterPressed]}>
                <View style={styles.shutterInner} />
              </Pressable>
              <Pressable accessibilityLabel="Demo-Mahlzeit verwenden" accessibilityRole="button" onPress={runDemo} style={styles.demoControl}>
                <Ionicons color={colors.white} name="play-outline" size={17} />
                <Text style={styles.demoControlText}>Demo</Text>
              </Pressable>
            </View>
          ) : mode === 'barcode' ? (
            <View style={styles.barcodeState}>
              <Ionicons color={colors.accent} name="barcode-outline" size={30} />
              <Text style={styles.barcodeText}>{barcodeBusy ? 'Produkt wird geöffnet …' : 'Scan startet automatisch'}</Text>
            </View>
          ) : (
            <Pressable accessibilityRole="button" onPress={() => setShowDescription(true)} style={styles.describeButton}>
              <Ionicons color={colors.text} name="create-outline" size={19} />
              <Text style={styles.describeButtonText}>Beschreibung öffnen</Text>
            </Pressable>
          )}
          <Text style={styles.privacy}>{mode === 'photo' ? 'Original nicht gespeichert · bei Netzfehler lokal vorgemerkt' : 'Nur bestätigte Nährwerte werden gespeichert'}</Text>
        </View>
      </SafeAreaView>

      <Modal animationType="fade" onRequestClose={() => { setShowDescription(false); setMode('photo'); }} transparent visible={showDescription}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalScrim}>
          <View accessibilityViewIsModal style={[styles.describeSheet, { paddingBottom: insets.bottom + 22 }]}>
            <Text accessibilityRole="header" style={styles.describeTitle}>Was hast du gegessen?</Text>
            <Text style={styles.describeText}>Lebensmittel und ungefähre Mengen helfen. Du kannst alles danach korrigieren.</Text>
            <TextInput
              accessibilityLabel="Mahlzeit beschreiben"
              autoFocus
              maxLength={500}
              multiline
              onChangeText={setDescription}
              placeholder="z. B. 2 Eier, zwei Scheiben Brot und eine halbe Avocado"
              placeholderTextColor={colors.muted}
              style={styles.describeInput}
              value={description}
            />
            <Pressable accessibilityRole="button" onPress={submitDescription} style={styles.describeSubmit}>
              <Text style={styles.describeSubmitText}>Analysieren</Text>
              <Ionicons color={colors.white} name="arrow-forward" size={18} />
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => { setShowDescription(false); setMode('photo'); }} style={styles.describeCancel}>
              <Text style={styles.describeCancelText}>Abbrechen</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function ModeButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.modeButton, active && styles.modeButtonActive]}>
      <Text style={[styles.modeText, active && styles.modeTextActive]}>{label.toUpperCase()}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.camera },
  fallback: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.cameraSoft, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 52 },
  fallbackOrb: { width: 112, height: 112, borderRadius: 56, backgroundColor: 'rgba(187,220,142,0.12)', borderWidth: 1, borderColor: 'rgba(187,220,142,0.32)', alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  fallbackTitle: { color: colors.white, fontSize: 21, fontWeight: '700', textAlign: 'center' },
  fallbackText: { color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 8 },
  permissionButton: { marginTop: 18, minHeight: 44, borderRadius: radii.pill, paddingHorizontal: 16, backgroundColor: colors.accent, flexDirection: 'row', alignItems: 'center', gap: 8 },
  permissionText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  permissionStatus: { color: 'rgba(255,255,255,0.58)', fontSize: 12, marginTop: 16 },
  scrimTop: { pointerEvents: 'none', position: 'absolute', left: 0, right: 0, top: 0, height: 160, backgroundColor: 'rgba(0,0,0,0.36)' },
  scrimBottom: { pointerEvents: 'none', position: 'absolute', left: 0, right: 0, bottom: 0, height: 250, backgroundColor: 'rgba(0,0,0,0.48)' },
  overlay: { flex: 1, justifyContent: 'space-between', pointerEvents: 'box-none' },
  topBar: { height: 66, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  circleButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(17,19,15,0.48)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  circlePlaceholder: { width: 42, height: 42 },
  titlePill: { height: 38, borderRadius: 19, backgroundColor: 'rgba(17,19,15,0.58)', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 7 },
  screenTitle: { color: colors.white, fontSize: 15, fontWeight: '700' },
  guideArea: { pointerEvents: 'none', flex: 1, marginHorizontal: 28, marginVertical: 42 },
  guideSpacer: { pointerEvents: 'none', flex: 1 },
  cornerTopLeft: { position: 'absolute', top: 0, left: 0, width: 50, height: 50, borderTopWidth: 2, borderLeftWidth: 2, borderColor: 'rgba(255,255,255,0.74)', borderTopLeftRadius: 18 },
  cornerTopRight: { position: 'absolute', top: 0, right: 0, width: 50, height: 50, borderTopWidth: 2, borderRightWidth: 2, borderColor: 'rgba(255,255,255,0.74)', borderTopRightRadius: 18 },
  cornerBottomLeft: { position: 'absolute', bottom: 0, left: 0, width: 50, height: 50, borderBottomWidth: 2, borderLeftWidth: 2, borderColor: 'rgba(255,255,255,0.74)', borderBottomLeftRadius: 18 },
  cornerBottomRight: { position: 'absolute', bottom: 0, right: 0, width: 50, height: 50, borderBottomWidth: 2, borderRightWidth: 2, borderColor: 'rgba(255,255,255,0.74)', borderBottomRightRadius: 18 },
  tipPill: { position: 'absolute', bottom: 18, alignSelf: 'center', height: 34, borderRadius: 17, backgroundColor: 'rgba(17,19,15,0.62)', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 7 },
  tipDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent },
  tipText: { color: colors.white, fontSize: 11, fontWeight: '600' },
  controls: { paddingHorizontal: 24, paddingBottom: 7, alignItems: 'center', gap: 16 },
  allowancePill: { height: 30, borderRadius: 15, backgroundColor: 'rgba(17,19,15,0.62)', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  allowanceText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  modeLabel: { flexDirection: 'row', borderRadius: radii.pill, backgroundColor: 'rgba(17,19,15,0.58)', padding: 3 },
  modeButton: { minHeight: 34, borderRadius: 17, paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center' },
  modeButtonActive: { backgroundColor: colors.accent },
  modeText: { color: 'rgba(255,255,255,0.62)', fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
  modeTextActive: { color: colors.text },
  shutterRow: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  shutterOuter: { width: 82, height: 82, borderRadius: 41, borderWidth: 3, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 66, height: 66, borderRadius: 33, backgroundColor: colors.accent },
  shutterPressed: { transform: [{ scale: 0.92 }] },
  smallPlaceholder: { width: 62, height: 46 },
  demoControl: { width: 62, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 3 },
  demoControlText: { color: colors.white, fontSize: 10, fontWeight: '700' },
  barcodeState: { minHeight: 82, alignItems: 'center', justifyContent: 'center', gap: 7 },
  barcodeText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  describeButton: { minHeight: 52, borderRadius: radii.pill, backgroundColor: colors.accent, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 8 },
  describeButtonText: { color: colors.text, fontSize: 13, fontWeight: '800' },
  privacy: { color: 'rgba(255,255,255,0.48)', fontSize: 10 },
  modalScrim: { flex: 1, backgroundColor: 'rgba(20,21,15,0.58)', justifyContent: 'flex-end' },
  describeSheet: { borderTopLeftRadius: radii.sheet, borderTopRightRadius: radii.sheet, backgroundColor: colors.surface, paddingHorizontal: 22, paddingTop: 22, gap: 13 },
  describeTitle: { color: colors.text, fontSize: 26, fontWeight: '700' },
  describeText: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  describeInput: { minHeight: 128, borderRadius: radii.input, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, color: colors.text, fontSize: 16, lineHeight: 23, padding: 14, textAlignVertical: 'top' },
  describeSubmit: { minHeight: 54, borderRadius: radii.button, backgroundColor: colors.text, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  describeSubmitText: { color: colors.white, fontSize: 15, fontWeight: '800' },
  describeCancel: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  describeCancelText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
});
