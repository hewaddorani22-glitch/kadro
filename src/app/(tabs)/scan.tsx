import Ionicons from '@expo/vector-icons/Ionicons';
import { BarcodeScanningResult, CameraView, useCameraPermissions } from 'expo-camera';
import { useFocusEffect, useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { FREE_SCAN_ALLOWANCE } from '@/constants/product';
import { PortionSheet } from '@/components/PortionSheet';
import { colors, radii } from '@/constants/theme';
import { useApp } from '@/context/AppContext';
import { FoodSearchResult, MealAnalysisError, searchFoods } from '@/services/mealAnalysis';
import { useSubscription } from '@/context/SubscriptionContext';
import { useLanguage } from '@/i18n/LanguageProvider';
import { primaryHaptic, successHaptic } from '@/services/haptics';
import { formatNumber } from '@/utils/format';

export default function ScanScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const { applySearchResult, freeScansLeft, hasEverLoggedScan, setCapturedPhoto, startBarcodeScan, startDemoScan, startDescriptionScan } = useApp();
  const { status: subscriptionStatus } = useSubscription();
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const { mode: requestedMode } = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<'photo' | 'description' | 'barcode' | 'search'>(
    requestedMode === 'description' ? 'description' : 'photo',
  );
  const [description, setDescription] = useState('');
  // Arriving with ?mode=description means the user just hit a barcode the
  // database does not know; the sheet should already be open for them.
  const [showDescription, setShowDescription] = useState(requestedMode === 'description');
  const [showSearch, setShowSearch] = useState(requestedMode === 'search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FoodSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [pendingFood, setPendingFood] = useState<FoodSearchResult | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [showBarcodeEntry, setShowBarcodeEntry] = useState(false);
  const [barcodeEntry, setBarcodeEntry] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestSearch = useRef('');
  const [barcodeBusy, setBarcodeBusy] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const insets = useSafeAreaInsets();
  const { locale, t } = useLanguage();
  // The sheets cover the whole screen, so a camera running behind one is a
  // preview nobody can see holding a device nobody else can use.
  const cameraActive = pathname.endsWith('/scan')
    && mode !== 'description'
    && mode !== 'search'
    && !showBarcodeEntry
    && permission?.granted === true;

  // Tabs stay mounted. Without a focus reset, returning from a previous text
  // search could leave the next Lunch/Dinner tap behind an invisible sheet and
  // make the camera look frozen.
  useFocusEffect(useCallback(() => {
    const nextMode = requestedMode === 'description'
      ? 'description'
      : requestedMode === 'search'
        ? 'search'
        : 'photo';
    setMode(nextMode);
    setShowDescription(nextMode === 'description');
    setShowSearch(nextMode === 'search');
    setShowBarcodeEntry(false);
    setTorchOn(false);
    setCapturing(false);
    setBarcodeBusy(false);
    return () => {
      setShowDescription(false);
      setShowSearch(false);
      setShowBarcodeEntry(false);
      setTorchOn(false);
    };
  }, [requestedMode]));

  /**
   * onCameraReady fires once per mounted camera. Resetting the flag whenever
   * `mode` changed cleared it on a FOTO → BARCODE → FOTO switch, which does
   * not remount anything, so the callback never came back and the shutter
   * answered "camera not ready" until the tab was left and re-entered. Only a
   * teardown may clear it.
   */
  useEffect(() => {
    if (!cameraActive) setCameraReady(false);
  }, [cameraActive]);

  // A barcode already handed off must not re-fire, but a new mode or a fresh
  // camera starts a new chance to scan one.
  useEffect(() => {
    setBarcodeBusy(false);
  }, [cameraActive, mode]);

  const requestCameraAccess = async () => {
    if (permission && !permission.canAskAgain) {
      Alert.alert(
        t.scan.permissionTitle,
        t.scan.permissionBody,
        [
          { text: t.common.cancel, style: 'cancel' },
          { text: t.scan.openSettings, onPress: () => void Linking.openSettings() },
        ],
      );
      return;
    }

    const nextPermission = await requestPermission();
    if (!nextPermission.granted) {
      Alert.alert(
        t.scan.permissionMissingTitle,
        nextPermission.canAskAgain ? t.scan.permissionAsk : t.scan.permissionDenied,
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
    void primaryHaptic();

    try {
      if (!permission?.granted || !cameraRef.current) {
        Alert.alert(t.scan.notReadyTitle, t.scan.notReadyBody);
        return;
      }
      // Deliberately not gated on `cameraReady`. Some devices never send
      // onCameraReady, and refusing on a flag that may never arrive turns the
      // shutter into a dead button; asking the camera and handling the failure
      // costs one retry at worst.
      const result = await cameraRef.current.takePictureAsync({ quality: 0.9 });
      if (!result?.uri) throw new Error('missing camera uri');
      setCapturedPhoto(result.uri);
      router.push('/analyzing');
    } catch {
      Alert.alert(t.scan.captureFailedTitle, t.scan.captureFailedBody);
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

  const chooseMode = (nextMode: 'photo' | 'description' | 'barcode' | 'search') => {
    setMode(nextMode);
    if (nextMode !== 'barcode') setTorchOn(false);
    if (nextMode === 'description') setShowDescription(true);
    if (nextMode === 'search') setShowSearch(true);
  };

  /**
   * Search does not reach the model, so it costs neither a free meal nor any
   * credit: that is the whole reason it exists next to the camera.
   *
   * Debounced, and every response is checked against the request that is still
   * current: typing "rice" fired four searches, and a slow first one could
   * land after a later, better one and overwrite it.
   */
  const runSearch = (value: string) => {
    setSearchQuery(value);
    const term = value.trim();
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (term.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    setSearchError(null);
    searchTimer.current = setTimeout(() => {
      const request = term;
      latestSearch.current = request;
      void searchFoods(request)
        .then((results) => {
          if (latestSearch.current !== request) return;
          setSearchResults(results);
          setSearching(false);
        })
        .catch((error: unknown) => {
          if (latestSearch.current !== request) return;
          setSearchResults([]);
          // Swallowing this showed "nothing found" for a network failure and
          // for a withdrawn consent alike, which tells the user the food does
          // not exist when the truth is that we never asked.
          setSearchError(error instanceof MealAnalysisError ? error.message : t.errors.gatewayProviderError);
          setSearching(false);
        });
    }, 350);
  };

  /**
   * Picking a food no longer logs it: it opens the amount sheet. Deciding
   * "how much" before knowing "of what" was the wrong order, and grams was
   * the only unit on offer.
   */
  const addSearchResult = (result: FoodSearchResult) => {
    setPendingFood(result);
  };

  const confirmPortion = (grams: number) => {
    if (!pendingFood) return;
    applySearchResult(pendingFood, grams);
    setPendingFood(null);
    setShowSearch(false);
    setMode('photo');
    router.push('/confirm');
  };

  const submitDescription = () => {
    const value = description.trim();
    if (value.length < 3) {
      Alert.alert(t.scan.describeShortTitle, t.scan.describeShortBody);
      return;
    }
    if (!hasScanAccess()) return;
    setShowDescription(false);
    startDescriptionScan(value);
    router.push('/analyzing');
  };

  const openBarcode = (data: string) => {
    if (barcodeBusy || !/^\d{7,14}$/.test(data)) return;
    setBarcodeBusy(true);
    void successHaptic();
    startBarcodeScan(data);
    router.push('/analyzing');
  };

  const handleBarcode = ({ data }: BarcodeScanningResult) => openBarcode(data);

  const submitBarcodeEntry = () => {
    const normalized = barcodeEntry.replace(/\D/g, '');
    if (!/^\d{8,14}$/.test(normalized)) {
      Alert.alert(t.scan.barcodeManualInvalidTitle, t.scan.barcodeManualInvalidBody);
      return;
    }
    setShowBarcodeEntry(false);
    openBarcode(normalized);
  };

  return (
    <View style={styles.container}>
      {cameraActive ? (
        <>
          <CameraView
            active={Platform.OS === 'ios' ? cameraActive : undefined}
            autofocus="on"
            barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'itf14', 'code128'] }}
            enableTorch={mode === 'barcode' && torchOn}
            facing="back"
            onCameraReady={() => setCameraReady(true)}
            onBarcodeScanned={mode === 'barcode' ? handleBarcode : undefined}
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            zoom={mode === 'barcode' ? 0.08 : 0}
          />
          {/* A black rectangle reads as a broken camera; say it is starting. */}
          {cameraReady ? null : (
            <View pointerEvents="none" style={styles.cameraStarting}>
              <ActivityIndicator color={colors.white} />
              <Text style={styles.cameraStartingText}>{t.scan.cameraStarting}</Text>
            </View>
          )}
        </>
      ) : (
        <View style={styles.fallback}>
          <View style={styles.fallbackOrb}>
            <Ionicons color={colors.accent} name="restaurant" size={58} />
          </View>
          <Text style={styles.fallbackTitle}>
            {mode === 'description'
              ? t.scan.fallbackDescribeTitle
              : mode === 'barcode'
                ? t.scan.fallbackBarcodeTitle
                : t.scan.fallbackPhotoTitle}
          </Text>
          <Text style={styles.fallbackText}>
            {mode === 'description'
              ? t.scan.fallbackDescribeText
              : mode === 'barcode'
                ? t.scan.fallbackBarcodeText
                : t.scan.fallbackPhotoText}
          </Text>
          {mode !== 'description' && !permission ? <Text style={styles.permissionStatus}>{t.scan.permissionChecking}</Text> : null}
          {mode !== 'description' && permission && !permission.granted ? (
            <Pressable accessibilityRole="button" onPress={() => void requestCameraAccess()} style={styles.permissionButton}>
              <Ionicons color={colors.text} name="camera-outline" size={18} />
              <Text style={styles.permissionText}>{permission.canAskAgain ? t.scan.allowCamera : t.scan.openSettings}</Text>
            </Pressable>
          ) : null}
        </View>
      )}

      <View style={styles.scrimTop} />
      <View style={styles.scrimBottom} />

      <SafeAreaView edges={['top', 'bottom']} style={styles.overlay}>
        <View style={styles.topBar}>
          <Pressable accessibilityLabel={t.scan.close} accessibilityRole="button" onPress={close} style={styles.circleButton}>
            <Ionicons color={colors.white} name="close" size={24} />
          </Pressable>
          <View style={styles.titlePill}>
            <Ionicons color={colors.accent} name="sparkles" size={15} />
            <Text style={styles.screenTitle}>{t.scan.title}</Text>
          </View>
          {mode === 'barcode' && cameraActive ? (
            <Pressable
              accessibilityLabel={torchOn ? t.scan.torchOff : t.scan.torchOn}
              accessibilityRole="switch"
              accessibilityState={{ checked: torchOn }}
              onPress={() => setTorchOn((value) => !value)}
              style={[styles.circleButton, torchOn && styles.circleButtonActive]}
            >
              <Ionicons color={torchOn ? colors.text : colors.white} name={torchOn ? 'flash' : 'flash-outline'} size={21} />
            </Pressable>
          ) : <View style={styles.circlePlaceholder} />}
        </View>

        {cameraActive ? (
          <View style={styles.guideArea}>
            <View style={styles.cornerTopLeft} />
            <View style={styles.cornerTopRight} />
            <View style={styles.cornerBottomLeft} />
            <View style={styles.cornerBottomRight} />
            <View style={styles.tipPill}>
              <View style={styles.tipDot} />
              <Text style={styles.tipText}>{mode === 'barcode' ? t.scan.framingBarcode : t.scan.framingPhoto}</Text>
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
                {t.scan.allowanceLeft(freeScansLeft, FREE_SCAN_ALLOWANCE)}
              </Text>
            </View>
          ) : null}
          <View accessibilityRole="radiogroup" style={styles.modeLabel}>
            <ModeButton active={mode === 'photo'} label={t.scan.modePhoto} onPress={() => chooseMode('photo')} />
            <ModeButton active={mode === 'description'} label={t.scan.modeDescribe} onPress={() => chooseMode('description')} />
            <ModeButton active={mode === 'barcode'} label={t.scan.modeBarcode} onPress={() => chooseMode('barcode')} />
            <ModeButton active={mode === 'search'} label={t.scan.modeSearch} onPress={() => chooseMode('search')} />
          </View>
          {mode === 'photo' ? (
            <View style={styles.shutterRow}>
              <View style={styles.smallPlaceholder} />
              <Pressable accessibilityLabel={t.scan.shutter} accessibilityRole="button" accessibilityState={{ disabled: capturing }} disabled={capturing} onPress={capture} style={({ pressed }) => [styles.shutterOuter, pressed && styles.shutterPressed]}>
                <View style={styles.shutterInner} />
              </Pressable>
              <Pressable accessibilityLabel={t.scan.demoLabel} accessibilityRole="button" onPress={runDemo} style={styles.demoControl}>
                <Ionicons color={colors.white} name="play-outline" size={17} />
                <Text style={styles.demoControlText}>{t.scan.demo}</Text>
              </Pressable>
            </View>
          ) : mode === 'barcode' ? (
            <View style={styles.barcodeState}>
              <Ionicons color={colors.accent} name="barcode-outline" size={30} />
              <Text style={styles.barcodeText}>{barcodeBusy ? t.scan.barcodeOpening : t.scan.barcodeWaiting}</Text>
              <Pressable accessibilityRole="button" onPress={() => setShowBarcodeEntry(true)} style={styles.barcodeManualButton}>
                <Ionicons color={colors.white} name="keypad-outline" size={16} />
                <Text style={styles.barcodeManualText}>{t.scan.barcodeManual}</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable accessibilityRole="button" onPress={() => setShowDescription(true)} style={styles.describeButton}>
              <Ionicons color={colors.text} name="create-outline" size={19} />
              <Text style={styles.describeButtonText}>{t.scan.openDescription}</Text>
            </Pressable>
          )}
          <Text style={styles.privacy}>{mode === 'photo' ? t.scan.privacyPhoto : t.scan.privacyOther}</Text>
        </View>
      </SafeAreaView>

      <Modal animationType="fade" onRequestClose={() => setShowBarcodeEntry(false)} transparent visible={showBarcodeEntry}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalScrim}>
          <View accessibilityViewIsModal style={[styles.barcodeSheet, { paddingBottom: insets.bottom + 20 }]}>
            <Text accessibilityRole="header" style={styles.describeTitle}>{t.scan.barcodeManualTitle}</Text>
            <Text style={styles.describeText}>{t.scan.barcodeManualHint}</Text>
            <TextInput
              accessibilityLabel={t.scan.barcodeManualTitle}
              autoFocus
              keyboardType="number-pad"
              maxLength={18}
              onChangeText={setBarcodeEntry}
              onSubmitEditing={submitBarcodeEntry}
              placeholder={t.scan.barcodeManualPlaceholder}
              placeholderTextColor={colors.muted}
              returnKeyType="done"
              style={styles.barcodeInput}
              value={barcodeEntry}
            />
            <Pressable accessibilityRole="button" onPress={submitBarcodeEntry} style={styles.describeSubmit}>
              <Text style={styles.describeSubmitText}>{t.scan.barcodeManualSubmit}</Text>
              <Ionicons color={colors.white} name="search" size={18} />
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setShowBarcodeEntry(false)} style={styles.describeCancel}>
              <Text style={styles.describeCancelText}>{t.common.cancel}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal animationType="slide" onRequestClose={() => { setShowSearch(false); setMode('photo'); }} transparent visible={showSearch}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalScrim}>
          <View accessibilityViewIsModal style={[styles.searchSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.searchHead}>
              <Text accessibilityRole="header" style={styles.describeTitle}>{t.scan.searchTitle}</Text>
              <View style={styles.freePill}><Text style={styles.freePillText}>{t.scan.searchFree}</Text></View>
            </View>
            <Text style={styles.describeText}>{t.scan.searchHint}</Text>
            <TextInput
              accessibilityLabel={t.scan.searchTitle}
              autoCorrect={false}
              autoFocus
              maxLength={60}
              onChangeText={runSearch}
              placeholder={t.scan.searchPlaceholder}
              placeholderTextColor={colors.muted}
              returnKeyType="search"
              style={styles.searchInput}
              value={searchQuery}
            />
            <ScrollView keyboardShouldPersistTaps="handled" style={styles.searchResults}>
              {searching ? <Text style={styles.searchStatus}>{t.scan.searchSearching}</Text> : null}
              {!searching && searchError ? (
                <Text accessibilityLiveRegion="polite" style={styles.searchError}>{searchError}</Text>
              ) : null}
              {!searching && !searchError && searchQuery.trim().length >= 2 && !searchResults.length ? (
                <Text style={styles.searchStatus}>{t.scan.searchEmpty}</Text>
              ) : null}
              {!searching && !searchError && t.scan.searchHintEnglish && searchQuery.trim().length >= 2 && !searchResults.length ? (
                <Text style={styles.searchStatus}>{t.scan.searchHintEnglish}</Text>
              ) : null}
              {searchResults.map((result) => (
                <Pressable accessibilityRole="button" key={result.id} onPress={() => addSearchResult(result)} style={styles.searchRow}>
                  <View style={styles.searchRowCopy}>
                    <Text numberOfLines={2} style={styles.searchRowName}>{result.name}</Text>
                    <Text style={styles.searchRowMeta}>
                      {formatNumber(Math.round(result.per100g.calories), locale)} kcal {t.scan.searchPer100} · {formatNumber(Number(result.per100g.protein.toFixed(1)), locale)} g {t.common.protein}
                    </Text>
                  </View>
                  <Ionicons color={colors.accentText} name="add-circle" size={26} />
                </Pressable>
              ))}
            </ScrollView>
            <Pressable accessibilityRole="button" onPress={() => { setShowSearch(false); setMode('photo'); }} style={styles.describeCancel}>
              <Text style={styles.describeCancelText}>{t.common.cancel}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <PortionSheet
        onCancel={() => setPendingFood(null)}
        onConfirm={confirmPortion}
        target={pendingFood ? {
          name: pendingFood.name,
          per100g: pendingFood.per100g,
          defaultGrams: pendingFood.defaultGrams,
          portions: pendingFood.portions,
          sourceLabel: pendingFood.source.label,
        } : null}
        visible={!!pendingFood}
      />

      <Modal animationType="fade" onRequestClose={() => { setShowDescription(false); setMode('photo'); }} transparent visible={showDescription}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalScrim}>
          <View accessibilityViewIsModal style={[styles.describeSheet, { paddingBottom: insets.bottom + 22 }]}>
            <Text accessibilityRole="header" style={styles.describeTitle}>{t.scan.describeTitle}</Text>
            <Text style={styles.describeText}>{t.scan.describeText}</Text>
            <TextInput
              accessibilityLabel={t.scan.describeTitle}
              autoFocus
              maxLength={500}
              multiline
              onChangeText={setDescription}
              placeholder={t.scan.describePlaceholder}
              placeholderTextColor={colors.muted}
              style={styles.describeInput}
              value={description}
            />
            <Pressable accessibilityRole="button" onPress={submitDescription} style={styles.describeSubmit}>
              <Text style={styles.describeSubmitText}>{t.scan.describeSubmit}</Text>
              <Ionicons color={colors.white} name="arrow-forward" size={18} />
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => { setShowDescription(false); setMode('photo'); }} style={styles.describeCancel}>
              <Text style={styles.describeCancelText}>{t.common.cancel}</Text>
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
  cameraStarting: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 12 },
  cameraStartingText: { color: 'rgba(255,255,255,0.72)', fontSize: 13, fontWeight: '600' },
  permissionStatus: { color: 'rgba(255,255,255,0.58)', fontSize: 12, marginTop: 16 },
  scrimTop: { pointerEvents: 'none', position: 'absolute', left: 0, right: 0, top: 0, height: 160, backgroundColor: 'rgba(0,0,0,0.36)' },
  scrimBottom: { pointerEvents: 'none', position: 'absolute', left: 0, right: 0, bottom: 0, height: 250, backgroundColor: 'rgba(0,0,0,0.48)' },
  overlay: { flex: 1, justifyContent: 'space-between', pointerEvents: 'box-none' },
  topBar: { height: 66, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  circleButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(17,19,15,0.48)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  circleButtonActive: { backgroundColor: colors.accent, borderColor: colors.accent },
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
  barcodeState: { minHeight: 92, alignItems: 'center', justifyContent: 'center', gap: 7 },
  barcodeText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  barcodeManualButton: { minHeight: 34, borderRadius: radii.pill, borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)', backgroundColor: 'rgba(255,255,255,0.10)', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 6 },
  barcodeManualText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  describeButton: { minHeight: 52, borderRadius: radii.pill, backgroundColor: colors.accent, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 8 },
  describeButtonText: { color: colors.text, fontSize: 13, fontWeight: '800' },
  privacy: { color: 'rgba(255,255,255,0.48)', fontSize: 10 },
  modalScrim: { flex: 1, backgroundColor: 'rgba(20,21,15,0.58)', justifyContent: 'flex-end' },
  barcodeSheet: { borderTopLeftRadius: radii.sheet, borderTopRightRadius: radii.sheet, backgroundColor: colors.surface, paddingHorizontal: 22, paddingTop: 22, gap: 13 },
  barcodeInput: { minHeight: 56, borderRadius: radii.input, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, color: colors.text, fontSize: 20, fontWeight: '700', letterSpacing: 1, paddingHorizontal: 15 },
  searchSheet: { maxHeight: '86%', borderTopLeftRadius: radii.card, borderTopRightRadius: radii.card, backgroundColor: colors.background, paddingHorizontal: 20, paddingTop: 20, gap: 12 },
  searchHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  freePill: { borderRadius: radii.pill, backgroundColor: colors.accentSoft, paddingHorizontal: 10, paddingVertical: 4 },
  freePillText: { color: colors.accentText, fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  searchInput: { minHeight: 52, borderRadius: radii.input, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, color: colors.text, fontSize: 17, paddingHorizontal: 16 },
  searchResults: { flexGrow: 0 },
  searchError: { color: colors.attention, fontSize: 14, lineHeight: 21, paddingVertical: 12 },
  searchStatus: { color: colors.muted, fontSize: 14, lineHeight: 21, paddingVertical: 12 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.border },
  searchRowCopy: { flex: 1, gap: 3 },
  searchRowName: { color: colors.text, fontSize: 16, fontWeight: '600', lineHeight: 21 },
  searchRowMeta: { color: colors.muted, fontSize: 13 },
  describeSheet: { borderTopLeftRadius: radii.sheet, borderTopRightRadius: radii.sheet, backgroundColor: colors.surface, paddingHorizontal: 22, paddingTop: 22, gap: 13 },
  describeTitle: { color: colors.text, fontSize: 26, fontWeight: '700' },
  describeText: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  describeInput: { minHeight: 128, borderRadius: radii.input, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, color: colors.text, fontSize: 16, lineHeight: 23, padding: 14, textAlignVertical: 'top' },
  describeSubmit: { minHeight: 54, borderRadius: radii.button, backgroundColor: colors.text, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  describeSubmitText: { color: colors.white, fontSize: 15, fontWeight: '800' },
  describeCancel: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  describeCancelText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
});
