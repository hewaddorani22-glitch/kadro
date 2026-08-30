import Ionicons from '@expo/vector-icons/Ionicons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { usePathname, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radii } from '@/constants/theme';
import { useApp } from '@/context/AppContext';

type CaptureMode = 'Photo' | 'Describe' | 'Barcode';

export default function ScanScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const { setPhotoUri } = useApp();
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<CaptureMode>('Photo');
  const [cameraReady, setCameraReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const cameraActive = pathname === '/scan' && permission?.granted;

  const close = () => router.replace('/(tabs)/today');

  const capture = async () => {
    if (capturing) return;
    if (mode !== 'Photo') {
      Alert.alert(`${mode} mode`, 'This Day 1 prototype keeps these as visible fallbacks. Photo is the active MVP path.');
      return;
    }

    setCapturing(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      if (permission?.granted && cameraReady && cameraRef.current) {
        const result = await cameraRef.current.takePictureAsync({ quality: 0.72 });
        setPhotoUri(result?.uri ?? null);
      } else {
        setPhotoUri(null);
      }
      router.push('/analyzing');
    } catch {
      setPhotoUri(null);
      router.push('/analyzing');
    } finally {
      setCapturing(false);
    }
  };

  return (
    <View style={styles.container}>
      {cameraActive ? (
        <CameraView
          active={Platform.OS === 'ios' ? cameraActive : undefined}
          facing="back"
          onCameraReady={() => setCameraReady(true)}
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <View style={styles.fallback}>
          <View style={styles.fallbackOrb}>
            <Ionicons color={colors.accent} name="restaurant" size={58} />
          </View>
          <Text style={styles.fallbackTitle}>Frame your whole meal</Text>
          <Text style={styles.fallbackText}>Natural light and a clear view help with portions.</Text>
          {permission && !permission.granted ? (
            <Pressable onPress={requestPermission} style={styles.permissionButton}>
              <Ionicons color={colors.text} name="camera-outline" size={18} />
              <Text style={styles.permissionText}>Enable camera</Text>
            </Pressable>
          ) : null}
        </View>
      )}

      <View style={styles.scrimTop} />
      <View style={styles.scrimBottom} />

      <SafeAreaView edges={['top', 'bottom']} style={styles.overlay}>
        <View style={styles.topBar}>
          <Pressable accessibilityLabel="Close scanner" onPress={close} style={styles.circleButton}>
            <Ionicons color={colors.white} name="close" size={24} />
          </Pressable>
          <View style={styles.titlePill}>
            <Ionicons color={colors.accent} name="sparkles" size={15} />
            <Text style={styles.screenTitle}>Scan meal</Text>
          </View>
          <Pressable accessibilityLabel="Toggle flash" style={styles.circleButton}>
            <Ionicons color={colors.white} name="flash-outline" size={22} />
          </Pressable>
        </View>

        <View style={styles.guideArea}>
          <View style={styles.cornerTopLeft} />
          <View style={styles.cornerTopRight} />
          <View style={styles.cornerBottomLeft} />
          <View style={styles.cornerBottomRight} />
          <View style={styles.tipPill}>
            <View style={styles.tipDot} />
            <Text style={styles.tipText}>Keep the full plate visible</Text>
          </View>
        </View>

        <View style={styles.controls}>
          <View style={styles.modeRow}>
            {(['Photo', 'Describe', 'Barcode'] as CaptureMode[]).map((item) => (
              <Pressable key={item} onPress={() => setMode(item)} style={styles.modeButton}>
                <Text style={[styles.modeText, mode === item && styles.modeTextActive]}>{item}</Text>
                {mode === item ? <View style={styles.modeDot} /> : null}
              </Pressable>
            ))}
          </View>
          <View style={styles.shutterRow}>
            <Pressable accessibilityLabel="Choose a recent photo" style={styles.smallControl}>
              <Ionicons color={colors.white} name="images-outline" size={23} />
            </Pressable>
            <Pressable accessibilityLabel="Take meal photo" onPress={capture} style={({ pressed }) => [styles.shutterOuter, pressed && styles.shutterPressed]}>
              <View style={styles.shutterInner} />
            </Pressable>
            <Pressable accessibilityLabel="Use demo meal" onPress={capture} style={styles.smallControl}>
              <Ionicons color={colors.white} name="play-outline" size={24} />
            </Pressable>
          </View>
          <Text style={styles.privacy}>Photo analyzed temporarily · not saved by default</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.camera },
  fallback: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.cameraSoft, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 52 },
  fallbackOrb: { width: 112, height: 112, borderRadius: 56, backgroundColor: 'rgba(183,213,138,0.12)', borderWidth: 1, borderColor: 'rgba(183,213,138,0.32)', alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  fallbackTitle: { color: colors.white, fontSize: 21, fontWeight: '700', textAlign: 'center' },
  fallbackText: { color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 8 },
  permissionButton: { marginTop: 18, minHeight: 44, borderRadius: radii.pill, paddingHorizontal: 16, backgroundColor: colors.accent, flexDirection: 'row', alignItems: 'center', gap: 8 },
  permissionText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  scrimTop: { pointerEvents: 'none', position: 'absolute', left: 0, right: 0, top: 0, height: 160, backgroundColor: 'rgba(0,0,0,0.36)' },
  scrimBottom: { pointerEvents: 'none', position: 'absolute', left: 0, right: 0, bottom: 0, height: 250, backgroundColor: 'rgba(0,0,0,0.48)' },
  overlay: { flex: 1, justifyContent: 'space-between' },
  topBar: { height: 66, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  circleButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(17,19,15,0.48)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  titlePill: { height: 38, borderRadius: 19, backgroundColor: 'rgba(17,19,15,0.58)', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 7 },
  screenTitle: { color: colors.white, fontSize: 15, fontWeight: '700' },
  guideArea: { pointerEvents: 'none', flex: 1, marginHorizontal: 28, marginVertical: 42 },
  cornerTopLeft: { position: 'absolute', top: 0, left: 0, width: 50, height: 50, borderTopWidth: 2, borderLeftWidth: 2, borderColor: 'rgba(255,255,255,0.74)', borderTopLeftRadius: 18 },
  cornerTopRight: { position: 'absolute', top: 0, right: 0, width: 50, height: 50, borderTopWidth: 2, borderRightWidth: 2, borderColor: 'rgba(255,255,255,0.74)', borderTopRightRadius: 18 },
  cornerBottomLeft: { position: 'absolute', bottom: 0, left: 0, width: 50, height: 50, borderBottomWidth: 2, borderLeftWidth: 2, borderColor: 'rgba(255,255,255,0.74)', borderBottomLeftRadius: 18 },
  cornerBottomRight: { position: 'absolute', bottom: 0, right: 0, width: 50, height: 50, borderBottomWidth: 2, borderRightWidth: 2, borderColor: 'rgba(255,255,255,0.74)', borderBottomRightRadius: 18 },
  tipPill: { position: 'absolute', bottom: 18, alignSelf: 'center', height: 34, borderRadius: 17, backgroundColor: 'rgba(17,19,15,0.62)', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 7 },
  tipDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent },
  tipText: { color: colors.white, fontSize: 11, fontWeight: '600' },
  controls: { paddingHorizontal: 24, paddingBottom: 7, alignItems: 'center', gap: 16 },
  modeRow: { flexDirection: 'row', gap: 25 },
  modeButton: { minWidth: 58, alignItems: 'center', gap: 5 },
  modeText: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '600' },
  modeTextActive: { color: colors.white },
  modeDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.accent },
  shutterRow: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  shutterOuter: { width: 82, height: 82, borderRadius: 41, borderWidth: 3, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 66, height: 66, borderRadius: 33, backgroundColor: colors.accent },
  shutterPressed: { transform: [{ scale: 0.92 }] },
  smallControl: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  privacy: { color: 'rgba(255,255,255,0.48)', fontSize: 10 },
});
