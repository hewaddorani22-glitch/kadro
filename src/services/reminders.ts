import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const REMINDER_KEY = '@kandro/evening-reminder:v1';
const IDENTIFIER = 'kandro-evening-summary';

export const REMINDER_HOUR = 20;
export const REMINDER_MINUTE = 30;

/** Local notifications only. Kandro never registers for remote push. */
export const remindersSupported = Platform.OS !== 'web';

let handlerConfigured = false;

export function configureNotifications() {
  if (!remindersSupported || handlerConfigured) return;
  handlerConfigured = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === 'android') {
    void Notifications.setNotificationChannelAsync('evening-summary', {
      name: 'Tagesabschluss',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: null,
      vibrationPattern: [0, 180],
      enableVibrate: true,
    }).catch(() => undefined);
  }
}

export async function isEveningReminderEnabled() {
  if (!remindersSupported) return false;
  return (await AsyncStorage.getItem(REMINDER_KEY)) === 'true';
}

async function scheduleEveningReminder() {
  await Notifications.cancelScheduledNotificationAsync(IDENTIFIER).catch(() => undefined);
  await Notifications.scheduleNotificationAsync({
    identifier: IDENTIFIER,
    content: {
      title: 'Dein Tag ist zusammengefasst',
      // No streaks, no guilt, no numbers the user has not seen yet.
      body: 'Ein Blick, und du weißt, wie der Tag gelaufen ist.',
      data: { route: '/evening' },
      ...(Platform.OS === 'android' ? { channelId: 'evening-summary' } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: REMINDER_HOUR,
      minute: REMINDER_MINUTE,
    },
  });
}

/**
 * Turns the daily summary reminder on or off and returns the state that
 * actually applies. Asking for it without permission returns false rather than
 * pretending it worked.
 */
export async function setEveningReminderEnabled(enabled: boolean): Promise<boolean> {
  if (!remindersSupported) return false;
  configureNotifications();

  if (!enabled) {
    await Notifications.cancelScheduledNotificationAsync(IDENTIFIER).catch(() => undefined);
    await AsyncStorage.setItem(REMINDER_KEY, 'false');
    return false;
  }

  const current = await Notifications.getPermissionsAsync();
  const granted = current.granted
    ? true
    : (await Notifications.requestPermissionsAsync()).granted;

  if (!granted) {
    await AsyncStorage.setItem(REMINDER_KEY, 'false');
    return false;
  }

  await scheduleEveningReminder();
  await AsyncStorage.setItem(REMINDER_KEY, 'true');
  return true;
}

/**
 * Re-arms the reminder on launch. Scheduled notifications survive restarts, but
 * not a reinstall or a revoked permission, so the stored preference is the
 * source of truth.
 */
export async function syncEveningReminder() {
  if (!remindersSupported) return;
  configureNotifications();
  if (!(await isEveningReminderEnabled())) return;

  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) {
    await AsyncStorage.setItem(REMINDER_KEY, 'false');
    return;
  }
  await scheduleEveningReminder().catch(() => undefined);
}

export async function clearRemindersAfterAccountDeletion() {
  if (!remindersSupported) return;
  await Notifications.cancelScheduledNotificationAsync(IDENTIFIER).catch(() => undefined);
  await AsyncStorage.removeItem(REMINDER_KEY);
}
