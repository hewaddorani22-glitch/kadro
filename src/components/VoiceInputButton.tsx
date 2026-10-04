import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Easing, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme, useThemedStyles } from '@/context/ThemeContext';
import type { ThemeColors } from '@/constants/theme';
import { useLanguage } from '@/i18n/LanguageProvider';
import { selectionHaptic } from '@/services/haptics';

type SpeechModule = typeof import('expo-speech-recognition');

/**
 * Speak the meal instead of typing it. Apple's speech recognition turns it
 * into text live (on device when available); nothing is recorded or stored.
 * Without the native module (web, old builds) the button is simply absent.
 */
export function VoiceInputButton({ value, onChange }: { value: string; onChange: (text: string) => void }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { language, t } = useLanguage();
  const [speech, setSpeech] = useState<SpeechModule | null>(null);
  const [listening, setListening] = useState(false);
  const prefix = useRef('');
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let active = true;
    import('expo-speech-recognition')
      .then(module => { if (active && module.isRecognitionAvailable()) setSpeech(module); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!speech) return;
    const subscriptions = [
      speech.addSpeechRecognitionListener('result', event => {
        const transcript = event.results[0]?.transcript ?? '';
        onChange(`${prefix.current}${transcript}`.slice(0, 500));
      }),
      speech.addSpeechRecognitionListener('end', () => setListening(false)),
      speech.addSpeechRecognitionListener('error', () => setListening(false)),
    ];
    return () => { subscriptions.forEach(subscription => subscription.remove()); speech.ExpoSpeechRecognitionModule.abort(); };
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
    if (listening) { speech.ExpoSpeechRecognitionModule.stop(); return; }
    const permission = await speech.ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t.scan.voiceDeniedTitle, t.scan.voiceDeniedBody, [
        { text: t.common.cancel, style: 'cancel' },
        { text: t.scan.voiceOpenSettings, onPress: () => { void Linking.openSettings(); } },
      ]);
      return;
    }
    prefix.current = value.trim() ? `${value.trim()} ` : '';
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
      <Text style={styles.hint}>{listening ? t.scan.voiceListening : t.scan.voiceHint}</Text>
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
