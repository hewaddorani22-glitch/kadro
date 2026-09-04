import * as Haptics from 'expo-haptics';
import { Platform, Vibration } from 'react-native';

/**
 * One tactile vocabulary for the whole app. Android gets a short native
 * fallback only when Expo's haptic API fails; playing both at once feels
 * buzzy instead of precise.
 */
async function perform(action: () => Promise<void>, fallbackMs = 8) {
  try {
    await action();
  } catch {
    if (Platform.OS === 'android') Vibration.vibrate(fallbackMs);
  }
}

export function selectionHaptic() {
  return perform(() => Haptics.selectionAsync());
}

export function stepHaptic(repeating = false) {
  return perform(() => Haptics.impactAsync(
    repeating ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium,
  ));
}

export function primaryHaptic() {
  return perform(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 12);
}

export function successHaptic() {
  return perform(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), 18);
}

export function warningHaptic() {
  return perform(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning), 18);
}

export function errorHaptic() {
  return perform(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error), 24);
}
