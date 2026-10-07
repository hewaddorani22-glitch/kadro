import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Easing, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme, useThemedStyles } from '@/context/ThemeContext';
import type { ThemeColors } from '@/constants/theme';
import { useLanguage } from '@/i18n/LanguageProvider';
import { selectionHaptic } from '@/services/haptics';

type SpeechModule = typeof import('expo-speech-recognition');

// Loaded once. Builds without the native module (web, older binaries)
// simply show no microphone instead of failing.
let speechModule: SpeechModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  speechModule = require('expo-speech-recognition') as SpeechModule;
} catch { speechModule = null; }

// Availability is asked when the sheet opens, not at app start: right after
// install iOS can report "unavailable" for a moment, which used to hide the
// microphone until the next launch.
function recognitionAvailable() {
  try { return speechModule?.isRecognitionAvailable() === true; } catch { return false; }
}

/**
 * Speak the meal instead of typing it. Apple's speech recognition turns it
 * into text live (on device when available); nothing is recorded or stored.
 * Without the native module (web, old builds) the button is simply absent.
 */
export function VoiceInputButton({ value, onChange }: { value: string; onChange: (text: string) => void }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { language, t } = useLanguage();
  const [available, setAvailable] = useState(recognitionAvailable);
  useEffect(() => {
    if (available) return;
    // A late "ready" from iOS still brings the microphone in.
    const timer = setTimeout(() => setAvailable(recognitionAvailable()), 600);
    return () => clearTimeout(timer);
  }, [available]);
  const speech = available ? speechModule : null;
  const [listening, setListening] = useState(false);
  const [failed, setFailed] = useState(false);
  // Text that is already settled: what was typed before, plus every finished
  // speech segment. iOS 18+ starts a fresh transcript after each pause in
  // continuous mode, so only the running segment may be replaced.
  const committed = useRef('');
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulse = useRef(new Animated.Value(0)).current;
  const clearStopTimer = () => { if (stopTimer.current) { clearTimeout(stopTimer.current); stopTimer.current = null; } };

  useEffect(() => {
    if (!speech) return;
    const subscriptions = [
      speech.addSpeechRecognitionListener('result', event => {
        const transcript = (event.results[0]?.transcript ?? '').trim();
        const text = `${committed.current}${transcript}`.slice(0, 500);
        onChange(text);
        if (event.isFinal && transcript) committed.current = `${text} `;
      }),
      speech.addSpeechRecognitionListener('end', () => { setListening(false); clearStopTimer(); }),
      speech.addSpeechRecognitionListener('error', event => {
        setListening(false);
        clearStopTimer();
        // Stopping, or silence, is not a failure worth a message.
        if (event.error !== 'aborted' && event.error !== 'no-speech') setFailed(true);
      }),
    ];
    return () => { subscriptions.forEach(subscription => subscription.remove()); clearStopTimer(); speech.ExpoSpeechRecognitionModule.abort(); };
  }, [speech, onChange]);

  useEffect(() => {
    if (!listening) { pulse.stopAnimation(); pulse.setValue(0); return; }
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [listening, pulse]);

  if (!speech) return null;

  const toggle = async () => {
    void selectionHaptic();
    if (listening) {
      // Stop must feel instant. iOS can take seconds to report "end" for
      // continuous on-device recognition (or never), which used to leave the
      // button pulsing as if it could not be stopped. The last words still
      // arrive as a final result; if iOS does not finish, abort.
      setListening(false);
      speech.ExpoSpeechRecognitionModule.stop();
      clearStopTimer();
      stopTimer.current = setTimeout(() => { stopTimer.current = null; speech.ExpoSpeechRecognitionModule.abort(); }, 1500);
      return;
    }
    const permission = await speech.ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t.scan.voiceDeniedTitle, t.scan.voiceDeniedBody, [
        { text: t.common.cancel, style: 'cancel' },
        { text: t.scan.voiceOpenSettings, onPress: () => { void Linking.openSettings(); } },
      ]);
      return;
    }
    // A pending abort from the previous stop must not cut off this new session.
    clearStopTimer();
    setFailed(false);
    committed.current = value.trim() ? `${value.trim()} ` : '';
    speech.ExpoSpeechRecognitionModule.start({
      lang: language === 'de' ? 'de-DE' : 'en-US',
      interimResults: true,
      continuous: true,
      addsPunctuation: true,
      requiresOnDeviceRecognition: speech.supportsOnDeviceRecognition(),
      contextualStrings: t.scan.voiceVocabulary,
    });
    setListening(true);
  };

  const ring = { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] }) }] };
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityLabel={listening ? t.scan.voiceStop : t.scan.voiceStart}
        accessibilityRole="button"
        accessibilityState={{ selected: listening }}
        onPress={() => void toggle()}
        style={({ pressed }) => [styles.button, listening && styles.buttonActive, pressed && { transform: [{ scale: 0.96 }] }]}
      >
        {listening ? <Animated.View pointerEvents="none" style={[styles.ring, ring]} /> : null}
        <Ionicons color={listening ? colors.onAccent : colors.text} name={listening ? 'stop' : 'mic'} size={22} />
      </Pressable>
      <Text style={styles.hint}>{listening ? t.scan.voiceListening : failed ? t.scan.voiceFailed : t.scan.voiceHint}</Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  button: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.neutralSoft, alignItems: 'center', justifyContent: 'center' },
  buttonActive: { backgroundColor: colors.accent },
  ring: { ...StyleSheet.absoluteFillObject, borderRadius: 26, backgroundColor: colors.accent },
  hint: { flex: 1, color: colors.muted, fontSize: 14, lineHeight: 19 },
});
